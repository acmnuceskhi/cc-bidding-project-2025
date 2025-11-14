/**
 * Check rounds status and teams
 * Run with: npx tsx src/scripts/check-rounds.ts
 */

import clientPromise from "../lib/mongodb";
import { ObjectId } from "mongodb";

async function checkRounds() {
  try {
    const client = await clientPromise;
    const db = client.db();

    console.log("\n=== Checking Rounds Status ===\n");

    // Get all rounds
    const rounds = await db
      .collection("rounds")
      .find({})
      .sort({ _id: 1 })
      .toArray();

    console.log(`Total rounds: ${rounds.length}\n`);

    // Get all teams
    const teams = await db.collection("teams").find({}).toArray();
    const teamsMap = new Map(
      teams.map((t) => [t._id.toString(), t])
    );

    for (const round of rounds) {
      const team = teamsMap.get(round.teamId.toString());
      const teamRank = team?.rank || "?";
      const teamHouse = team?.houseId ? team.houseId.toString() : "none";

      console.log(
        `Round ${round._id.toString().slice(-6)} | Team #${teamRank} | Status: ${round.status} | Finalized: ${round.finalized || false} | Skipped: ${round.skipped || false} | Team HouseId: ${teamHouse}`
      );
    }

    // Count by status
    const scheduled = rounds.filter((r) => r.status === "scheduled").length;
    const active = rounds.filter((r) => r.status === "active").length;
    const completed = rounds.filter((r) => r.status === "completed").length;

    console.log(`\n=== Summary ===`);
    console.log(`Scheduled: ${scheduled}`);
    console.log(`Active: ${active}`);
    console.log(`Completed: ${completed}`);

    // Check for completed rounds with unsold teams
    const completedWithUnsoldTeams = rounds.filter((r) => {
      if (r.status !== "completed") return false;
      const team = teamsMap.get(r.teamId.toString());
      return team && !team.houseId;
    });

    if (completedWithUnsoldTeams.length > 0) {
      console.log(
        `\n⚠️  Found ${completedWithUnsoldTeams.length} completed rounds with unsold teams:`
      );
      for (const round of completedWithUnsoldTeams) {
        const team = teamsMap.get(round.teamId.toString());
        console.log(
          `  - Round ${round._id.toString().slice(-6)} | Team #${team?.rank} | Should be reset to scheduled`
        );
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkRounds();
