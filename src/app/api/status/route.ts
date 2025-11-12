import { NextResponse } from "next/server";
import { Rounds } from "@/lib/models/rounds";
import { Participants } from "@/lib/models/participants";
import { Bids } from "@/lib/models/bids";

// GET /api/status - Get current status for projector display
export async function GET() {
  try {
    // Get the currently active round (assuming only one active round at a time)
    const activeRounds = await Rounds.getActive();

    if (activeRounds.length === 0) {
      return NextResponse.json({
        roundId: null,
        participant: null,
        roundStatus: "idle",
        timerRemaining: 0,
        bidsPlaced: [],
        serverTime: Date.now(),
      });
    }

    const activeRound = activeRounds[0];

    // SERVER-SIDE AUTO-END: Check if round has expired
    const now = Date.now();
    const timerEnd = activeRound.timerEnd?.getTime();

    // SERVER-SIDE AUTO-END: Check if round has expired and is still active
    if (timerEnd && now >= timerEnd && activeRound.status === "active") {
      console.log(
        "⏰ Round expired - auto-ending on server side:",
        activeRound._id?.toString()
      );

      // Import the end round logic
      const { Houses } = await import("@/lib/models/houses");
      const clientPromise = (await import("@/lib/mongodb")).default;
      const { ObjectId } = await import("mongodb");

      try {
        // Get all bids for this round
        const bids = await Bids.getByRound(activeRound._id!.toString());

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

        // Use transaction to end the round
        const client = await clientPromise;
        const session = client.startSession();

        try {
          await session.withTransaction(async () => {
            const db = client.db();

            // Refund losing bids
            if (winningBid) {
              const losingBids = bids.filter(
                (b) => b._id?.toString() !== winningBid!._id?.toString()
              );
              for (const lb of losingBids) {
                await db
                  .collection("houses")
                  .updateOne(
                    { _id: new ObjectId(lb.houseId) },
                    { $inc: { remainingBudget: lb.amount } },
                    { session }
                  );
              }
            }

            // Update round status
            await db.collection("rounds").updateOne(
              { _id: new ObjectId(activeRound._id!) },
              {
                $set: {
                  status: "completed",
                  timerEnd: new Date(),
                  finalized: !!winningHouse,
                  winningBid: winningBid ? winningBid.amount : null,
                },
              },
              { session }
            );

            // Assign participant if sold
            if (winningHouse) {
              await db
                .collection("participants")
                .updateOne(
                  { _id: new ObjectId(activeRound.participantId) },
                  { $set: { houseId: winningHouse._id } },
                  { session }
                );
            }
          });

          console.log("✅ Round auto-ended successfully");

          // Emit socket event for real-time updates
          try {
            const { getIO } = await import("@/lib/socket-server");
            const io = getIO();
            io.emit("round-ended", {
              roundId: activeRound._id?.toString(),
              winner: winningHouse
                ? {
                    houseName: winningHouse.name,
                    amount: winningBid!.amount,
                  }
                : null,
            });
          } catch (socketError) {
            console.log(
              "Socket.IO not available or error emitting event:",
              socketError
            );
          }
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
        });
      } catch (autoEndError) {
        console.error("❌ Error auto-ending round:", autoEndError);
        // Continue with normal status response if auto-end fails
      }
    }

    // Fetch participant info
    const participant = await Participants.getById(
      activeRound.participantId.toString()
    );

    // Fetch all bids for the current round (not participant — as per logical flow)
    const roundBids = await Bids.getByRound(activeRound._id!.toString());

    // Calculate remaining time in seconds
    const currentTime = Date.now();
    const roundTimerEnd = activeRound.timerEnd?.getTime();
    const timerRemaining = roundTimerEnd
      ? Math.max(0, Math.floor((roundTimerEnd - currentTime) / 1000))
      : 0;

    // Collect houses that have placed bids (no amounts)
    const bidsPlaced = roundBids.map((bid) => ({
      houseId: bid.houseId.toString(),
    }));

    // Calculate round number (count of all completed + active rounds)
    const allRounds = await Rounds.getAll();
    const completedOrActiveRounds = allRounds.filter(
      (r) => r.status === "completed" || r.status === "active"
    );
    const roundNumber = completedOrActiveRounds.length;

    return NextResponse.json({
      roundId: activeRound._id?.toString(),
      participant: participant
        ? {
            participantId: participant._id?.toString(),
            name: participant.name,
            picture: participant.picture ?? null,
          }
        : null,
      roundStatus: activeRound.status,
      roundNumber,
      timerRemaining,
      timerEnd: activeRound.timerEnd?.toISOString(), // Add actual end time
      bidsPlaced,
      serverTime: Date.now(),
    });
  } catch (error) {
    console.error("Error fetching status:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
