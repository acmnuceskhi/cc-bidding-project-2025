import { NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";

// POST /api/rounds/:id/start - Start a round
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
      modifiedCount: result.modifiedCount,
      timerEnd
    });
  } catch (error) {
    console.error("Error starting round:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}