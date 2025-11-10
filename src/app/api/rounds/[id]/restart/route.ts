import { NextRequest, NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { Bids } from "@/lib/models/bids";
import clientPromise from "@/lib/mongodb";
import { verifyAuth, hasRole } from "@/lib/auth";
import { ObjectId } from "mongodb";

// POST /api/rounds/[id]/restart - Restart a round (Admin only)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Only admin can restart rounds
    if (!hasRole(authResult.payload, "admin")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

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

    // Prevent restart if round already finalized (participant sold)
    if (round.finalized) {
      return NextResponse.json(
        { error: "Cannot restart a finalized round" },
        { status: 400 }
      );
    }

    if (round.status === "active") {
      return NextResponse.json(
        { error: "Cannot restart a round that is currently active" },
        { status: 400 }
      );
    }

    // Fetch all bids for this round to potentially refund & delete
    const bidsForRound = await Bids.getByRound(id);

    // Start transaction for atomic restart (refund + cleanup + status reset)
    const client = await clientPromise;
    const session = client.startSession();
    let refundedCount = 0;
    let totalRefundAmount = 0;
    try {
      await session.withTransaction(async () => {
        const db = client.db();

        // Only refund budgets if the round was not already completed (to avoid double refunds)
        // If round.status === 'completed', losing bids have already been refunded at end phase.
        if (round.status !== "completed") {
          for (const bid of bidsForRound) {
            // Refund the reserved amount back to the house budget
            await db
              .collection("houses")
              .updateOne(
                { _id: new ObjectId(bid.houseId) },
                { $inc: { remainingBudget: bid.amount } },
                { session }
              );
            refundedCount++;
            totalRefundAmount += bid.amount;
          }
        }

        // Delete all bids for this round
        if (bidsForRound.length > 0) {
          await db
            .collection("bids")
            .deleteMany({ roundId: new ObjectId(id) }, { session });
        }

        // Reset round status & timer
        await db.collection("rounds").updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: "scheduled",
              timerEnd: null,
            },
            $unset: { finalized: "" }, // ensure finalized removed if present
          },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    const updatedRound = await Rounds.getById(id);

    return NextResponse.json({
      success: true,
      round: updatedRound,
      bidsRemoved: bidsForRound.length,
      refundedBids: refundedCount,
      totalRefundAmount,
      message: "Round restarted successfully",
    });
  } catch (error) {
    console.error("Error restarting round:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
