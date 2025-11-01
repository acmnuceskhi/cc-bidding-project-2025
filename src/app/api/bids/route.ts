import { NextResponse } from "next/server";
import { Bids } from "@/lib/models/bids";
import { Houses } from "@/lib/models/houses";
import { Rounds } from "@/lib/models/rounds";
import { ObjectId } from "mongodb";

// POST /api/bids - Place a bid
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { houseID, participantID, amount } = body;

    // Validate input
    if (!houseID || !participantID || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: houseID, participantID, amount" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Bid amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Check if house exists and has sufficient budget
    const house = await Houses.getByID(houseID);
    if (!house) {
      return NextResponse.json(
        { error: "House not found" },
        { status: 404 }
      );
    }

    if (amount > house.remainingBudget) {
      return NextResponse.json(
        { error: "Insufficient budget" },
        { status: 400 }
      );
    }

    // Check if there's an active round for this participant
    const activeRounds = await Rounds.getActive();
    const activeRound = activeRounds.find(round => 
      round.participantID.toString() === participantID
    );

    if (!activeRound) {
      return NextResponse.json(
        { error: "No active round for this participant" },
        { status: 400 }
      );
    }

    // Check if round has expired
    if (new Date() > activeRound.timerEnd) {
      return NextResponse.json(
        { error: "Round has expired" },
        { status: 400 }
      );
    }

    // Check if house has already placed a bid for this participant
    const existingBids = await Bids.getByParticipant(participantID);
    const houseBid = existingBids.find(bid => 
      bid.houseID.toString() === houseID
    );

    if (houseBid) {
      return NextResponse.json(
        { error: "House has already placed a bid for this participant" },
        { status: 400 }
      );
    }

    // Create the bid
    const bid = {
      houseID: new ObjectId(houseID),
      participantID: new ObjectId(participantID),
      amount,
      timestamp: new Date()
    };

    const result = await Bids.create(bid);

    return NextResponse.json({
      success: true,
      bid: {
        ...bid,
        _id: result.insertedId
      }
    });
  } catch (error) {
    console.error("Error creating bid:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/bids - Get bids (with optional filters)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const participantID = searchParams.get("participantID");
    const houseID = searchParams.get("houseID");
    
    let bids;
    if (participantID) {
      bids = await Bids.getByParticipant(participantID);
    } else if (houseID) {
      bids = await Bids.getByHouse(houseID);
    } else {
      bids = await Bids.getAll();
    }
    
    return NextResponse.json(bids);
  } catch (error) {
    console.error("Error fetching bids:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}