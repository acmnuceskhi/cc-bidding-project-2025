import { NextRequest, NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { verifyAuth, hasRole } from "@/lib/auth";

interface filteredRound {
  roundId: string; // matches MongoDB _id
  participantId: string;
  status: "scheduled" | "active" | "completed"; // matches schema
  finalized?: boolean;
  timerEnd?: string; // string from API, parse to Date
  scheduledStart?: string; // string from API, parse to Date
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

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

    let targetRoundId = id;

    // If admin requests "next", automatically start the next scheduled round
    if (id === "next") {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      const roundsResponse = await fetch(`${baseUrl}/api/rounds`, {
        headers: request.headers,
      });

      if (!roundsResponse.ok) {
        return NextResponse.json(
          { error: "Failed to fetch rounds list" },
          { status: 500 }
        );
      }

      const allRounds = await roundsResponse.json();
      const nextRound = allRounds.find(
        (r: filteredRound) => r.status === "scheduled" && !r.finalized
      );

      if (!nextRound) {
        return NextResponse.json(
          { error: "No scheduled round available to start" },
          { status: 404 }
        );
      }

      targetRoundId = nextRound._id || nextRound.roundId;
    }

    const round = await Rounds.getById(targetRoundId);
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

    // Define timer durations
    const BIDDING_DURATION_MS = 40000;
    const RESULT_DURATION_MS = 10000;
    const timerEnd = new Date(Date.now() + BIDDING_DURATION_MS + RESULT_DURATION_MS);

    // Update the round
    const result = await Rounds.update(targetRoundId, {
      status: "active",
      timerEnd,
      scheduledStart: new Date(),
    });

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      roundId: targetRoundId,
      timerEnd: timerEnd.toISOString(),
      message: "Round started successfully",
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
