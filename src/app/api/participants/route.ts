import { NextResponse } from "next/server";
import { Participants } from "@/lib/models/participants";

// GET /api/participants - Get all participants
export async function GET() {
  try {
    const participants = await Participants.getAll();
    return NextResponse.json(participants);
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
    const { name, picture } = body;

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
      roundStats: []
    };

    const result = await Participants.create(participant);

    return NextResponse.json({
      success: true,
      participant: {
        ...participant,
        _id: result.insertedId
      }
    });
  } catch (error) {
    console.error("Error creating participant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}