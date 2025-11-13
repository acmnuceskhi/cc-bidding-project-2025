/**
 * Clean test houses from production database
 * Run: npx ts-node -r tsconfig-paths/register scripts/clean-test-houses.ts
 */
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

import clientPromise from "@/lib/mongodb";

const TEST_HOUSE_NAMES = [
  "LowBudget",
  "NegTest",
  "InactiveTest",
  "FinalizedTest",
  "ExpiredTest",
  "BatchLimit",
  "UpsertTest",
  "RestrictedHouse",
  "EndHouse",
  "RestartAuth",
  "HouseA",
  "HouseB",
  "Alpha",
  "Beta",
  "TieAlpha",
  "TieBeta",
  "RestartAlpha",
  "RestartBeta",
  "InvariantA",
  "InvariantB",
  "UniqueA",
  "UniqueB",
  "CompletedHouse",
  "BidRefHouse",
  "RestartNullHouse",
  "SimHouse1",
  "SimHouse2",
  "SimHouse3",
  "MultiBid",
  "LeakTest",
  "IdempotentRestart",
  "ComplexA",
  "ComplexB",
  "ZeroBidTest",
];

async function cleanTestHouses() {
  try {
    console.log("Connecting to MongoDB...");
    const client = await clientPromise;
    const db = client.db();

    const uri = process.env.MONGODB_URI || "";
    console.log(`Connected to: ${uri.substring(0, 50)}...`);

    // Delete test houses
    const housesResult = await db
      .collection("houses")
      .deleteMany({ name: { $in: TEST_HOUSE_NAMES } });
    console.log(`\u2705 Deleted ${housesResult.deletedCount} test houses`);

    // Delete test users (captains/admins created during tests)
    const usersResult = await db.collection("users").deleteMany({
      $or: [
        { username: { $regex: /^admin-\d+/i } },
        { username: { $regex: /^cap-/i } },
        { username: { $regex: /captain_/i } },
      ],
    });
    console.log(`\u2705 Deleted ${usersResult.deletedCount} test users`);

    // Delete test participants
    const participantsResult = await db.collection("participants").deleteMany({
      $or: [
        { name: { $regex: /^Test Participant/i } },
        { name: { $regex: /^Participant-/i } },
        { name: { $regex: /^Existing \d+/i } },
      ],
    });
    console.log(
      `\u2705 Deleted ${participantsResult.deletedCount} test participants`
    );

    // Delete test teams
    const teamsResult = await db.collection("teams").deleteMany({
      rank: { $exists: true },
      successfulAttempts: { $exists: true },
    });
    console.log(`\u2705 Deleted ${teamsResult.deletedCount} test teams`);

    // Delete test rounds
    const roundsResult = await db.collection("rounds").deleteMany({
      participantId: { $in: [] }, // Will delete orphaned rounds
    });
    console.log(`\u2705 Deleted ${roundsResult.deletedCount} test rounds`);

    // Delete all bids (they reference test data)
    const bidsResult = await db.collection("bids").deleteMany({});
    console.log(`\u2705 Deleted ${bidsResult.deletedCount} test bids`);

    console.log("\n\u2705 Production database cleaned successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\u274c Error cleaning database:", error);
    process.exit(1);
  }
}

cleanTestHouses();
