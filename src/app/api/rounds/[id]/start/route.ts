import { NextRequest, NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { Teams } from "@/lib/models/teams";
import { verifyAuth, hasRole } from "@/lib/auth";
import { getSocketInstance } from "@/lib/socket-instance";

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
        // Check if there are completed rounds that could be restarted
        const completedRounds = allRounds.filter((r) => r.status === "completed");
        console.log(`No scheduled rounds. Total rounds: ${allRounds.length}, Completed: ${completedRounds.length}`);
        
        return NextResponse.json(
          { 
            error: "No scheduled rounds available to start",
            debug: {
              totalRounds: allRounds.length,
              scheduledRounds: 0,
              completedRounds: completedRounds.length
            }
          },
          { status: 404 }
        );
      }

      // Find the first scheduled round with a team that hasn't been sold yet
      let nextRound = null;
      let team = null;
      let roundNumber = 0;
      const skippedTeams: string[] = [];

      for (let i = 0; i < scheduledRounds.length; i++) {
        const round = scheduledRounds[i];
        const t = await Teams.getById(round.teamId.toString());

        if (!t) {
          console.log(
            "Team not found for round:",
            round._id?.toString()
          );
          skippedTeams.push(`Round ${i + 1}: Team not found`);
          continue;
        }

        // Check if team already has a house (already sold)
        if (t.houseId) {
          console.log(
            "Skipping round",
            i + 1,
            "(Team already assigned to house:",
            t.houseId.toString() + ")"
          );
          skippedTeams.push(`Team ${t.rank}: Already sold to house ${t.houseId.toString()}`);
          continue;
        }

        // Found an unsold team
        nextRound = round;
        team = t;
        roundNumber = i + 1;
        console.log(
          "Starting round",
          roundNumber,
          "(Round ID:",
          round._id?.toString() + ")"
        );
        break;
      }

      if (!nextRound || !team) {
        console.log("No unsold teams found. Skipped teams:", skippedTeams);
        return NextResponse.json(
          { 
            error: "No unsold teams available for bidding",
            debug: {
              scheduledRounds: scheduledRounds.length,
              skippedTeams
            }
          },
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

    // Get round duration from config
    const { Config } = await import("@/lib/models/config");
    const config = await Config.get();
    // Add 3 second buffer to compensate for network/processing latency
    const durationMs = (config.roundDurationSeconds + 3) * 1000;
    const timerEnd = new Date(Date.now() + durationMs);

    // Update the round
    const result = await Rounds.update(targetRoundId, {
      status: "active",
      timerEnd,
      scheduledStart: new Date(),
    });

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    // Get team info for socket event
    const team = await Teams.getById(round.teamId.toString());

    // Emit socket events to notify all clients
    const io = getSocketInstance();
    if (io) {
      // Emit round-started event
      io.emit("round-started", {
        roundId: targetRoundId,
        timerEnd: timerEnd.toISOString(),
      });
      
      // Emit state-update event (will trigger clients to fetch fresh state)
      io.emit("state-update", {
        screen: "bidding",
        roundId: targetRoundId,
        teamId: team?._id?.toString() || round.teamId.toString(),
        timeLeft: durationMs,
      });
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
