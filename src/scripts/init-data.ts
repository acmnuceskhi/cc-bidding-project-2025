import { config } from "dotenv";
import { Houses } from "@/lib/models/houses";
import { Participants } from "@/lib/models/participants";
import clientPromise from "@/lib/mongodb";

// Load environment variables
config();

async function initializeData() {
  try {
    console.log("Connecting to MongoDB...");
    console.log("MongoDB URI:", process.env.MONGODB_URI);
    
    // Connect to database
    const client = await clientPromise;
    const db = client.db();
    
    console.log("Connected to MongoDB successfully!");
    
    // Clear existing data
    await db.collection("houses").deleteMany({});
    await db.collection("participants").deleteMany({});
    await db.collection("bids").deleteMany({});
    await db.collection("rounds").deleteMany({});
    await db.collection("teams").deleteMany({});
    
    console.log("Cleared existing data");
    
    // Create 4 houses with equal budget
    const houses = [
      { name: "Lord Shen", totalBudget: 1000, remainingBudget: 1000, teams: [] },
      { name: "Dragon Warrior", totalBudget: 1000, remainingBudget: 1000, teams: [] },
      { name: "Master Oogway", totalBudget: 1000, remainingBudget: 1000, teams: [] },
      { name: "Tai Lung", totalBudget: 1000, remainingBudget: 1000, teams: [] }
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
        picture: `https://api.dicebear.com/7.x/initials/svg?seed=Participant${i}`
      });
    }
    
    for (const participant of participants) {
      await Participants.create(participant);
      console.log(`Created participant: ${participant.name}`);
    }
    
    console.log("Database initialization complete!");
    console.log(`Created ${houses.length} houses and ${participants.length} participants`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error initializing data:", error);
    process.exit(1);
  }
}

// Run the initialization
initializeData();