import { NextRequest, NextResponse } from "next/server";
import { Participants } from "@/lib/models/participants";
import { verifyAuth } from "@/lib/auth";

// GET /api/participants - Get all participants
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

    const participants = await Participants.getAll();

    // Transform to include only required fields
    const filteredParticipants = participants.map((participant) => ({
      participantId: participant._id?.toString(),
      name: participant.name,
      picture: participant.picture || "url",
      houseId: participant.houseId ? participant.houseId.toString() : null,
      roundStats: participant.roundStats?.map((stat) => ({
        roundId: stat.roundId.toString(),
        bidAmount: stat.bidAmount,
        winner: stat.winner,
      })) || [],
    }));

    return NextResponse.json(filteredParticipants);
  } catch (error) {
    console.error("Error fetching participants:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/participants - Create a new participant (admin only)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, picture, teamId } = body;

    // Validate input
    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    // Create the participant
    const participant = {
      name,
      picture: picture || "",
      roundStats: [],
      teamId: teamId || null,
      rollNumber: ""
    };

    const result = await Participants.create(participant);

    return NextResponse.json({
      success: true,
      participant: {
        ...participant,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("Error creating participant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
