import { NextRequest, NextResponse } from "next/server";
import { Teams } from "@/lib/models/teams";
import { Participants } from "@/lib/models/participants";
import type { Participant } from "@/lib/models/participants";
import { Bids } from "@/lib/models/bids";
import { Config } from "@/lib/models/config";
import { verifyAuth, hasRole } from "@/lib/auth";
import { getSocketInstance } from "@/lib/socket-instance";

// Simple in-memory cache for phase counts and unsold teams (30-second TTL)
let cache: {
  phaseCounts: any;
  unsoldTeams: any[];
  participants: Participant[];
  timestamp: number;
} | null = null;

const CACHE_TTL = 30000; // 30 seconds

async function getCachedData() {
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return cache;
  }

  const allParticipants = await Participants.getAll();
  const unsoldTeams = await Teams.getAll().then((list) => list.filter((t: any) => !t.houseId));

  const counts: any = {
    pass1: { total: 0, scheduled: 0, active: 0, completed: 0 },
    pass2: { total: 0, scheduled: 0, active: 0, completed: 0 },
  };

  // rounds removed; phase counts remain zeroed

  const getMemberCount = (teamId: string) => {
    return allParticipants.filter((p) => p.teamId?.toString() === teamId)
      .length;
  };

  cache = {
    phaseCounts: counts,
    unsoldTeams: unsoldTeams.map((t: any) => ({
      teamId: t._id?.toString(),
      rank: t.rank,
      batch: t.batch ?? null,
      memberCount: getMemberCount(t._id?.toString() || ""),
    })),
    participants: allParticipants,
    timestamp: now,
  };

  return cache;
}

// GET /api/status - Get current status for projector display
export async function GET() {
  try {
    // Always include authoritative auction state from config
    const cfg = await Config.getAuctionState();
    // Get cached data (phase counts, unsold teams, participants)
    const cached = await getCachedData();
    const getMemberCount = (teamId: string) => {
      return cached.participants.filter((p) => p.teamId?.toString() === teamId)
        .length;
    };
    // Team-based active state: use cfg.currentRound as teamId
    const activeTeamId = cfg.currentRound || "";
    let team = null as any;
    let bidsPlaced: Array<{ houseId: string; amount: number }> = [];
    let timerRemaining = 0;
    let timerEndIso: string | null = null;

    if (activeTeamId) {
      try {
        const t = await Teams.getById(activeTeamId);
        if (t) {
          team = {
            teamId: t._id?.toString(),
            rank: t.rank,
            batch: t.batch ?? null,
            memberCount: getMemberCount(t._id?.toString() || ""),
            successfulAttempts: (t as any).successfulAttempts,
            totalPoints: (t as any).totalPoints,
          };
        }
      } catch { }

      try {
        const roundLikeBids = await Bids.getByTeam(activeTeamId);
        bidsPlaced = roundLikeBids.map((b) => ({
          houseId: b.houseId.toString(),
          amount: b.amount,
        }));
      } catch { }

      const now = Date.now();
      const endMs = cfg.currentRoundEndTime ? new Date(cfg.currentRoundEndTime).getTime() : null;
      timerRemaining = endMs ? Math.max(0, Math.floor((endMs - now) / 1000)) : 0;
      timerEndIso = cfg.currentRoundEndTime ? new Date(cfg.currentRoundEndTime).toISOString() : null;
    }

    return NextResponse.json({
      // Back-compat: roundId now carries teamId
      roundId: activeTeamId || null,
      team,
      roundStatus: activeTeamId ? "active" : "idle",
      roundNumber: undefined,
      timerRemaining,
      timerEnd: timerEndIso,
      bidsPlaced,
      serverTime: Date.now(),
      phaseCounts: cached.phaseCounts,
      unsoldTeams: cached.unsoldTeams,
      // Authoritative config-based state
      currentRound: cfg.currentRound || "",
      auctionStartTime: cfg.auctionStartTime?.toISOString() || null,
      auctionEndTime: cfg.auctionEndTime?.toISOString() || null,
      currentRoundStartTime: cfg.currentRoundStartTime?.toISOString() || null,
      currentRoundEndTime: cfg.currentRoundEndTime?.toISOString() || null,
    });
  } catch (error) {
    console.error("Error fetching status:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/status - Start/end round by updating authoritative auction state
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!hasRole(auth.payload, "admin")) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const body = await request.json();
    const action: string = body.action || "";
    const io = getSocketInstance();

    if (action === "start") {
      const { teamId, startTime, endTime } = body;
      if (!startTime || !endTime) {
        return NextResponse.json({ error: "Missing startTime or endTime" }, { status: 400 });
      }
      if (!teamId) return NextResponse.json({ error: "Missing teamId" }, { status: 400 });

      // Update authoritative config with teamId as current round identifier
      await Config.update({
        currentRound: teamId,
        currentRoundStartTime: new Date(startTime),
        currentRoundEndTime: new Date(endTime),
      });

      // Broadcast updated auction-state
      const cfg = await Config.getAuctionState();
      io.emit("auction-state", {
        currentRound: cfg.currentRound || "",
        auctionStartTime: cfg.auctionStartTime?.toISOString() || null,
        auctionEndTime: cfg.auctionEndTime?.toISOString() || null,
        currentRoundStartTime: cfg.currentRoundStartTime?.toISOString() || null,
        currentRoundEndTime: cfg.currentRoundEndTime?.toISOString() || null,
      });

      // Back-compat: roundId now equals teamId
      return NextResponse.json({ success: true, roundId: teamId, teamId });
    }

    if (action === "endNow") {
      const { teamId } = body;
      const targetTeamId: string | undefined = teamId || (await Config.get()).currentRound || undefined;
      const now = new Date();
      if (!targetTeamId) return NextResponse.json({ error: "Missing teamId" }, { status: 400 });

      // Set timerEnd to now in config; clients will transition based on timestamps
      await Config.update({ currentRoundEndTime: now });

      // Broadcast updated auction-state
      const cfg = await Config.getAuctionState();
      io.emit("auction-state", {
        currentRound: cfg.currentRound || "",
        auctionStartTime: cfg.auctionStartTime?.toISOString() || null,
        auctionEndTime: cfg.auctionEndTime?.toISOString() || null,
        currentRoundStartTime: cfg.currentRoundStartTime?.toISOString() || null,
        currentRoundEndTime: cfg.currentRoundEndTime?.toISOString() || null,
      });

      return NextResponse.json({ success: true, teamId: targetTeamId, endedAt: now.toISOString() });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Error in POST /api/status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
