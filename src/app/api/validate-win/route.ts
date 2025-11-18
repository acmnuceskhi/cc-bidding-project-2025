import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, hasRole } from "@/lib/auth";
import { Config } from "@/lib/models/config";
import { Bids } from "@/lib/models/bids";
import { Houses } from "@/lib/models/houses";
import { Teams } from "@/lib/models/teams";
import clientPromise from "@/lib/mongodb";
import { getSocketInstance } from "@/lib/socket-instance";
import { ObjectId } from "mongodb";

// POST /api/validate-win
// Admin-only. Finalizes the winner for the current team (or provided teamId)
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth)
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    if (!hasRole(auth.payload, "admin"))
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );

    const body = await request.json().catch(() => ({}));
    const teamId: string | undefined =
      body.teamId || (await Config.get()).currentRound || undefined;
    if (!teamId)
      return NextResponse.json({ error: "Missing teamId" }, { status: 400 });

    // Handle CANCEL action: delete all bids for the team and broadcast updates
    if (body?.action === "cancel") {
      const client = await clientPromise;
      const db = client.db();
      // Get existing bids to notify houses after deletion
      const existing = await Bids.getByTeam(teamId);
      await db.collection("bids").deleteMany({ teamId: new ObjectId(teamId) });

      // Clear Config.currentRound so the team becomes available again
      await Config.update({
        currentRound: "",
        currentRoundStartTime: null,
        currentRoundEndTime: null,
      });

      // Broadcast updated auction-state
      try {
        const io = getSocketInstance();
        if (io) {
          io.to("admins").emit("bids-update", { teamId, bids: [] });
          const notified = new Set<string>();
          for (const bid of existing) {
            const hId = bid.houseId.toString();
            if (notified.has(hId)) continue;
            notified.add(hId);
            io.to(`house:${hId}`).emit("bids-update", {
              teamId,
              houseId: hId,
              amount: 0,
            });
          }
          // Broadcast cleared auction state
          const cfg = await Config.getAuctionState();
          io.emit("auction-state", {
            currentRound: cfg.currentRound || "",
            auctionStartTime: cfg.auctionStartTime?.toISOString() || null,
            auctionEndTime: cfg.auctionEndTime?.toISOString() || null,
            currentRoundStartTime:
              cfg.currentRoundStartTime?.toISOString() || null,
            currentRoundEndTime: cfg.currentRoundEndTime?.toISOString() || null,
          });
        }
      } catch { }

      return NextResponse.json({ success: true, cancelled: true });
    }

    // Ensure team exists and check if already assigned (validated)
    const teamDoc = await Teams.getById(teamId);
    if (!teamDoc)
      return NextResponse.json({ error: "Team not found" }, { status: 404 });

    // Gather all bids for the team, latest per house due to unique index
    const bids = await Bids.getByTeam(teamId);

    // Map house data for convenience
    const allHouses = await Houses.getAll();
    const houseNameById = new Map<string, string>();
    for (const h of allHouses) {
      const id = h._id?.toString();
      if (id) houseNameById.set(id, h.name);
    }

    // Sort for display: amount desc, timestamp asc
    const allBids = bids
      .map((b) => ({
        houseId: b.houseId.toString(),
        houseName: houseNameById.get(b.houseId.toString()) || "Unknown",
        amount: b.amount,
        timestamp: b.timestamp?.toISOString() || new Date().toISOString(),
      }))
      .sort((a, b) => {
        if (b.amount !== a.amount) return b.amount - a.amount;
        return (
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      });

    // If already assigned to a house, treat as already validated and skip budget deduction
    if (teamDoc.houseId) {
      const assignedHouseId = teamDoc.houseId.toString();
      const assignedHouseName = houseNameById.get(assignedHouseId) || "Unknown";
      const winningAmount =
        allBids.find((b) => b.houseId === assignedHouseId)?.amount ?? null;
      return NextResponse.json({
        success: true,
        alreadyValidated: true,
        winner: {
          houseId: assignedHouseId,
          houseName: assignedHouseName,
          amount: winningAmount,
          timestamp: new Date().toISOString(),
        },
        allBids,
        message: "Team already validated (assigned to a house)",
      });
    }

    if (allBids.length === 0 || allBids[0].amount <= 0) {
      // No bids — do not modify currentRound here. Let the admin or workflow
      // decide if/when to advance or clear the current round.
      // Broadcast current auction state (unchanged) so clients can refresh.
      try {
        const io = getSocketInstance();
        if (io) {
          const cfg = await Config.getAuctionState();
          io.emit("auction-state", {
            currentRound: cfg.currentRound || "",
            auctionStartTime: cfg.auctionStartTime?.toISOString() || null,
            auctionEndTime: cfg.auctionEndTime?.toISOString() || null,
            currentRoundStartTime:
              cfg.currentRoundStartTime?.toISOString() || null,
            currentRoundEndTime: cfg.currentRoundEndTime?.toISOString() || null,
          });
        }
      } catch { }

      return NextResponse.json({
        success: true,
        winner: null,
        allBids,
        message: "No bids to validate",
      });
    }

    // Winner: highest amount; tie → earliest timestamp
    const winner = allBids[0];

    const client = await clientPromise;
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        const db = client.db();

        // Deduct budget from winning house
        await db
          .collection("houses")
          .updateOne(
            { _id: new ObjectId(winner.houseId) },
            { $inc: { remainingBudget: -winner.amount } },
            { session }
          );

        // Assign team to winning house
        await db
          .collection("teams")
          .updateOne(
            { _id: new ObjectId(teamId) },
            { $set: { houseId: new ObjectId(winner.houseId) } },
            { session }
          );

        // Assign participants of the team to the winning house
        await db
          .collection("participants")
          .updateMany(
            { teamId: new ObjectId(teamId) },
            { $set: { houseId: new ObjectId(winner.houseId) } },
            { session }
          );
      });
    } finally {
      await session.endSession();
    }

    // NOTE: Do NOT clear `Config.currentRound` here — keep the currentRound
    // value intact so clients and workflows retain the reference to the
    // validated team. Clearing should be an explicit admin action.

    // Emit budget update to the winning house and admins, broadcast cleared auction state, and push updated team assignments
    try {
      const io = getSocketInstance();
      if (io) {
        const db = (await clientPromise).db();
        const updatedHouse = await db
          .collection<{ remainingBudget: number }>("houses")
          .findOne({ _id: new ObjectId(winner.houseId) });
        const remainingBudget = updatedHouse?.remainingBudget ?? undefined;
        if (typeof remainingBudget === "number") {
          io.to(`house:${winner.houseId}`).emit("budget-update", {
            houseId: winner.houseId,
            remainingBudget,
          });
          io.to("admins").emit("budget-update", {
            houseId: winner.houseId,
            remainingBudget,
          });
        }
        // Broadcast cleared auction state
        const cfg = await Config.getAuctionState();
        io.emit("auction-state", {
          currentRound: cfg.currentRound || "",
          auctionStartTime: cfg.auctionStartTime?.toISOString() || null,
          auctionEndTime: cfg.auctionEndTime?.toISOString() || null,
          currentRoundStartTime:
            cfg.currentRoundStartTime?.toISOString() || null,
          currentRoundEndTime: cfg.currentRoundEndTime?.toISOString() || null,
        });

        // Broadcast teams assignment snapshot (admins)
        try {
          const allTeams = await Teams.getAll();
          const adminPayload = allTeams.map((t) => ({
            teamId: (t._id as ObjectId).toString(),
            name: t.name || null,
            rank: t.rank,
            batch: t.batch || null,
            houseId: t.houseId ? (t.houseId as ObjectId).toString() : null,
          }));
          io.to("admins").emit("teams-update", { teams: adminPayload });
          // Per-house updates
          const byHouse: Record<string, Array<{ teamId: string; name?: string | null; rank: number; batch?: string | null }>> = {};
          for (const t of allTeams) {
            if (t.houseId) {
              const hId = (t.houseId as ObjectId).toString();
              if (!byHouse[hId]) byHouse[hId] = [];
              byHouse[hId].push({
                teamId: (t._id as ObjectId).toString(),
                name: t.name || null,
                rank: t.rank,
                batch: t.batch || null,
              });
            }
          }
          for (const [hId, teams] of Object.entries(byHouse)) {
            io.to(`house:${hId}`).emit("house-teams-update", { houseId: hId, teams });
          }
        } catch { }
      }
    } catch { }

    return NextResponse.json({
      success: true,
      winner,
      allBids,
    });
  } catch (error) {
    console.error("Error in POST /api/validate-win:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
