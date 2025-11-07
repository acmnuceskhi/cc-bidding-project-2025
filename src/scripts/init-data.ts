import { config } from "dotenv";
import path from "path";

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

async function initializeData() {
  try {
    console.log("Connecting to MongoDB...");
    const client = await clientPromise;
    const db = client.db();
    console.log("Connected!");

    // Remove previous test data
    await db.collection("houses").deleteMany({});
    await db.collection("participants").deleteMany({});
    await db.collection("bids").deleteMany({});
    await db.collection("rounds").deleteMany({});
    await db.collection("users").deleteMany({});
    await db.collection("teams").deleteMany({});
    console.log("Cleared previous data.");

    // Houses
    const houses = [
      { name: "Lord Shen", totalBudget: 1000, remainingBudget: 1000 },
      { name: "Dragon Warrior", totalBudget: 1000, remainingBudget: 1000 },
      { name: "Master Oogway", totalBudget: 1000, remainingBudget: 1000 },
      { name: "Tai Lung", totalBudget: 1000, remainingBudget: 1000 },
    ];

    const houseIds: ObjectId[] = [];
    for (const house of houses) {
      const result = await Houses.create(house);
      houseIds.push(result.insertedId);
    }

    // Round-1 dummy teams
    const teamIds: ObjectId[] = [];
    for (let i = 1; i <= 4; i++) {
      const result = await Teams.create({
        successfulAttempts: 0,
        unsuccessfulAttempts: 0,
        totalPoints: 0,
        totalPenalty: 0,
        timeTakenPerProblem: [],
      });

      teamIds.push(result.insertedId);
      console.log(`Created Team ${i}`);
    }

    // Participants (48 total)
    const participants: Omit<Participant, "_id">[] = [];
    for (let i = 1; i <= 48; i++) {
      participants.push({
        name: `Participant ${i}`,
        picture: `https://api.dicebear.com/7.x/initials/svg?seed=Participant${i}`,
        teamId: teamIds[(i - 1) % teamIds.length],
      });
    }

    const participantIds: ObjectId[] = [];
    for (let i = 0; i < participants.length; i++) {
      const result = await Participants.create(participants[i]);
      participantIds.push(result.insertedId);
    }

    // Rounds: one scheduled for each participant
    console.log("Creating rounds...");
    for (let i = 0; i < participantIds.length; i++) {
      const scheduledStart = new Date(Date.now() + i * 2 * 60000);
      const timerEnd = new Date(scheduledStart.getTime() + 60000);

      await Rounds.create({
        participantId: participantIds[i],
        bids: [],
        status: "scheduled",
        scheduledStart,
        timerEnd,
      });
    }

    // Users (simple test credentials)
    await Users.create({
      username: "admin",
      password: await hashPassword("admin123"),
      role: "admin",
    });

    const captainPassword = await hashPassword("captain123");
    const allHouses = await Houses.getAll();

    for (const house of allHouses) {
      await Users.create({
        username: `captain_${house.name.toLowerCase().replace(/\s+/g, "_")}`,
        password: captainPassword,
        role: "house_captain",
        houseId: house._id,
      });
    }

    console.log("✅ Test database seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error initializing test data:", err);
    process.exit(1);
  }
}

initializeData();
