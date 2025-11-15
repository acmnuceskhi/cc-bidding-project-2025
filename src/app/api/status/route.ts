import { NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { Teams } from "@/lib/models/teams";
import { Participants } from "@/lib/models/participants";
import { Bids } from "@/lib/models/bids";

// GET /api/status - Get current status for projector display
export async function GET() {
  try {
    // Get the currently active round (assuming only one active round at a time)
    const activeRounds = await Rounds.getActive();

    // Fetch all participants once for member count calculations
    const allParticipants = await Participants.getAll();
    
    // Helper function to get member count for a team
    const getMemberCount = (teamId: string) => {
      return allParticipants.filter(
        (p) => p.teamId?.toString() === teamId
      ).length;
    };

    // Always compute phase counts and unsold teams for dashboard context
    const [allRoundsForCounts, unsoldTeams] = await Promise.all([
      Rounds.getAll(),
      Teams.getAll().then((list) =>
        list.filter((t) => !(t as any).houseId)
      ),
    ]);

    const phaseCounts = {
      pass1: { total: 0, scheduled: 0, active: 0, completed: 0 },
      pass2: { total: 0, scheduled: 0, active: 0, completed: 0 },
    } as const;
    const counts: any = {
      pass1: { total: 0, scheduled: 0, active: 0, completed: 0 },
      pass2: { total: 0, scheduled: 0, active: 0, completed: 0 },
    };

    for (const r of allRoundsForCounts) {
      const phaseKey = (r.passPhase === 2 ? "pass2" : "pass1") as
        | "pass1"
        | "pass2";
      counts[phaseKey].total += 1;
      if (r.status === "scheduled") counts[phaseKey].scheduled += 1;
      else if (r.status === "active") counts[phaseKey].active += 1;
      else if (r.status === "completed") counts[phaseKey].completed += 1;
    }

    if (activeRounds.length === 0) {
      return NextResponse.json({
        roundId: null,
        team: null,
        roundStatus: "idle",
        timerRemaining: 0,
        bidsPlaced: [],
        serverTime: Date.now(),
        phaseCounts: counts,
        unsoldTeams: unsoldTeams.map((t) => ({
          teamId: t._id?.toString(),
          rank: t.rank,
          batch: t.batch ?? null,
          memberCount: getMemberCount(t._id?.toString() || ""),
        })),
      });
    }

    const activeRound = activeRounds[0];

    // SERVER-SIDE AUTO-END: Check if round has expired
    const now = Date.now();
    const timerEnd = activeRound.timerEnd?.getTime();

    // SERVER-SIDE AUTO-END: Check if round has expired and is still active and not finalized
    if (
      timerEnd &&
      now >= timerEnd &&
      activeRound.status === "active" &&
      !activeRound.finalized
    ) {
      console.log(
        "⏰ Round expired - auto-ending on server side:",
        activeRound._id?.toString()
      );

      // Import the end round logic
      const { Houses } = await import("@/lib/models/houses");
      const clientPromise = (await import("@/lib/mongodb")).default;

      try {
        const client = await clientPromise;
        const { ObjectId } = await import("mongodb");

        // ATOMIC CHECK: Try to mark round as "processing" to prevent race conditions
        const markResult = await client
          .db()
          .collection("rounds")
          .findOneAndUpdate(
            {
              _id: new ObjectId(activeRound._id!),
              status: "active", // Only update if still active
              finalized: { $ne: true }, // And not already finalized
            },
            {
              $set: {
                status: "processing", // Temporary status to lock the round
              },
            },
            { returnDocument: "after" }
          );

        // If we couldn't mark it (another request beat us), skip auto-end
        if (!markResult) {
          console.log(
            "⏭️ Round already being processed by another request, skipping"
          );
          return NextResponse.json({
            roundId: null,
            participant: null,
            roundStatus: "idle",
            timerRemaining: 0,
            bidsPlaced: [],
            serverTime: Date.now(),
          });
        }

        // Get only the LATEST bid from each house for this round
        const bids = await Bids.getLatestBidPerHouseForRound(
          activeRound._id!.toString()
        );

        // 🚫 No bids case — mark as completed & skipped
        if (bids.length === 0) {
          await Rounds.update(activeRound._id!.toString(), {
            status: "completed",
            timerEnd: new Date(),
            finalized: false,
            winningBid: undefined,
            skipped: true,
          });

          return NextResponse.json({
            roundId: null,
            participant: null,
            roundStatus: "completed",
            timerRemaining: 0,
            bidsPlaced: [],
            roundEnded: true,
            winner: null,
            skipped: true,
            serverTime: Date.now(),
          });
        }

        // Find the winning bid
        let winningBid = null;
        let winningHouse = null;

        if (bids.length > 0) {
          winningBid = bids.reduce((winner, current) => {
            if (current.amount > winner.amount) return current;
            if (
              current.amount === winner.amount &&
              current.timestamp < winner.timestamp
            )
              return current;
            return winner;
          });

          winningHouse = await Houses.getById(winningBid.houseId.toString());
        }

        // ESCROW LOGIC: Deduct ONLY from winner (no refunds needed)
        const session = client.startSession();

        try {
          await session.withTransaction(async () => {
            const db = client.db();

            // Deduct budget from winning house ONLY
            if (winningBid) {
              await db
                .collection("houses")
                .updateOne(
                  { _id: new ObjectId(winningBid.houseId) },
                  { $inc: { remainingBudget: -winningBid.amount } },
                  { session }
                );
            }

            // Update round status to completed
            await db.collection("rounds").updateOne(
              { _id: new ObjectId(activeRound._id!) },
              {
                $set: {
                  status: "completed",
                  timerEnd: new Date(),
                  finalized: !!winningHouse,
                  winningBid: winningBid ? winningBid.amount : null,
                  skipped: !winningHouse,
                },
              },
              { session }
            );

            // Assign team and all its participants if sold
            if (winningHouse) {
              // Assign the team
              await db
                .collection("teams")
                .updateOne(
                  { _id: new ObjectId(activeRound.teamId) },
                  { $set: { houseId: winningHouse._id } },
                  { session }
                );
              
              // Assign all participants in the team
              await db
                .collection("participants")
                .updateMany(
                  { teamId: new ObjectId(activeRound.teamId) },
                  { $set: { houseId: winningHouse._id } },
                  { session }
                );
            }
          });

          console.log("✅ Round auto-ended successfully");

          // Real-time updates handled by polling
        } finally {
          await session.endSession();
        }

        // Return status showing round ended
        return NextResponse.json({
          roundId: null,
          participant: null,
          roundStatus: "completed",
          timerRemaining: 0,
          bidsPlaced: [],
          roundEnded: true,
          winner: winningHouse
            ? {
                houseName: winningHouse.name,
                amount: winningBid!.amount,
              }
            : null,
          skipped: !winningHouse,
          winningBid: winningHouse ? winningBid!.amount : null,
          serverTime: Date.now(),
        });
      } catch (autoEndError) {
        console.error("❌ Error auto-ending round:", autoEndError);
        // Continue with normal status response if auto-end fails
      }
    }

    // Fetch team info
    const team = await Teams.getById(
      activeRound.teamId.toString()
    );

    // Fetch all bids for the current round (not participant — as per logical flow)
    const roundBids = await Bids.getByRound(activeRound._id!.toString());

    // Calculate remaining time in seconds
    const currentTime = Date.now();
    const roundTimerEnd = activeRound.timerEnd?.getTime();
    const timerRemaining = roundTimerEnd
      ? Math.max(0, Math.floor((roundTimerEnd - currentTime) / 1000))
      : 0;

    // Collect houses that have placed bids with amounts
    const bidsPlaced = roundBids.map((bid) => ({
      houseId: bid.houseId.toString(),
      amount: bid.amount,
    }));

    // Calculate round number (count of all completed + active rounds)
    const allRounds = await Rounds.getAll();
    const completedOrActiveRounds = allRounds.filter(
      (r) => r.status === "completed" || r.status === "active"
    );
    const roundNumber = completedOrActiveRounds.length;

    return NextResponse.json({
      roundId: activeRound._id?.toString(),
      team: team
        ? {
            teamId: team._id?.toString(),
            rank: team.rank,
            batch: team.batch ?? null,
            memberCount: getMemberCount(team._id?.toString() || ""),
            successfulAttempts: team.successfulAttempts,
            totalPoints: team.totalPoints,
          }
        : null,
      roundStatus: activeRound.status,
      roundNumber,
      timerRemaining,
      timerEnd: activeRound.timerEnd?.toISOString(), // Add actual end time
      bidsPlaced,
      serverTime: Date.now(),
      phaseCounts: counts,
      unsoldTeams: unsoldTeams.map((t) => ({
        teamId: t._id?.toString(),
        rank: t.rank,
        batch: t.batch ?? null,
        memberCount: getMemberCount(t._id?.toString() || ""),
      })),
    });
  } catch (error) {
    console.error("Error fetching status:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
