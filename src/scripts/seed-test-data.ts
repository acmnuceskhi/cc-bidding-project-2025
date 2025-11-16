import { config } from "dotenv";
import path from "path";

// Import models to ensure indexes are created immediately
import "@/lib/models/bids";
import "@/lib/models/config";
import "@/lib/models/houses";
import "@/lib/models/users";
import "@/lib/models/participants";
import "@/lib/models/rounds";
import "@/lib/models/teams";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

import clientPromise from "@/lib/mongodb";
import { Config } from "@/lib/models/config";
import { Houses } from "@/lib/models/houses";
import { Participants } from "@/lib/models/participants";
import { Rounds } from "@/lib/models/rounds";
import { Users } from "@/lib/models/users";
import { Teams } from "@/lib/models/teams";
import { hashPassword } from "@/lib/auth";
import { ObjectId } from "mongodb";

export async function initializeData() {
  try {
    console.log("Connecting to MongoDB...");
    const client = await clientPromise;
    const db = client.db();
    console.log("Connected!");

    // Safety: prevent accidentally seeding production unless explicitly opted in
    const uri = process.env.MONGODB_URI || "";
    const isProduction =
      uri.includes("mongodb+srv") || uri.includes("cluster0");
    const isTestEnv =
      process.env.NODE_ENV === "test" ||
      uri.includes("127.0.0.1") ||
      uri.includes("localhost");

    if (isProduction && !isTestEnv && process.env.RUN_SEED_SCRIPT !== "true") {
      throw new Error(
        "⚠️  SAFETY: Refusing to seed production database. Set RUN_SEED_SCRIPT=true to override."
      );
    }

    console.log("⚠️  WARNING: This will DELETE existing data for sample batches!");
    console.log("Excel imported teams (batches 2023 & 2024) will be preserved.");
    console.log("Press Ctrl+C within 3 seconds to cancel...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Remove previous data for SAMPLE batches only (preserve Excel imports for 2023 & 2024)
    const sampleBatchYears = ["2025", "2022"];
    
    // Delete teams from sample batches only
    const teamsToDelete = await db.collection("teams").find({ 
      batch: { $in: sampleBatchYears } 
    }).toArray();
    const teamIdsToDelete = teamsToDelete.map(t => t._id);
    
    if (teamIdsToDelete.length > 0) {
      await db.collection("teams").deleteMany({ _id: { $in: teamIdsToDelete } });
      await db.collection("participants").deleteMany({ teamId: { $in: teamIdsToDelete } });
      await db.collection("rounds").deleteMany({ teamId: { $in: teamIdsToDelete } });
      console.log(`✅ Cleared ${teamIdsToDelete.length} sample teams and their participants/rounds.`);
    } else {
      console.log("✅ No previous sample teams to clear.");
    }
    
    // Clear config, houses, bids, and users (these need to be reset)
    await db.collection("config").deleteMany({});
    await db.collection("houses").deleteMany({});
    await db.collection("bids").deleteMany({});
    await db.collection("users").deleteMany({});
    console.log("✅ Cleared config, houses, bids, and users.");

    // Initialize global auction configuration
    await Config.update({
      maxTeamsPerBatch: 3,
      roundDurationSeconds: 60,
      countdownWarningSeconds: 10,
      autoStartNextRound: false,
      delayBetweenRoundsSeconds: 5,
      currentRound: "",
      auctionStartTime: null,
      auctionEndTime: null,
      currentRoundStartTime: null,
      currentRoundEndTime: null,
    });
    console.log("✅ Initialized auction configuration.");

    // Houses with realistic budgets
    const houses = [
      { name: "Lord Shen", totalBudget: 2000, remainingBudget: 2000 },
      { name: "Dragon Warrior", totalBudget: 2000, remainingBudget: 2000 },
      { name: "Master Oogway", totalBudget: 2000, remainingBudget: 2000 },
      { name: "Tai Lung", totalBudget: 2000, remainingBudget: 2000 },
    ];

    const houseIds: ObjectId[] = [];
    for (const house of houses) {
      const result = await Houses.create(house);
      houseIds.push(result.insertedId);
      console.log(`Created house: ${house.name}`);
    }

    // Sample team data generation helpers
    const firstNames = [
      "Ahmed", "Ali", "Hassan", "Muhammad", "Omar", "Zain", "Bilal", "Usman", "Abdullah", "Ibrahim",
      "Fatima", "Ayesha", "Zainab", "Maryam", "Sarah", "Hira", "Amna", "Laiba", "Mahnoor", "Alisha",
      "Hamza", "Arslan", "Talha", "Umer", "Faisal", "Kamran", "Junaid", "Saad", "Waleed", "Shahzad",
      "Aiza", "Nimra", "Sana", "Rabia", "Khadija", "Hafsa", "Bushra", "Maria", "Nida", "Zara"
    ];

    const lastNames = [
      "Khan", "Ahmed", "Ali", "Hassan", "Hussain", "Abbas", "Raza", "Shah", "Malik", "Siddiqui",
      "Mehdi", "Zaidi", "Naqvi", "Jafri", "Bukhari", "Rizvi", "Qureshi", "Ansari", "Baig", "Mirza",
      "Haider", "Akbar", "Aziz", "Iqbal", "Rashid", "Tariq", "Rafiq", "Shafi", "Nadeem", "Jamil"
    ];

    const teamPrefixes = [
      "Team", "Squad", "Crew", "Group", "Alliance", "Unit", "Brigade", "Force", "Legion", "Troop"
    ];

    const teamSuffixes = [
      "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Omega", "Prime", "Nexus", "Apex",
      "Phoenix", "Thunder", "Storm", "Lightning", "Blaze", "Frost", "Shadow", "Light", "Dawn", "Dusk"
    ];

    const generateName = () => {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      return `${firstName} ${lastName}`;
    };

    const generateTeamName = (usedNames: Set<string>) => {
      let teamName: string;
      do {
        const prefix = teamPrefixes[Math.floor(Math.random() * teamPrefixes.length)];
        const suffix = teamSuffixes[Math.floor(Math.random() * teamSuffixes.length)];
        teamName = `${prefix} ${suffix}`;
      } while (usedNames.has(teamName));
      usedNames.add(teamName);
      return teamName;
    };

    // Sample teams for batches without real Excel data
    // Real qualified teams for 2023 and 2024 will be imported via import-excel script
    const teamIds: ObjectId[] = [];
    const usedTeamNames = new Set<string>();
    
    // Batches: 12 Freshmen (2025) + 12 Seniors (2022) = 24 teams total
    const sampleBatches = [
      { year: "2025", count: 12 }, // Freshmen
      { year: "2022", count: 12 }, // Seniors
    ];
    
    console.log("Creating 24 sample teams: 12 freshmen (2025) + 12 seniors (2022)");
    console.log("(Real qualified teams for 2023 and 2024 should be imported via Excel)");
    
    for (const { year, count } of sampleBatches) {
      console.log(`  Generating ${count} teams for batch ${year}...`);
      
      for (let i = 0; i < count; i++) {
        const teamName = generateTeamName(usedTeamNames);
        const successfulAttempts = Math.floor(Math.random() * 8) + 3; // 3-10 solved (similar to Excel data)
        const timePenalty = Math.floor(Math.random() * 300) + 100; // 100-400 minutes (similar to Excel data)
        const totalPoints = successfulAttempts * 100;

        const result = await Teams.create({
          name: teamName,
          successfulAttempts,
          unsuccessfulAttempts: 0, // Not in Excel
          totalPoints,
          totalPenalty: timePenalty,
          timeTakenPerProblem: [], // Not in Excel
          batch: year,
          rank: 0, // Will be recalculated later
        });

        teamIds.push(result.insertedId);
      }
    }
    console.log(`✅ Created ${teamIds.length} sample teams`);

    // Create participants (3 per team)
    const letters = ["K", "L", "M", "I", "F", "P"];
    const rollNumbersSet = new Set<string>();

    let participantIndex = 0;
    let currentBatchIndex = 0;
    let teamsInCurrentBatch = 0;
    
    for (let teamIdx = 0; teamIdx < teamIds.length; teamIdx++) {
      const teamId = teamIds[teamIdx];
      
      // Determine which batch this team belongs to
      if (teamsInCurrentBatch >= sampleBatches[currentBatchIndex].count) {
        currentBatchIndex++;
        teamsInCurrentBatch = 0;
      }
      const batch = sampleBatches[currentBatchIndex].year;
      teamsInCurrentBatch++;
      
      const twoDigitYear = batch.substring(2);
      const membersPerTeam = 3;
      
      for (let memberIdx = 0; memberIdx < membersPerTeam; memberIdx++) {
        let rollNumber: string;
        let attempts = 0;
        do {
          const c = letters[Math.floor(Math.random() * letters.length)];
          const xxxx = Math.floor(Math.random() * 9999 + 1)
            .toString()
            .padStart(4, "0");
          rollNumber = `${twoDigitYear}${c}-${xxxx}`;
          attempts++;
          if (attempts > 1000) {
            throw new Error("Could not generate unique roll number");
          }
        } while (rollNumbersSet.has(rollNumber));

        rollNumbersSet.add(rollNumber);

        const participantName = generateName();
        await Participants.create({
          name: participantName,
          rollNumber,
          picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(participantName)}`,
          teamId,
        });

        participantIndex++;
      }
    }
    console.log(`✅ Created ${participantIndex} participants`);

    // Recalculate team ranks based on performance (batch-wise)
    // Recalculate team ranks based on performance (batch-wise)
    console.log("\n" + "=".repeat(60));
    console.log("🔄 Recalculating team ranks for sample batches (2025 & 2022)...");
    
    // Only rank sample batches (reuse the constant from earlier)
    const allTeams = await Teams.getAll();
    const sampleTeams = allTeams.filter(team => sampleBatchYears.includes(team.batch || ""));
    
    // Group teams by batch
    const teamsByBatch: { [batch: string]: typeof sampleTeams } = {};
    sampleTeams.forEach(team => {
      const batch = team.batch || "unknown";
      if (!teamsByBatch[batch]) {
        teamsByBatch[batch] = [];
      }
      teamsByBatch[batch].push(team);
    });
    
    // Rank teams within each batch
    for (const batch in teamsByBatch) {
      const batchTeams = teamsByBatch[batch];
      batchTeams.sort((a, b) => {
        // Primary: most problems solved (descending)
        if (b.successfulAttempts !== a.successfulAttempts) {
          return b.successfulAttempts - a.successfulAttempts;
        }
        // Secondary: least penalty time (ascending)
        if (a.totalPenalty !== b.totalPenalty) {
          return a.totalPenalty - b.totalPenalty;
        }
        // Tertiary: highest total points
        return (b.totalPoints || 0) - (a.totalPoints || 0);
      });
      
      // Assign ranks within batch
      for (let idx = 0; idx < batchTeams.length; idx++) {
        const team = batchTeams[idx];
        if (!team._id) continue;
        await Teams.update(team._id.toString(), { rank: idx + 1 });
      }
      console.log(`  ✅ Batch ${batch}: Ranked ${batchTeams.length} teams`);
    }
    console.log("✅ Assigned team ranks for sample batches (2025 & 2022)");

    // Create rounds for each team (scheduled, not started)
    for (let i = 0; i < teamIds.length; i++) {
      await Rounds.create({
        teamId: teamIds[i],
        status: "scheduled",
        passPhase: 1,
      });
    }
    console.log(`✅ Created ${teamIds.length} scheduled rounds`);

    // Create admin user
    await Users.create({
      username: "admin",
      password: await hashPassword("admin123"),
      role: "admin",
    });
    console.log("✅ Created admin user");

    // Create house captain users
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
    console.log("✅ Created house captain users");

    console.log("\n" + "=".repeat(60));
    console.log("✅ TEST DATABASE SEEDED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log("\n📋 Demo Accounts:\n");
    console.log("👤 Admin:");
    console.log("   Username: admin");
    console.log("   Password: admin123\n");
    console.log("🏠 House Captains:");
    allHouses.forEach((house) => {
      const username = `captain_${house.name.toLowerCase().replace(/\s+/g, "_")}`;
      console.log(`   ${house.name}:`);
      console.log(`   Username: ${username}`);
      console.log(`   Password: captain123\n`);
    });
    console.log("=".repeat(60) + "\n");
    
    return { success: true };
  } catch (err) {
    console.error("❌ Error initializing test data:", err);
    throw err;
  }
}

// Export default for convenience
export default initializeData;

// When running the script directly (npm run seed), set RUN_SEED_SCRIPT=true
// to allow the script to call process.exit for CLI usage.
if (process.env.RUN_SEED_SCRIPT === "true") {
  initializeData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
