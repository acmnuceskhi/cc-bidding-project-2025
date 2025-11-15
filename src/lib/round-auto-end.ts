import { Rounds } from "./models/rounds";
import { Bids } from "./models/bids";
import { Houses } from "./models/houses";
import clientPromise from "./mongodb";
import { ObjectId } from "mongodb";

/**
 * Auto-end a round if it has expired
 * Returns true if round was auto-ended, false otherwise
 */
export async function checkAndAutoEndExpiredRound(): Promise<boolean> {
  try {
    const activeRounds = await Rounds.getActive();

    if (activeRounds.length === 0) {
      return false;
    }

    const activeRound = activeRounds[0];
    const now = Date.now();
    const timerEnd = activeRound.timerEnd?.getTime();

    if (
      !timerEnd ||
      now < timerEnd ||
      activeRound.status !== "active" ||
      activeRound.finalized
    ) {
      return false;
    }

    if (process.env.NODE_ENV === "development") {
      console.log(
        "⏰ Round expired - auto-ending on server side:",
        activeRound._id?.toString()
      );
    }

    const client = await clientPromise;

    const markResult = await client
      .db()
      .collection("rounds")
      .findOneAndUpdate(
        {
          _id: new ObjectId(activeRound._id!),
          status: "active",
          finalized: { $ne: true },
        },
        {
          $set: {
            status: "processing",
          },
        },
        { returnDocument: "after" }
      );

    if (!markResult) {
      if (process.env.NODE_ENV === "development") {
        console.log(
          "⏭️ Round already being processed by another request, skipping"
        );
      }
      return false;
    }

    const bids = await Bids.getLatestBidPerHouseForRound(
      activeRound._id!.toString()
    );

    if (bids.length === 0) {
      await Rounds.update(activeRound._id!.toString(), {
        status: "completed",
        timerEnd: new Date(),
        finalized: false,
        winningBid: undefined,
        skipped: true,
      });
      return true;
    }

    const winningBid = bids.reduce((winner, current) => {
      if (current.amount > winner.amount) return current;
      if (
        current.amount === winner.amount &&
        current.timestamp < winner.timestamp
      )
        return current;
      return winner;
    });

    const winningHouse = await Houses.getById(winningBid.houseId.toString());

    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        const db = client.db();

        if (winningBid) {
          await db
            .collection("houses")
            .updateOne(
              { _id: new ObjectId(winningBid.houseId) },
              { $inc: { remainingBudget: -winningBid.amount } },
              { session }
            );
        }

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

        if (winningHouse) {
          await db
            .collection("teams")
            .updateOne(
              { _id: new ObjectId(activeRound.teamId) },
              { $set: { houseId: winningHouse._id } },
              { session }
            );

          await db
            .collection("participants")
            .updateMany(
              { teamId: new ObjectId(activeRound.teamId) },
              { $set: { houseId: winningHouse._id } },
              { session }
            );
        }
      });

      if (process.env.NODE_ENV === "development") {
        console.log("✅ Round auto-ended successfully");
      }
      return true;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error("❌ Error auto-ending round:", error);
    return false;
  }
}

