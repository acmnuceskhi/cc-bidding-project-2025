import { NextRequest, NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { Participants } from "@/lib/models/participants";
import { verifyAuth, hasRole } from "@/lib/auth";

// interface filteredRound {
//   roundId: string; // matches MongoDB _id
//   participantId: string;
//   status: "scheduled" | "active" | "completed"; // matches schema
//   finalized?: boolean;
//   timerEnd?: string; // string from API, parse to Date
//   scheduledStart?: string; // string from API, parse to Date
// }

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
      // const baseUrl =
      //   process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      // const roundsResponse = await fetch(`${baseUrl}/api/rounds`, {
      //   headers: request.headers,
      // });

      // if (!roundsResponse.ok) {
      //   return NextResponse.json(
      //     { error: "Failed to fetch rounds list" },
      //     { status: 500 }
      //   );
      // }

      // const allRounds = await roundsResponse.json();
      // const nextRound = allRounds.find(
      //   (r: filteredRound) => r.status === "scheduled" && !r.finalized
      // );

      // if (!nextRound) {
      //   return NextResponse.json(
      //     { error: "No scheduled round available to start" },
      //     { status: 404 }
      //   );
      // }

      // targetRoundId = nextRound._id || nextRound.roundId;
      const activeRounds = await Rounds.getActive();
      if (activeRounds.length > 0) {
        return NextResponse.json(
          { error: "Cannot start new round: another round is already active" },
          { status: 400 }
        );
      }

      // Get all scheduled rounds sorted by creation order (_id ascending)
      const allRounds = await Rounds.getAll();
      const scheduledRounds = allRounds
        .filter((r) => r.status === "scheduled")
        .sort((a, b) => {
          // Sort by _id (creation time) ascending - oldest first
          const aId = a._id?.toString() || "";
          const bId = b._id?.toString() || "";
          return aId.localeCompare(bId);
        });

      if (scheduledRounds.length === 0) {
        return NextResponse.json(
          { error: "No scheduled rounds available to start" },
          { status: 404 }
        );
      }

      // Find the first scheduled round with a participant that hasn't been sold yet
      let nextRound = null;
      let participant = null;

      for (const round of scheduledRounds) {
        const p = await Participants.getById(round.participantId.toString());

        if (!p) {
          console.log(
            "Participant not found for round:",
            round._id?.toString()
          );
          continue;
        }

        // Check if participant already has a house (already sold)
        if (p.houseId) {
          console.log(
            "Skipping participant",
            p.name,
            "- already assigned to house:",
            p.houseId.toString()
          );
          continue;
        }

        // Found an unsold participant
        nextRound = round;
        participant = p;
        console.log(
          "Starting next scheduled round:",
          round._id?.toString(),
          "for participant:",
          p.name
        );
        break;
      }

      if (!nextRound || !participant) {
        return NextResponse.json(
          { error: "No unsold participants available for bidding" },
          { status: 404 }
        );
      }

      targetRoundId = nextRound._id!.toString();
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
    // const BIDDING_DURATION_MS = 40000;
    // const RESULT_DURATION_MS = 20000;
    const timerEnd = new Date(Date.now() + 60 * 1000);

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
