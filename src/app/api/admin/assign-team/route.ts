import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, hasRole } from "@/lib/auth";
import { Teams } from "@/lib/models/teams";
import { Houses } from "@/lib/models/houses";
import { Bids } from "@/lib/models/bids";
import { Config } from "@/lib/models/config";
import clientPromise from "@/lib/mongodb";
import { getSocketInstance } from "@/lib/socket-instance";
import { ObjectId } from "mongodb";

// POST /api/admin/assign-team
// Admin-only: create a bid for a team and atomically assign the team to the house,
// deducting the house budget. Emits the same socket updates as validate-win.
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!hasRole(auth.payload, "admin")) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const teamId: string | undefined = body.teamId;
    const houseId: string | undefined = body.houseId;
    const amount: number | undefined = body.amount;

    if (!teamId || !houseId || amount === undefined || amount === null) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    if (typeof amount !== "number" || amount < 0) {
      return NextResponse.json({ error: "INVALID_AMOUNT" }, { status: 400 });
    }

    const team = await Teams.getById(teamId);
    if (!team) return NextResponse.json({ error: "TEAM_NOT_FOUND" }, { status: 404 });

    // Reject if already assigned
    if (team.houseId) {
      return NextResponse.json({ error: "ALREADY_ASSIGNED", message: "Team already assigned to a house" }, { status: 409 });
    }

    const house = await Houses.getById(houseId);
    if (!house) return NextResponse.json({ error: "HOUSE_NOT_FOUND" }, { status: 404 });

    // Check batch limits similar to regular bids
    const allTeams = await Teams.getAll();
    const sameBatchCount = allTeams.filter((t) => t.houseId && t.houseId.toString() === houseId && t.batch === team.batch).length;
    const cfg = await Config.get();
    const perBatchLimit = (cfg.batchLimits && cfg.batchLimits[team.batch as string]) ?? 1;
    const teamsLeftToBuy = Math.max(0, perBatchLimit - sameBatchCount);
    if (teamsLeftToBuy <= 0) {
      return NextResponse.json({ error: "BATCH_LIMIT_REACHED", message: `House already has maximum teams from batch '${team.batch}'` }, { status: 403 });
    }

    const minBid = cfg.minBidAmount == null ? 1 : Number(cfg.minBidAmount);
    if (amount < minBid) {
      return NextResponse.json({ error: "MIN_BID_NOT_MET", message: `Bid must be at least ${minBid}` }, { status: 409 });
    }

    let computedMax = house.remainingBudget;
    if (teamsLeftToBuy > 1) {
      computedMax = house.remainingBudget - (teamsLeftToBuy - 1) * minBid;
    }
    computedMax = Math.max(0, computedMax);
    if (computedMax < minBid) {
      return NextResponse.json({ error: "COMPUTED_MAX_TOO_LOW", message: `Insufficient funds to safely acquire remaining ${teamsLeftToBuy} team(s)` }, { status: 409 });
    }
    if (amount > computedMax) {
      return NextResponse.json({ error: "COMPUTED_MAX_EXCEEDED", message: `Amount exceeds computed safe maximum of ${computedMax}` }, { status: 409 });
    }

    // Create/upsert bid record (teamId doubles as roundId in team-centric model)
    await Bids.upsertBid(teamId, houseId, teamId, amount);

    // Perform atomic update: deduct house budget and assign team + participants
    const client = await clientPromise;
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        const db = client.db();
        await db.collection("houses").updateOne({ _id: new ObjectId(houseId) }, { $inc: { remainingBudget: -amount } }, { session });
        await db.collection("teams").updateOne({ _id: new ObjectId(teamId) }, { $set: { houseId: new ObjectId(houseId) } }, { session });
        await db.collection("participants").updateMany({ teamId: new ObjectId(teamId) }, { $set: { houseId: new ObjectId(houseId) } }, { session });
      });
    } finally {
      await session.endSession();
    }

    // Emit socket updates: budget-update, teams-update, house-teams-update, and bids updates
    try {
      const io = getSocketInstance();
      if (io) {
        const db = (await clientPromise).db();
        const updatedHouse = await db.collection("houses").findOne({ _id: new ObjectId(houseId) });
        const remainingBudget = updatedHouse?.remainingBudget;
        if (typeof remainingBudget === "number") {
          io.to(`house:${houseId}`).emit("budget-update", { houseId, remainingBudget });
          io.to("admins").emit("budget-update", { houseId, remainingBudget });
        }

        // Broadcast teams assignment snapshot (admins)
        try {
          const allTeamsUp = await Teams.getAll();
          const adminPayload = allTeamsUp.map((t) => ({
            teamId: (t._id as ObjectId).toString(),
            name: t.name || null,
            rank: t.rank,
            batch: t.batch || null,
            houseId: t.houseId ? (t.houseId as ObjectId).toString() : null,
          }));
          io.to("admins").emit("teams-update", { teams: adminPayload });

          // Per-house teams list
          const byHouse: Record<string, Array<{ teamId: string; name?: string | null; rank: number; batch?: string | null }>> = {};
          for (const t of allTeamsUp) {
            if (t.houseId) {
              const hId = (t.houseId as ObjectId).toString();
              if (!byHouse[hId]) byHouse[hId] = [];
              byHouse[hId].push({ teamId: (t._id as ObjectId).toString(), name: t.name || null, rank: t.rank, batch: t.batch || null });
            }
          }
          for (const [hId, teams] of Object.entries(byHouse)) {
            io.to(`house:${hId}`).emit("house-teams-update", { houseId: hId, teams });
          }
        } catch { }

        // Emit bid-placed and bids-update for admins for this team
        io.emit("bid-placed", { houseId, houseName: house.name, roundId: teamId });
        try {
          const latestBids = await Bids.getByTeam(teamId);
          const allHouses = await Houses.getAll();
          const houseNameById = new Map(allHouses.map((h) => [h._id?.toString(), h.name]));
          const adminBids = latestBids.map((b) => ({ houseId: b.houseId.toString(), houseName: houseNameById.get(b.houseId.toString()) || "Unknown", amount: b.amount, timestamp: b.timestamp ? new Date(b.timestamp).toISOString() : new Date().toISOString() })).sort((a, b) => b.amount - a.amount);
          io.to("admins").emit("bids-update", { teamId, bids: adminBids });
          io.emit("bids-update", { teamId, bids: adminBids });
          io.to(`house:${houseId}`).emit("bids-update", { teamId, houseId, amount, timestamp: new Date().toISOString() });
        } catch { }
      }
    } catch { }

    return NextResponse.json({ success: true, teamId, houseId, amount });
  } catch (error) {
    console.error("Error in POST /api/admin/assign-team:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
