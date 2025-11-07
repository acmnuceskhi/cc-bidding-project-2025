import { config } from "dotenv";
import path from "path";

// Load environment variables from .env.local first, then .env
config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

import { Houses } from "@/lib/models/houses";
import { Participants } from "@/lib/models/participants";
import { Rounds } from "@/lib/models/rounds";
import { Users } from "@/lib/models/users";
import { hashPassword } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";

async function initializeData() {
  try {
    console.log("Environment check:");
    console.log("MONGODB_URI exists:", !!process.env.MONGODB_URI);
    console.log(
      "MONGODB_URI value:",
      process.env.MONGODB_URI?.substring(0, 20) + "..."
    );

    console.log("Connecting to MongoDB...");

    // Connect to database
    const client = await clientPromise;
    const db = client.db();

    console.log("Connected to MongoDB successfully!");

    // Clear existing data
    await db.collection("houses").deleteMany({});
    await db.collection("participants").deleteMany({});
    await db.collection("bids").deleteMany({});
    await db.collection("rounds").deleteMany({});
    await db.collection("users").deleteMany({});

    console.log("Cleared existing data");

    // Create 4 houses with equal budget
    const houses = [
      { name: "Lord Shen", totalBudget: 1000, remainingBudget: 1000 },
      { name: "Dragon Warrior", totalBudget: 1000, remainingBudget: 1000 },
      { name: "Master Oogway", totalBudget: 1000, remainingBudget: 1000 },
      { name: "Tai Lung", totalBudget: 1000, remainingBudget: 1000 },
    ];

    const houseIds = [];
    for (const house of houses) {
      const result = await Houses.create(house);
      houseIds.push(result.insertedId);
      console.log(`Created house: ${house.name}`);
    }

    // Create 48 participants
    const participants = [];
    for (let i = 1; i <= 48; i++) {
      participants.push({
        name: `Participant ${i}`,
        picture: `https://api.dicebear.com/7.x/initials/svg?seed=Participant${i}`,
      });
    }

    const participantIds = [];
    for (const participant of participants) {
      const result = await Participants.create(participant);
      participantIds.push(result.insertedId);
      console.log(`Created participant: ${participant.name}`);
    }

    // Create predefined rounds for all participants
    console.log("Creating predefined rounds...");
    for (let i = 0; i < participantIds.length; i++) {
      const scheduledStart = new Date(Date.now() + i * 2 * 60 * 1000); // 2 minutes apart
      const timerEnd = new Date(scheduledStart.getTime() + 60 * 1000); // 1 minute duration

      const round = {
        participantId: participantIds[i],
        bids: [],
        status: "scheduled" as const,
        timerEnd,
        scheduledStart,
      };

      await Rounds.create(round);
      if (i < 5) {
        // Only log first 5 to avoid spam
        console.log(`Created round for participant ${i + 1}`);
      }
    }
    console.log(`Created ${participantIds.length} predefined rounds`);

    // Create default users
    const adminPassword = await hashPassword("admin123");
    const adminUser = {
      username: "admin",
      password: adminPassword,
      role: "admin" as const,
    };
    await Users.create(adminUser);
    console.log("Created admin user: admin / admin123");

    // Create house captain users
    const captainPassword = await hashPassword("captain123");
    const houseData = await Houses.getAll();

    for (const house of houseData) {
      const captainUser = {
        username: `captain_${house.name.toLowerCase().replace(/\s+/g, "_")}`,
        password: captainPassword,
        role: "house_captain" as const,
        houseId: house._id,
      };
      await Users.create(captainUser);
      console.log(
        `Created house captain: ${captainUser.username} / captain123`
      );
    }

    console.log("Database initialization complete!");
    console.log(
      `Created ${houses.length} houses, ${participants.length} participants, and ${houseData.length + 1} users`
    );

    process.exit(0);
  } catch (error) {
    console.error("Error initializing data:", error);
    process.exit(1);
  }
}

// Run the initialization
initializeData();
