import { NextRequest, NextResponse } from "next/server";
import { Rounds, type Round } from "@/lib/models/rounds";
import { Teams } from "@/lib/models/teams";
import { Participants } from "@/lib/models/participants";
import clientPromise from "@/lib/mongodb";
import { verifyAuth, hasRole } from "@/lib/auth";
import { ObjectId, ReturnDocument } from "mongodb";

// POST /api/rounds/[id]/restart - Fully resets a round, refunds bids, clears data
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Authentication & role check
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!hasRole(authResult.payload, "admin")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // ✅ Validate round ID
    const { id } = await context.params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid or missing round ID" },
        { status: 400 }
      );
    }

    const round = await Rounds.getById(id);
    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    // Idempotency: if round is not completed, treat as a no-op success
    if (round.status !== "completed") {
      return NextResponse.json({
        success: true,
        canRestart: false,
        round,
        refundedCount: 0,
        totalRefundAmount: 0,
        bidsCleared: 0,
        message: "Round is not completed; no restart needed",
      });
    }

    // Determine winning bid refund eligibility (escrow only deducted winner)
    const team = await Teams.getById(
      round.teamId.toString()
    );
    const winningHouseId = team?.houseId?.toString();

    const client = await clientPromise;
    const session = client.startSession();
    let refundedCount = 0;
    let totalRefundAmount = 0;
    let numBids = 0;

    const lockKey = `restart-${id}`;
    const locksColl = client
      .db()
      .collection<{ _id: string; createdAt: Date }>("_locks");

    // Try to acquire a lightweight lock by inserting a document with a unique _id
    try {
      await locksColl.insertOne({ _id: lockKey, createdAt: new Date() });
    } catch (err: unknown) {
      // Duplicate key means another restart is in progress or recently completed.
      const e = err as { code?: number; codeName?: string };
      if (e && (e.code === 11000 || e.codeName === "DuplicateKey")) {
        const updatedRound = await Rounds.getById(id);
        return NextResponse.json({
          success: true,
          canRestart: false,
          round: updatedRound,
          refundedCount: 0,
          totalRefundAmount: 0,
          bidsCleared: 0,
          message: "Restart already in progress or completed",
        });
      }
      throw err;
    }

    try {
      await session.withTransaction(async () => {
        const db = client.db();

        // Re-read team inside the transaction to get current assignment
        const teamDoc = await db
          .collection("teams")
          .findOne({ _id: new ObjectId(round.teamId) }, { session });
        const currentWinningHouseId = teamDoc?.houseId
          ? teamDoc.houseId.toString()
          : undefined;

        // Read current round state for pass phase logic
        const roundBefore = await db
          .collection<Round>("rounds")
          .findOne({ _id: new ObjectId(id) }, { session });

        // Atomically flip the round.finalized flag from true -> false and
        // use the previous value to determine if a refund is necessary.
        const prevRoundRaw: unknown = await db
          .collection<Round>("rounds")
          .findOneAndUpdate(
            { _id: new ObjectId(id), finalized: true },
            { $set: { finalized: false } },
            { session, returnDocument: ReturnDocument.BEFORE }
          );

        // Helper to detect { value: T | null } shapes from driver variations
        function hasValue<T>(x: unknown): x is { value: T | null } {
          return typeof x === "object" && x !== null && "value" in x;
        }

        // Normalize previous document shape
        let prevRoundDoc: Round | null = null;
        if (hasValue<Round>(prevRoundRaw)) {
          prevRoundDoc = prevRoundRaw.value ?? null;
        } else if (typeof prevRoundRaw === "object" && prevRoundRaw !== null) {
          prevRoundDoc = prevRoundRaw as Round;
        }

        if (prevRoundDoc && currentWinningHouseId) {
          // If the round was finalized we refund the winning bid (if present).
          const winningBidDoc = await db.collection("bids").findOne(
            {
              roundId: new ObjectId(id),
              houseId: new ObjectId(currentWinningHouseId),
            },
            { session }
          );

          if (winningBidDoc) {
            await db
              .collection("houses")
              .updateOne(
                { _id: new ObjectId(winningBidDoc.houseId) },
                { $inc: { remainingBudget: winningBidDoc.amount } },
                { session }
              );
            refundedCount = 1;
            totalRefundAmount = winningBidDoc.amount;
          }
        }

        // Delete all bids for this round (clear the slate) and capture deleted count
        const deleteRes = await db
          .collection("bids")
          .deleteMany({ roundId: new ObjectId(id) }, { session });
        numBids = deleteRes.deletedCount ?? 0;

        // Unassign team and all its participants from house if they were assigned
        if (currentWinningHouseId) {
          // Unassign the team
          await db
            .collection("teams")
            .updateOne(
              { _id: new ObjectId(round.teamId) },
              { $unset: { houseId: "" } },
              { session }
            );
          
          // Unassign all participants in the team
          await db
            .collection("participants")
            .updateMany(
              { teamId: new ObjectId(round.teamId) },
              { $unset: { houseId: "" } },
              { session }
            );
        }

        // Reset the round's state so it's ready for restart (clear skipped flag for fresh start)
        let nextPassPhase: 1 | 2 = (roundBefore?.passPhase ?? 1) as 1 | 2;
        if (roundBefore?.finalized !== true && nextPassPhase === 1) {
          // Move unsold/no-bid rounds from pass 1 to pass 2 on restart
          nextPassPhase = 2;
        }
        await db.collection("rounds").updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: "scheduled",
              timerEnd: null,
              finalized: false,
              scheduledStart: null,
              passPhase: nextPassPhase,
            },
            $unset: { winningBid: "", skipped: "" },
          },
          { session }
        );
      });
    } finally {
      try {
        await session.endSession();
      } finally {
        // release lock (best-effort)
        try {
          await locksColl.deleteOne({ _id: lockKey });
        } catch {
          /* ignore lock release errors */
        }
      }
    }

    const updatedRound = await Rounds.getById(id);

    return NextResponse.json({
      success: true,
      canRestart: true, // ✅ explicitly indicate ready-to-start
      round: updatedRound,
      refundedCount,
      totalRefundAmount,
      bidsCleared: numBids,
      message: "Round reset successfully and ready to start",
    });
  } catch (error) {
    console.error("Error restarting round:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
