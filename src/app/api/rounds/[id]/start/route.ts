import { NextRequest, NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { verifyAuth, hasRole } from "@/lib/auth";

// POST /api/rounds/:id/start - Start a round (Admin only)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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

  const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Missing round ID" }, { status: 400 });
    }

    const round = await Rounds.getById(id);
    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    if (round.finalized) {
      return NextResponse.json(
        { error: "Cannot start a finalized round" },
        { status: 400 }
      );
    }

    if (round.status === "active") {
      return NextResponse.json(
        { error: "Round is already active" },
        { status: 400 }
      );
    }

    // 40 seconds bidding + 10 seconds result display
    const BIDDING_DURATION_MS = 40000;
    const RESULT_DURATION_MS = 10000;

    const timerEnd = new Date(Date.now() + BIDDING_DURATION_MS + RESULT_DURATION_MS); // 1 minute

    // Update the round to active status
    const result = await Rounds.update(id, {
      status: "active",
      timerEnd,
      scheduledStart: new Date(), // record actual start time (manual operation for now)
    });

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      roundId: id,
      timerEnd: timerEnd.toISOString(),
      message: "Round started successfully",
    });
  } catch (error) {
    console.error("Error starting round:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
