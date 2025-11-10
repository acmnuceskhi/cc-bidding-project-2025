/**
 * Full Reset Script
 *
 * This script performs a complete reset and re-initialization:
 * 1. Drops all collections
 * 2. Re-seeds houses, participants, users
 * 3. Creates fresh scheduled rounds for all participants
 *
 * Usage: npx tsx src/scripts/full-reset.ts
 */

import clientPromise from "@/lib/mongodb";
import bcrypt from "bcryptjs";

async function fullReset() {
  try {
    console.log("🔄 Starting full system reset...\n");

    const client = await clientPromise;
    const db = client.db();

    // 1. Drop all collections
    console.log("🗑️  Dropping all collections...");
    const collections = await db.listCollections().toArray();
    for (const collection of collections) {
      await db.collection(collection.name).drop();
      console.log(`   ✅ Dropped ${collection.name}`);
    }
    console.log();

    // 2. Create houses
    console.log("🏯 Creating houses...");
    const houses = [
      { name: "Lord Shen", totalBudget: 1000, remainingBudget: 1000 },
      { name: "Dragon Warrior", totalBudget: 1000, remainingBudget: 1000 },
      { name: "Master Oogway", totalBudget: 1000, remainingBudget: 1000 },
      { name: "Tai Lung", totalBudget: 1000, remainingBudget: 1000 },
    ];
    const housesResult = await db.collection("houses").insertMany(houses);
    const houseIds = Object.values(housesResult.insertedIds);
    console.log(`   ✅ Created ${houseIds.length} houses\n`);

    // 3. Create participants
    console.log("👥 Creating participants...");
    const participants = [];
    for (let i = 1; i <= 50; i++) {
      participants.push({
        name: `Participant ${i}`,
        batch: `Batch ${Math.ceil(i / 10)}`,
        universityId: `STU${String(i).padStart(3, "0")}`,
        picture: null,
      });
    }
    const participantsResult = await db
      .collection("participants")
      .insertMany(participants);
    const participantIds = Object.values(participantsResult.insertedIds);
    console.log(`   ✅ Created ${participantIds.length} participants\n`);

    // 4. Create users (admin + house captains)
    console.log("🔐 Creating users...");
    const hashedPassword = await bcrypt.hash("password123", 10);

    const users: any[] = [
      {
        username: "admin",
        password: hashedPassword,
        role: "admin",
      },
    ];

    // Create house captains
    for (let i = 0; i < houseIds.length; i++) {
      users.push({
        username: houses[i].name.toLowerCase().replace(/\s+/g, ""),
        password: hashedPassword,
        role: "house_captain",
        houseId: houseIds[i],
      });
    }

    await db.collection("users").insertMany(users);
    console.log(
      `   ✅ Created ${users.length} users (1 admin + ${houseIds.length} captains)\n`
    );

    // 5. Create scheduled rounds for all participants
    console.log("📋 Creating scheduled rounds...");
    const rounds = participantIds.map((participantId) => ({
      participantId,
      status: "scheduled",
      timerEnd: null,
      scheduledStart: null,
      finalized: false,
    }));
    await db.collection("rounds").insertMany(rounds);
    console.log(`   ✅ Created ${rounds.length} scheduled rounds\n`);

    // Summary
    console.log("✨ Full reset complete!\n");
    console.log("Summary:");
    console.log(`  - ${houseIds.length} houses created`);
    console.log(`  - ${participantIds.length} participants created`);
    console.log(`  - ${users.length} users created`);
    console.log(`  - ${rounds.length} scheduled rounds created`);
    console.log("\n📝 Login credentials:");
    console.log("  Admin:");
    console.log("    Username: admin");
    console.log("    Password: password123");
    console.log("\n  House Captains:");
    houses.forEach((house) => {
      console.log(`    ${house.name}:`);
      console.log(
        `      Username: ${house.name.toLowerCase().replace(/\s+/g, "")}`
      );
      console.log(`      Password: password123`);
    });
    console.log("\n🎯 System ready for testing!\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error during full reset:", error);
    process.exit(1);
  }
}

fullReset();
