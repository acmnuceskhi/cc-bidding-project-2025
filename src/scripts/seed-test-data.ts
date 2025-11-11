import { config } from "dotenv";
import path from "path";

import "@/lib/models/bids"; // <-- ensures indexes are created immediately

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

    // Round-1 dummy teams with dummy stats
    const teamIds: ObjectId[] = [];
    for (let i = 1; i <= 4; i++) {
      const successfulAttempts = Math.floor(Math.random() * 10); // 0-9
      const unsuccessfulAttempts = Math.floor(Math.random() * 5); // 0-4
      const penaltyPerProblem = 5;
      const avgPointsPerProblem = 10;

      const totalPenalty = unsuccessfulAttempts * penaltyPerProblem;
      const totalPoints =
        successfulAttempts * avgPointsPerProblem - totalPenalty;
      const timeTakenPerProblem = Array.from(
        { length: 5 },
        () => Math.floor(Math.random() * (300 - 30 + 1)) + 30 // 30-300s per problem
      );

      const result = await Teams.create({
        successfulAttempts,
        unsuccessfulAttempts,
        totalPoints,
        totalPenalty,
        timeTakenPerProblem,
        // Rank is mandatory and pre-hardcoded; here we assign deterministic rank by loop order
        // Adjust as needed to match your real pre-auction data
        rank: i,
      });

      teamIds.push(result.insertedId);
      console.log(`Created Team ${i} with coherent stats`);
    }

    // Participants (48 total)
    const participants: Omit<Participant, "_id">[] = [];
    const letters = ["K", "L", "M", "I", "F", "P"];

    const rollNumbersSet = new Set<string>();

    // Define XY batches and their sizes
    const xyBatches = [
      { xy: 25, size: 12 },
      { xy: 24, size: 12 },
      { xy: 23, size: 12 },
      { xy: 22, size: 3 },
      { xy: 21, size: 3 },
      { xy: 20, size: 3 },
      { xy: 19, size: 3 },
    ];

    let participantIndex = 0;
    for (const batch of xyBatches) {
      const { xy, size } = batch;

      for (let i = 0; i < size; i++) {
        let rollNumber: string;
        do {
          const c = letters[Math.floor(Math.random() * letters.length)];
          const xxxx = Math.floor(Math.random() * 9999 + 1)
            .toString()
            .padStart(4, "0");
          rollNumber = `${xy}${c}-${xxxx}`;
        } while (rollNumbersSet.has(rollNumber));

        rollNumbersSet.add(rollNumber);

        participants.push({
          name: `Participant ${participantIndex + 1}`,
          rollNumber,
          picture: `https://api.dicebear.com/7.x/initials/svg?seed=Participant${participantIndex + 1}`,
          teamId: teamIds[participantIndex % teamIds.length],
        });

        participantIndex++;
      }
    }

    const participantIds: ObjectId[] = [];
    for (let i = 0; i < participants.length; i++) {
      const result = await Participants.create(participants[i]);
      participantIds.push(result.insertedId);
    }

    // No dynamic rank computation; ranks are predetermined and set during creation

    // Rounds: one scheduled for each participant
    console.log("Creating rounds...");

    let roundStartTime = new Date(); // start now
    const biddingDuration = 40 * 1000; // bidding 40 seconds in ms
    const resultDuration = 10 * 1000; // post-bidding result 10 seconds in ms

    for (let i = 0; i < participantIds.length; i++) {
      const scheduledStart = new Date(roundStartTime.getTime());
      const timerEnd = new Date(scheduledStart.getTime() + biddingDuration);

      await Rounds.create({
        participantId: participantIds[i],
        status: "scheduled",
        scheduledStart,
        timerEnd,
      });

      // Next round starts after bidding + result display
      roundStartTime = new Date(timerEnd.getTime() + resultDuration);
    }
    console.log("Rounds created.");

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
    console.log("\nDemo Accounts:\n");
    console.log("Admin: admin / admin123\n");
    console.log("House Captains:\n");
    (await Houses.getAll()).forEach((house) => {
      console.log(
        `captain_${house.name.toLowerCase().replace(/\s+/g, "_")} / captain123`
      );
    });
    process.exit(0);
  } catch (err) {
    console.error("Error initializing test data:", err);
    process.exit(1);
  }
}

initializeData();
