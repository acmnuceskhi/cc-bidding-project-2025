import { NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { Teams } from "@/lib/models/teams";
import { Participants } from "@/lib/models/participants";
import type { Participant } from "@/lib/models/participants";
import { Bids } from "@/lib/models/bids";
import { checkAndAutoEndExpiredRound } from "@/lib/round-auto-end";

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
  const [allRoundsForCounts, unsoldTeams] = await Promise.all([
    Rounds.getAll(),
    Teams.getAll().then((list) => list.filter((t) => !(t as any).houseId)),
  ]);

  const counts: any = {
    pass1: { total: 0, scheduled: 0, active: 0, completed: 0 },
    pass2: { total: 0, scheduled: 0, active: 0, completed: 0 },
  };

  for (const r of allRoundsForCounts) {
    const phaseKey = (r.passPhase === 2 ? "pass2" : "pass1") as
      | "pass1"
      | "pass2";
    counts[phaseKey].total += 1;
    if (r.status === "scheduled") counts[phaseKey].scheduled += 1;
    else if (r.status === "active") counts[phaseKey].active += 1;
    else if (r.status === "completed") counts[phaseKey].completed += 1;
  }

  const getMemberCount = (teamId: string) => {
    return allParticipants.filter((p) => p.teamId?.toString() === teamId)
      .length;
  };

  cache = {
    phaseCounts: counts,
    unsoldTeams: unsoldTeams.map((t) => ({
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
    // Check auto-end only occasionally (every 5th request or if no active round)
    // This prevents running expensive logic on every poll
    const shouldCheckAutoEnd = Math.random() < 0.2; // 20% chance

    if (shouldCheckAutoEnd) {
      await checkAndAutoEndExpiredRound();
    }

    // Get the currently active round
    const activeRounds = await Rounds.getActive();

    // Get cached data (phase counts, unsold teams, participants)
    const cached = await getCachedData();
    const getMemberCount = (teamId: string) => {
      return cached.participants.filter((p) => p.teamId?.toString() === teamId)
        .length;
    };

    if (activeRounds.length === 0) {
      return NextResponse.json({
        roundId: null,
        team: null,
        roundStatus: "idle",
        timerRemaining: 0,
        bidsPlaced: [],
        serverTime: Date.now(),
        phaseCounts: cached.phaseCounts,
        unsoldTeams: cached.unsoldTeams,
      });
    }

    const activeRound = activeRounds[0];

    // If auto-end was triggered, re-fetch active rounds
    if (shouldCheckAutoEnd) {
      const updatedRounds = await Rounds.getActive();
      if (updatedRounds.length === 0) {
        return NextResponse.json({
          roundId: null,
          team: null,
          roundStatus: "idle",
          timerRemaining: 0,
          bidsPlaced: [],
          serverTime: Date.now(),
          phaseCounts: cached.phaseCounts,
          unsoldTeams: cached.unsoldTeams,
        });
      }
    }

    // Fetch team info
    const team = await Teams.getById(
      activeRound.teamId.toString()
    );

    // Fetch all bids for the current round (not participant — as per logical flow)
    const roundBids = await Bids.getByRound(activeRound._id!.toString());

    // Calculate remaining time in seconds
    const currentTime = Date.now();
    const roundTimerEnd = activeRound.timerEnd?.getTime();
    const timerRemaining = roundTimerEnd
      ? Math.max(0, Math.floor((roundTimerEnd - currentTime) / 1000))
      : 0;

    // Collect houses that have placed bids with amounts
    const bidsPlaced = roundBids.map((bid) => ({
      houseId: bid.houseId.toString(),
      amount: bid.amount,
    }));

    // Calculate round number from cached phase counts
    const roundNumber =
      cached.phaseCounts.pass1.completed +
      cached.phaseCounts.pass2.completed +
      cached.phaseCounts.pass1.active +
      cached.phaseCounts.pass2.active;

    return NextResponse.json({
      roundId: activeRound._id?.toString(),
      team: team
        ? {
            teamId: team._id?.toString(),
            rank: team.rank,
            batch: team.batch ?? null,
            memberCount: getMemberCount(team._id?.toString() || ""),
            successfulAttempts: team.successfulAttempts,
            totalPoints: team.totalPoints,
          }
        : null,
      roundStatus: activeRound.status,
      roundNumber,
      timerRemaining,
      timerEnd: activeRound.timerEnd?.toISOString(),
      bidsPlaced,
      serverTime: Date.now(),
      phaseCounts: cached.phaseCounts,
      unsoldTeams: cached.unsoldTeams,
    });
  } catch (error) {
    console.error("Error fetching status:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
