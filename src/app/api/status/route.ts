import { NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { Participants } from "@/lib/models/participants";
import { Houses } from "@/lib/models/houses";
import { Bids } from "@/lib/models/bids";

// GET /api/status - Get current status for projector display
export async function GET() {
  try {
    // Get active rounds
    const activeRounds = await Rounds.getActive();
    
    if (activeRounds.length === 0) {
      return NextResponse.json({
        activeRound: null,
        currentParticipant: null,
        housesWithBids: [],
        winningHouse: null
      });
    }

    // Get the first active round (assuming only one active round at a time)
    const activeRound = activeRounds[0];
    
    // Get current participant
    const participant = await Participants.getByID(activeRound.participantID.toString());
    
    // Get all houses
    const houses = await Houses.getAll();
    
    // Get bids for current participant
    const bids = await Bids.getByParticipant(activeRound.participantID.toString());
    
    // Create a list of houses that placed bids (without amounts)
    const housesWithBids = houses
      .filter(house => 
        bids.some(bid => bid.houseID.toString() === house._id?.toString())
      )
      .map(house => ({
        id: house._id,
        name: house.name
      }));

    return NextResponse.json({
      activeRound: {
        id: activeRound._id,
        timerEnd: activeRound.timerEnd,
        timeLeft: activeRound.timerEnd.getTime() - Date.now()
      },
      currentParticipant: participant ? {
        id: participant._id,
        name: participant.name,
        picture: participant.picture
      } : null,
      housesWithBids,
      winningHouse: null // Will be set when round ends
    });
  } catch (error) {
    console.error("Error fetching status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}