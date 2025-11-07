import { NextRequest, NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { Houses } from "@/lib/models/houses";
import { verifyAuth, hasRole } from "@/lib/auth";
import { ObjectId } from "mongodb";

// Constants and types
const ROUND_DURATION_MS = 60000; // 1 minute
type UpdateResult = { matchedCount: number };

// POST /api/rounds/[id]/restart - Restart a round (Admin only)
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

    // Only admin can restart rounds
    if (!hasRole(authResult.payload, "admin")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { id } = params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid or missing round ID" },
        { status: 400 }
      );
    }

    const round = await Rounds.getById(id);
    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    // Prevent restart if round is active or completed
    if (round.status === "active" || round.status === "completed") {
      return NextResponse.json(
        { error: `Cannot restart a round with status: ${round.status}` },
        { status: 400 }
      );
    }

    // Refund previous winning bids
    if (round.bids?.length) {
    for (const bid of round.bids) {
        // Type assertion to bypass missing 'isWinning' in type
        const winningBid = bid as any & { isWinning?: boolean; houseId?: string; amount?: number };

        if (winningBid.isWinning && winningBid.houseId && winningBid.amount != null) {
            await Houses.update(winningBid.houseId.toString(), {
                $inc: { remainingBudget: winningBid.amount },
        });
    }
    }
    }

    const previousBids = round.bids || [];
    const newScheduledStart = new Date();
    const newTimerEnd = new Date(newScheduledStart.getTime() + ROUND_DURATION_MS);

    const result = await Rounds.update(roundId, {
      status: "scheduled",
      scheduledStart: newScheduledStart,
      timerEnd: newTimerEnd,
      previousBids,
      bids: [],
      rerunCount: (round.rerunCount || 0) + 1,
      rerunReason: "manual_restart",
    }) as UpdateResult;

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Failed to restart round" },
        { status: 500 }
      );
    }

    const updatedRound = await Rounds.getById(roundId);

    console.log(`Round ${id} restarted at ${newScheduledStart.toISOString()}`);

    return NextResponse.json({
      success: true,
      round: updatedRound,
      message: "Round restarted successfully",
    });
  } catch (error) {
    console.error("Error restarting round:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
