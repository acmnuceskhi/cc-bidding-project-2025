import { NextRequest, NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { Bids } from "@/lib/models/bids";
import clientPromise from "@/lib/mongodb";
import { verifyAuth, hasRole } from "@/lib/auth";
import { ObjectId } from "mongodb";

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

    // ✅ Get the *latest bid* for each house for this round (aggregate-based)
    const latestBids = await Bids.getLatestBidPerHouseForRound(id);

    const client = await clientPromise;
    const session = client.startSession();
    let refundedCount = 0;
    let totalRefundAmount = 0;

    try {
      await session.withTransaction(async () => {
        const db = client.db();

        // ✅ Refund only the latest bid from each house
        for (const bid of latestBids) {
          await db.collection("houses").updateOne(
            { _id: new ObjectId(bid.houseId) },
            { $inc: { remainingBudget: bid.amount } },
            { session }
          );
          refundedCount++;
          totalRefundAmount += bid.amount;
        }

        // ✅ Delete all bids for this round (clear the slate)
        await db
          .collection("bids")
          .deleteMany({ roundId: new ObjectId(id) }, { session });

        // ✅ Reset the round’s state so it’s ready for restart
        await db.collection("rounds").updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: "scheduled",
              timerEnd: null,
              finalized: false,
              scheduledStart: null,
            },
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
      canRestart: true, // ✅ explicitly indicate ready-to-start
      round: updatedRound,
      refundedCount,
      totalRefundAmount,
      bidsCleared: latestBids.length,
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
