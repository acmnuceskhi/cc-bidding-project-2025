import { NextRequest, NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { Houses } from "@/lib/models/houses";
import { Bids } from "@/lib/models/bids";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { verifyAuth, hasRole } from "@/lib/auth";
import type { Bid } from "@/lib/models/bids";

// POST /api/rounds/:id/end - End a round and determine winner (Admin only)
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

    // Only admins can end rounds
    if (!hasRole(authResult.payload, "admin")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

  const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Missing round ID" }, { status: 400 });
    }

    // Get the round
    const round = await Rounds.getById(id);
    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    // Prevent double completion if round is finalized (participant sold)
    if (round.finalized) {
      return NextResponse.json(
        { error: "Round already finalized for this participant" },
        { status: 400 }
      );
    }

  // Get all bids for this specific round (not all rounds for the participant)
  const bids = await Bids.getByRound(id);

  // 🚫 No bids case — do not mark completed
    if (bids.length === 0) {
      await Rounds.update(id, {
        status: "scheduled",
        timerEnd: new Date(),
        finalized: false,
      });

      return NextResponse.json({
        success: true,
        winningBid: null,
        allBids: [],
        message: "Round ended — no bids were placed. Not marked as completed.",
      });
    }

    // Find the winning bid (highest amount, earliest timestamp in case of tie)
    let winningBid: Bid | null = null;
    let winningHouse = null;

    if (bids.length > 0) {
      winningBid = bids.reduce((winner: Bid, current: Bid) => {
        // If current bid is higher, it wins
        if (current.amount > winner.amount) {
          return current;
        }
        // If amounts are equal, earliest timestamp wins
        if (
          current.amount === winner.amount &&
          current.timestamp < winner.timestamp
        ) {
          return current;
        }
        return winner;
      });

      // Get the winning house details
      winningHouse = await Houses.getById(winningBid.houseId.toString());
    }

    // ESCROW LOGIC with transaction:
    // - Budgets were reserved at bid time (already deducted)
    // - Winner keeps reserved amount (no extra deduction)
    // - All losing bids are refunded (their reserved amounts restored)
  const client = await clientPromise;
  const session = client.startSession();
  let message: string = "Round ended";
    try {
      await session.withTransaction(async () => {
        const db = client.db();

        // Refund losing bids if there was at least one winning bid
        if (winningBid) {
          const losingBids = bids.filter(
            (b) => b._id?.toString() !== winningBid!._id?.toString()
          );
          for (const lb of losingBids) {
            await db
              .collection("houses")
              .updateOne(
                { _id: new ObjectId(lb.houseId) },
                { $inc: { remainingBudget: lb.amount } },
                { session }
              );
          }
        }

        // Update round status (finalized only if sold)
        await db
          .collection("rounds")
          .updateOne(
            { _id: new ObjectId(id) },
            {
              $set: {
                status: "completed",
                timerEnd: new Date(),
                finalized: !!winningHouse,
                winningBid: winningBid ? winningBid.amount : null,
              },
            },
            { session }
          );

        // Assign participant only if sold
        if (winningHouse) {
          await db
            .collection("participants")
            .updateOne(
              { _id: new ObjectId(round.participantId) },
              { $set: { houseId: winningHouse._id } },
              { session }
            );
          message = `Participant won by ${winningHouse.name} with bid $${winningBid!.amount}`;
        } else {
          message = "Round ended with no bids";
        }
      });
    } finally {
      await session.endSession();
    }

    return NextResponse.json({
      success: true,
      winningBid: winningBid
        ? {
            houseId: winningBid.houseId,
            houseName: winningHouse?.name,
            amount: winningBid.amount,
            timestamp: winningBid.timestamp,
          }
        : null,
      allBids: bids.map((bid) => ({
        houseId: bid.houseId,
        amount: bid.amount,
        timestamp: bid.timestamp,
      })),
      message,
    });
  } catch (error) {
    console.error("Error ending round:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
