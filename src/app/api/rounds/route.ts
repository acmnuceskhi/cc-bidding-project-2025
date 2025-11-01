import { NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { Participants } from "@/lib/models/participants";
import { Houses } from "@/lib/models/houses";
import { Bids } from "@/lib/models/bids";
import { ObjectId } from "mongodb";

// POST /api/rounds - Create a new round
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { participantID } = body;

    // Validate input
    if (!participantID) {
      return NextResponse.json(
        { error: "Missing required field: participantID" },
        { status: 400 }
      );
    }

    // Check if participant exists
    const participant = await Participants.getByID(participantID);
    if (!participant) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    // Set round timer to 1 minute from now
    const timerEnd = new Date(Date.now() + 60000); // 1 minute

    // Create the round
    const round = {
      participantID: new ObjectId(participantID),
      bids: [],
      status: "active" as const,
      timerEnd
    };

    const result = await Rounds.create(round);

    return NextResponse.json({
      success: true,
      round: {
        ...round,
        _id: result.insertedId
      }
    });
  } catch (error) {
    console.error("Error creating round:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/rounds - Get all rounds
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";
    
    let rounds;
    if (activeOnly) {
      rounds = await Rounds.getActive();
    } else {
      rounds = await Rounds.getAll();
    }
    
    return NextResponse.json(rounds);
  } catch (error) {
    console.error("Error fetching rounds:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/rounds/:id - Update a round (e.g., end it)
export async function PUT(request: Request) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const id = pathParts[pathParts.length - 1];

    if (!id) {
      return NextResponse.json(
        { error: "Missing round ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Update the round
    const result = await Rounds.update(id, body);

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Round not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Error updating round:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/rounds/:id/start - Start a round
export async function START(request: Request) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const id = pathParts[pathParts.length - 2]; // Get ID from /rounds/:id/start

    if (!id) {
      return NextResponse.json(
        { error: "Missing round ID" },
        { status: 400 }
      );
    }

    // Set round timer to 1 minute from now
    const timerEnd = new Date(Date.now() + 60000); // 1 minute

    // Update the round to active status
    const result = await Rounds.update(id, {
      status: "active",
      timerEnd
    });

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Round not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Error starting round:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/rounds/:id/end - End a round and determine winner
export async function END(request: Request) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const id = pathParts[pathParts.length - 2]; // Get ID from /rounds/:id/end

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
    }

    // Update round status to completed
    await Rounds.update(id, {
      status: "completed"
    });

    // If there's a winning bid, update house budget and assign participant
    if (winningBid) {
      // Get the winning house
      const house = await Houses.getByID(winningBid.houseID.toString());
      if (house) {
        // Deduct bid amount from house's remaining budget
        await Houses.update(house._id!.toString(), {
          remainingBudget: house.remainingBudget - winningBid.amount
        });

        // Assign participant to winning house
        await Participants.update(round.participantID.toString(), {
          assignedHouse: house._id
        });
      }
    }

    return NextResponse.json({
      success: true,
      winningBid,
      message: winningBid 
        ? `Participant won by ${winningBid.houseID} with bid ${winningBid.amount}` 
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