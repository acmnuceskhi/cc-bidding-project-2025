import { NextRequest, NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { verifyAuth, hasRole } from "@/lib/auth";

// POST /api/rounds/:id/start - Start a round (Admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Only admins can start rounds
    if (!hasRole(authResult.payload, "admin")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

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
      roundId: id,
      message: "Round started successfully"
    });
  } catch (error) {
    console.error("Error starting round:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}