import { NextRequest, NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { Participants } from "@/lib/models/participants";
import { verifyAuth, hasRole } from "@/lib/auth";
import { ObjectId } from "mongodb";

// POST /api/rounds - Create a new round (Admin only)
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Only admins can create rounds
    if (!hasRole(authResult.payload, "admin")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { participantId } = body;

    // Validate input
    if (!participantId) {
      return NextResponse.json(
        { error: "Missing required field: participantId" },
        { status: 400 }
      );
    }

    // Check if participant exists
    const participant = await Participants.getById(participantId);
    if (!participant) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    // Set round timer to 1 minute from now
    const timerEnd = new Date(Date.now() + 60000); // 1 minute
    const scheduledStart = new Date(); // Start immediately

    // Create the round
    const round = {
      participantId: new ObjectId(participantId.toString()),
      bids: [],
      status: "active" as const,
      timerEnd,
      scheduledStart,
    };

    const result = await Rounds.create(round);

    return NextResponse.json({
      success: true,
      roundId: result.insertedId.toString(),
      message: "Round created successfully",
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
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";

    let rounds;
    if (activeOnly) {
      rounds = await Rounds.getActive();
    } else {
      rounds = await Rounds.getAll();
    }

    // Transform rounds to match the expected response format
    const formattedRounds = rounds.map((round) => ({
      roundId: round._id?.toString(),
      participantId: round.participantId.toString(),
      status: round.status,
      timerEnd: round.timerEnd.toISOString(),
      scheduledStart: round.scheduledStart?.toISOString(),
      bids: round.bids.map((bid) => ({
        bidId: bid._id?.toString(),
        houseId: bid.houseId.toString(),
        amount: bid.amount,
        timestamp: bid.timestamp.toISOString(),
        edits: bid.edits || 0,
      })),
    }));

    return NextResponse.json(formattedRounds);
  } catch (error) {
    console.error("Error fetching rounds:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
