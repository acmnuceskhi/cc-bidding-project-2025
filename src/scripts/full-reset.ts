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
import { config } from "dotenv";
import path from "path";
// Load env like seed-test-data
config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

import clientPromise from "@/lib/mongodb";
import { Houses } from "@/lib/models/houses";
import { Participants, Participant } from "@/lib/models/participants";
import { Rounds } from "@/lib/models/rounds";
import { Users } from "@/lib/models/users";
import { Teams } from "@/lib/models/teams";
import { hashPassword } from "@/lib/auth";
import { ObjectId } from "mongodb";

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

    // 2. Create houses using model
    console.log("🏯 Creating houses...");
    const houseSpecs = [
      { name: "Lord Shen", totalBudget: 1000, remainingBudget: 1000 },
      { name: "Dragon Warrior", totalBudget: 1000, remainingBudget: 1000 },
      { name: "Master Oogway", totalBudget: 1000, remainingBudget: 1000 },
      { name: "Tai Lung", totalBudget: 1000, remainingBudget: 1000 },
    ];
    const houseIds: ObjectId[] = [];
    for (const h of houseSpecs) {
      const res = await Houses.create(h);
      houseIds.push(res.insertedId);
    }
    console.log(`   ✅ Created ${houseIds.length} houses\n`);

    // 3. Create Round-1 teams and assign ranks (hardcoded, mandatory)
    console.log("🛡️  Creating round-1 teams with ranks...");
    const teamIds: ObjectId[] = [];
    for (let i = 1; i <= 4; i++) {
      const result = await Teams.create({
        successfulAttempts: 0,
        unsuccessfulAttempts: 0,
        totalPoints: 0,
        totalPenalty: 0,
        timeTakenPerProblem: [],
        rank: i, // predetermined accurate ranks
      });
      teamIds.push(result.insertedId);
    }
    console.log(`   ✅ Created ${teamIds.length} teams with ranks\n`);

    // 4. Create participants with rollNumber and team assignment
    console.log("👥 Creating participants...");
    const participants: Omit<Participant, "_id">[] = [];
    const letters = ["K", "L", "M", "I", "F", "P"];
    const rollNumbersSet = new Set<string>();
    const totalParticipants = 48;
    for (let i = 0; i < totalParticipants; i++) {
      let rollNumber: string;
      do {
        const xy = 25 - Math.floor(i / 12); // distribute batches
        const c = letters[Math.floor(Math.random() * letters.length)];
        const xxxx = Math.floor(Math.random() * 9999 + 1)
          .toString()
          .padStart(4, "0");
        rollNumber = `${xy}${c}-${xxxx}`;
      } while (rollNumbersSet.has(rollNumber));
      rollNumbersSet.add(rollNumber);

      participants.push({
        name: `Participant ${i + 1}`,
        rollNumber,
        picture: `https://api.dicebear.com/7.x/initials/svg?seed=Participant${i + 1}`,
        teamId: teamIds[i % teamIds.length],
      });
    }
    const participantIds: ObjectId[] = [];
    for (const p of participants) {
      const res = await Participants.create(p);
      participantIds.push(res.insertedId);
    }
    console.log(`   ✅ Created ${participantIds.length} participants\n`);

    // 5. Create users (admin + house captains) using model + hashPassword
    console.log("🔐 Creating users...");
    await Users.create({
      username: "admin",
      password: await hashPassword("admin123"),
      role: "admin",
    });

    const captainPassword = await hashPassword("captain123");
    const allHouses = await Houses.getAll();
    for (const house of allHouses) {
      await Users.create({
        username: "captain_" + house.name.toLowerCase().replace(/\s+/g, "_"),
        password: captainPassword,
        role: "house_captain",
        houseId: house._id as ObjectId,
      });
    }
    console.log(
      `   ✅ Created ${allHouses.length + 1} users (1 admin + ${allHouses.length} captains)\n`
    );

    // 6. Create scheduled rounds with timing like seed-test-data
    console.log("📋 Creating scheduled rounds...");
    let roundStartTime = new Date();
    const biddingDuration = 40 * 1000;
    const resultDuration = 10 * 1000;
    for (const pid of participantIds) {
      const scheduledStart = new Date(roundStartTime.getTime());
      const timerEnd = new Date(scheduledStart.getTime() + biddingDuration);
      await Rounds.create({
        participantId: pid,
        status: "scheduled",
        scheduledStart,
        timerEnd,
      });
      roundStartTime = new Date(timerEnd.getTime() + resultDuration);
    }
    console.log(`   ✅ Created ${participantIds.length} scheduled rounds\n`);

    // Summary
    console.log("✨ Full reset complete!\n");
    console.log("Summary:");
    console.log(`  - ${houseIds.length} houses created`);
    console.log(`  - ${teamIds.length} teams (ranked) created`);
    console.log(`  - ${participantIds.length} participants created`);
    console.log(`  - ${participantIds.length} scheduled rounds created`);
    console.log("\n📝 Login credentials:");
    console.log("  Admin:");
    console.log("    Username: admin");
    console.log("    Password: password123");
    console.log("\n  House Captains:");
    (await Houses.getAll()).forEach((house) => {
      console.log(`    ${house.name}:`);
      console.log(
        `      Username: captain_${house.name
          .toLowerCase()
          .replace(/\s+/g, "_")}`
      );
      console.log(`      Password: captain123`);
    });
    console.log("\n🎯 System ready for testing!\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error during full reset:", error);
    process.exit(1);
  }
}

fullReset();
