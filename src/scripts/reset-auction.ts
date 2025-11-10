/**
 * Reset Auction Script
 *
 * This script resets the auction system to its initial state:
 * - Resets all rounds to "scheduled" status
 * - Clears all bids
 * - Resets house budgets to their original amounts
 * - Clears participant house assignments
 *
 * Usage: npx tsx src/scripts/reset-auction.ts
 */

import clientPromise from "@/lib/mongodb";

async function resetAuction() {
  try {
    console.log("🔄 Starting auction reset...\n");

    const client = await clientPromise;
    const db = client.db();

    // 1. Reset all rounds to "scheduled" status
    console.log("📋 Resetting rounds...");
    const roundsResult = await db.collection("rounds").updateMany(
      {},
      {
        $set: {
          status: "scheduled",
          timerEnd: null,
          finalized: false,
          winningBid: null,
        },
      }
    );
    console.log(
      `   ✅ Reset ${roundsResult.modifiedCount} rounds to scheduled status\n`
    );

    // 2. Delete all bids
    console.log("💰 Clearing bids...");
    const bidsResult = await db.collection("bids").deleteMany({});
    console.log(`   ✅ Deleted ${bidsResult.deletedCount} bids\n`);

    // 3. Reset house budgets to original amounts
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

    // 4. Clear participant house assignments
    console.log("👥 Clearing participant assignments...");
    const participantsResult = await db.collection("participants").updateMany(
      {},
      {
        $unset: {
          houseId: "",
        },
      }
    );
    console.log(
      `   ✅ Cleared ${participantsResult.modifiedCount} participant assignments\n`
    );

    // Summary
    console.log("✨ Auction reset complete!\n");
    console.log("Summary:");
    console.log(`  - ${roundsResult.modifiedCount} rounds reset to scheduled`);
    console.log(`  - ${bidsResult.deletedCount} bids cleared`);
    console.log(`  - ${housesUpdated} house budgets restored`);
    console.log(
      `  - ${participantsResult.modifiedCount} participant assignments cleared`
    );
    console.log("\n🎯 Ready for a fresh auction!\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error resetting auction:", error);
    process.exit(1);
  }
}

resetAuction();
