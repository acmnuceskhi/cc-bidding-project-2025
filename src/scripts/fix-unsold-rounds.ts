/**
 * Fix rounds that are completed but have unsold teams
 * Reset them to scheduled status so they can be started again
 * Run with: npx tsx src/scripts/fix-unsold-rounds.ts
 */

import clientPromise from "../lib/mongodb";

async function fixUnsoldRounds() {
  try {
    const client = await clientPromise;
    const db = client.db();

    console.log("\n=== Fixing Unsold Rounds ===\n");

    // Get all rounds
    const rounds = await db
      .collection("rounds")
      .find({})
      .sort({ _id: 1 })
      .toArray();

    // Get all teams
    const teams = await db.collection("teams").find({}).toArray();
    const teamsMap = new Map(teams.map((t) => [t._id.toString(), t]));

    // Find completed rounds with unsold teams
    const roundsToFix = rounds.filter((r) => {
      if (r.status !== "completed") return false;
      const team = teamsMap.get(r.teamId.toString());
      return team && !team.houseId;
    });

    if (roundsToFix.length === 0) {
      console.log("✅ No rounds need fixing. All completed rounds have sold teams.");
      process.exit(0);
    }

    console.log(`Found ${roundsToFix.length} rounds to fix:\n`);

    for (const round of roundsToFix) {
      const team = teamsMap.get(round.teamId.toString());
      console.log(
        `  - Round ${round._id.toString().slice(-6)} | Team #${team?.rank} | Resetting to scheduled`
      );

      // Reset to scheduled status
      await db.collection("rounds").updateOne(
        { _id: round._id },
        {
          $set: {
            status: "scheduled",
            timerEnd: null,
            finalized: false,
            skipped: true, // Keep track that it was attempted
          },
        }
      );
    }

    console.log(`\n✅ Fixed ${roundsToFix.length} rounds. They can now be started again.`);
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixUnsoldRounds();
