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

    // Prevent creating new round if participant already finalized (has round.finalized = true)
    const existingRounds = await Rounds.getByParticipant(participantId);
    const hasFinalized = existingRounds.some((r) => r.finalized === true);
    if (hasFinalized) {
      return NextResponse.json(
        { error: "Cannot create new round: participant already assigned" },
        { status: 400 }
      );
    }

    // Keep scheduledStart logic commented for now
    // const scheduledStart = body.scheduledStart ? new Date(body.scheduledStart) : new Date();

    const participantObjId = new ObjectId(participantId.toString());

    // Full manual admin controls for now
    // Create the round
    const round = {
      participantId: participantObjId,
      status: "scheduled" as const, // rounds should start as scheduled
      scheduledStart: null, // placeholder; admin will start manually
      timerEnd: null, // timer set when round starts
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
      finalized: !!round.finalized,
      timerEnd: round.timerEnd ? round.timerEnd.toISOString() : null,
      scheduledStart: round.scheduledStart ? round.scheduledStart.toISOString() : null,
      winningBid: round.winningBid || null,
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
