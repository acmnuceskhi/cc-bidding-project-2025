/**
 * Reset Auction Script
 *
 * This script resets the auction system to its initial state:
 * - Resets all rounds to "scheduled" status with passPhase = 1
 * - Clears all bids
 * - Clears all locks
 * - Resets house budgets to their original amounts
 * - Clears team house assignments (bidding is team-based, not participant-based)
 * - Resets config (if needed)
 *
 * Usage: RUN_RESET_AUCTION=true npm run reset-auction
 */
import { config } from "dotenv";
import path from "path";
// Load env like seed-test-data
config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });
import clientPromise from "@/lib/mongodb";

async function resetAuction() {
  try {
    console.log("🔄 Starting auction reset...\n");

    const client = await clientPromise;
    const db = client.db();

    // 1. Reset all rounds to "scheduled" status with passPhase = 1
    console.log("📋 Resetting rounds...");
    const roundsResult = await db.collection("rounds").updateMany(
      {},
      {
        $set: {
          status: "scheduled",
          passPhase: 1,
          timerEnd: null,
          finalized: false,
          winningBid: null,
        },
        $unset: {
          scheduledStart: "",
        },
      }
    );
    console.log(
      `   ✅ Reset ${roundsResult.modifiedCount} rounds to scheduled status (passPhase 1)\n`
    );

    // 2. Delete all bids
    console.log("💰 Clearing bids...");
    const bidsResult = await db.collection("bids").deleteMany({});
    console.log(`   ✅ Deleted ${bidsResult.deletedCount} bids\n`);

    // 3. Clear all locks
    console.log("🔒 Clearing locks...");
    const locksResult = await db.collection("_locks").deleteMany({});
    console.log(`   ✅ Deleted ${locksResult.deletedCount} locks\n`);

    // 4. Reset house budgets to original amounts
    console.log("🏯 Resetting house budgets...");
    const houses = await db.collection("houses").find({}).toArray();
    let housesUpdated = 0;

    for (const house of houses) {
      await db.collection("houses").updateOne(
        { _id: house._id },
        {
          $set: {
            remainingBudget: house.totalBudget,
          },
        }
      );
      housesUpdated++;
      console.log(`   ✅ Reset ${house.name}: $${house.totalBudget}`);
    }
    console.log(`   ✅ Reset ${housesUpdated} house budgets\n`);

    // 5. Clear team house assignments
    console.log("🏆 Clearing team assignments...");
    const teamsResult = await db.collection("teams").updateMany(
      {},
      {
        $set: {
          houseId: null,
        },
      }
    );
    console.log(
      `   ✅ Cleared ${teamsResult.modifiedCount} team assignments\n`
    );

    // 6. Reset config (set auction to not started)
    console.log("⚙️  Resetting config...");
    await db.collection("config").updateOne(
      {},
      {
        $set: {
          auctionStarted: false,
          currentRoundId: null,
        },
      },
      { upsert: true }
    );
    console.log(`   ✅ Reset auction config\n`);

    // Summary
    console.log("✨ Auction reset complete!\n");
    console.log("Summary:");
    console.log(`  - ${roundsResult.modifiedCount} rounds reset to scheduled (passPhase 1)`);
    console.log(`  - ${bidsResult.deletedCount} bids cleared`);
    console.log(`  - ${locksResult.deletedCount} locks cleared`);
    console.log(`  - ${housesUpdated} house budgets restored`);
    console.log(`  - ${teamsResult.modifiedCount} team assignments cleared`);
    console.log(`  - Config reset (auctionStarted = false)`);
    console.log("\n🎯 Ready for a fresh auction!\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error resetting auction:", error);
    process.exit(1);
  }
}

// When running directly with RUN_RESET_AUCTION=true
if (process.env.RUN_RESET_AUCTION === "true") {
  resetAuction();
} else {
  console.log("⚠️  Set RUN_RESET_AUCTION=true to run this script");
  console.log("Example: RUN_RESET_AUCTION=true npm run reset-auction");
  process.exit(0);
}
