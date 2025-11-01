import { NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { Participants } from "@/lib/models/participants";
import { Houses } from "@/lib/models/houses";
import { Bids } from "@/lib/models/bids";

// POST /api/rounds/:id/end - End a round and determine winner
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing round ID" },
        { status: 400 }
      );
    }

    // Get the round
    const round = await Rounds.getByID(id);
    if (!round) {
      return NextResponse.json(
        { error: "Round not found" },
        { status: 404 }
      );
    }

    // Get all bids for this round's participant
    const bids = await Bids.getByParticipant(round.participantID.toString());

    // Find the winning bid (highest amount, earliest timestamp in case of tie)
    let winningBid = null;
    let winningHouse = null;
    
    if (bids.length > 0) {
      winningBid = bids.reduce((winner, current) => {
        // If current bid is higher, it wins
        if (current.amount > winner.amount) {
          return current;
        }
        // If amounts are equal, earliest timestamp wins
        if (current.amount === winner.amount && current.timestamp < winner.timestamp) {
          return current;
        }
        return winner;
      });

      // Get the winning house details
      winningHouse = await Houses.getByID(winningBid.houseID.toString());
    }

    // Update round status to completed
    await Rounds.update(id, {
      status: "completed"
    });

    // If there's a winning bid, update house budget and assign participant
    if (winningBid && winningHouse) {
      // Deduct bid amount from house's remaining budget
      await Houses.update(winningHouse._id!.toString(), {
        remainingBudget: winningHouse.remainingBudget - winningBid.amount
      });

      // Assign participant to winning house
      await Participants.update(round.participantID.toString(), {
        assignedHouse: winningHouse._id
      });
    }

    return NextResponse.json({
      success: true,
      winningBid: winningBid ? {
        houseID: winningBid.houseID,
        houseName: winningHouse?.name,
        amount: winningBid.amount,
        timestamp: winningBid.timestamp
      } : null,
      allBids: bids.map(bid => ({
        houseID: bid.houseID,
        amount: bid.amount,
        timestamp: bid.timestamp
      })),
      message: winningBid 
        ? `Participant won by ${winningHouse?.name} with bid $${winningBid.amount}` 
        : "Round ended with no bids"
    });
  } catch (error) {
    console.error("Error ending round:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}