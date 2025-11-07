import { NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { Participants } from "@/lib/models/participants";
import { Bids } from "@/lib/models/bids";

// GET /api/status - Get current status for projector display
export async function GET() {
  try {
    // Get the currently active round (assuming only one active round at a time)
    const activeRounds = await Rounds.getActive();

    if (activeRounds.length === 0) {
      return NextResponse.json({
        roundId: null,
        participant: null,
        roundStatus: "idle",
        timerRemaining: 0,
        bidsPlaced: []
      });
    }

    const activeRound = activeRounds[0];

    // Fetch participant info
    const participant = await Participants.getById(activeRound.participantId.toString());

    // Fetch all bids for the current round (not participant — as per logical flow)
    const roundBids = await Bids.getByRound(activeRound._id!.toString());

    // Calculate remaining time in seconds
    const now = Date.now();
    const timerRemaining = Math.max(
      0,
      Math.floor((activeRound.timerEnd.getTime() - now) / 1000)
    );

    // Collect houses that have placed bids (no amounts)
    const bidsPlaced = roundBids.map((bid) => ({
      houseId: bid.houseId.toString()
    }));

    return NextResponse.json({
      roundId: activeRound._id?.toString(),
      participant: participant
        ? {
            participantId: participant._id?.toString(),
            name: participant.name,
            picture: participant.picture ?? null
          }
        : null,
      roundStatus: activeRound.status,
      timerRemaining,
      bidsPlaced
    });
  } catch (error) {
    console.error("Error fetching status:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
