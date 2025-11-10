import { NextRequest, NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { Participants } from "@/lib/models/participants";
import { verifyAuth, hasRole } from "@/lib/auth";

// POST /api/rounds/next/start - Start the next scheduled round (Admin only)
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

    // Only admins can start rounds
    if (!hasRole(authResult.payload, "admin")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Check if there's already an active round
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
        console.log("Participant not found for round:", round._id?.toString());
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

    // Start the round with 60-second timer
    const timerEnd = new Date(Date.now() + 60 * 1000);

    await Rounds.update(nextRound._id!.toString(), {
      status: "active",
      timerEnd,
    });

    // Emit socket event for real-time updates
    try {
      const { getIO } = await import("@/lib/socket-server");
      const io = getIO();
      io.emit("round-started", {
        roundId: nextRound._id?.toString(),
        participant: {
          participantId: participant._id?.toString(),
          name: participant.name,
          picture: participant.picture,
        },
        timerEnd: timerEnd.toISOString(),
      });
    } catch (socketError) {
      console.log(
        "Socket.IO not available or error emitting event:",
        socketError
      );
    }

    return NextResponse.json({
      success: true,
      roundId: nextRound._id?.toString(),
      participantId: participant._id?.toString(),
      participantName: participant.name,
      timerEnd: timerEnd.toISOString(),
      message: `Round started for ${participant.name}`,
    });
  } catch (error) {
    console.error("Error starting next round:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
