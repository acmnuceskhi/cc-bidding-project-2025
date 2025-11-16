import { config } from "dotenv";
import path from "path";
import * as XLSX from "xlsx";

// Import models to ensure indexes are created immediately
import "@/lib/models/teams";
import "@/lib/models/participants";
import "@/lib/models/rounds";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

import clientPromise from "@/lib/mongodb";
import { Teams } from "@/lib/models/teams";
import { Participants } from "@/lib/models/participants";
import { Rounds } from "@/lib/models/rounds";

/**
 * Expected Excel Columns:
 * - Team Name
 * - Leader Name
 * - Leader Email Address
 * - Member 1 Name
 * - Member 1 Email Address
 * - Member 2 Name
 * - Member 2 Email Address
 * - Vjudge Used (username)
 * - Total Solved
 * - Time Penalty
 */

interface ExcelRow {
  "Team Name": string;
  "Leader Name": string;
  "Leader Email Address": string;
  "Member 1 Name": string;
  "Member 1 Email Address": string;
  "Member 2 Name": string;
  "Member 2 Email Address": string;
  "Vjudge Used": string;
  "Total Solved": number;
  "Time Penalty": number;
}

/**
 * Derives batch year from email address.
 * Example: k240847@nu.edu.pk → "2024" or 25K-1234@nu.edu.pk → "2025"
 */
function deriveBatchFromEmail(email: string): string {
  if (!email) {
    console.log(`  ⚠️  Empty email, defaulting to current year`);
    return new Date().getFullYear().toString();
  }
  
  // Try to extract year from email format
  // Pattern 1: k240847 or k240847@nu.edu.pk (letter then 2 digits)
  const pattern1 = email.match(/^[kK](\d{2})/i);
  if (pattern1) {
    const twoDigitYear = parseInt(pattern1[1], 10);
    const fullYear = `20${twoDigitYear}`;
    console.log(`  📧 Email: ${email} → Batch: ${fullYear} (pattern 1: letter+2digits)`);
    return fullYear;
  }
  
  // Pattern 2: 25K-1234 or 25K-1234@nu.edu.pk (2 digits then letter)
  const pattern2 = email.match(/^(\d{2})[A-Za-z]/);
  if (pattern2) {
    const twoDigitYear = parseInt(pattern2[1], 10);
    const fullYear = `20${twoDigitYear}`;
    console.log(`  📧 Email: ${email} → Batch: ${fullYear} (pattern 2: 2digits+letter)`);
    return fullYear;
  }
  
  // Default to current year if no match
  console.log(`  ⚠️  Email format not recognized: ${email}, defaulting to current year`);
  return new Date().getFullYear().toString();
}

/**
 * Generates roll number from email.
 * Example: k240847@nu.edu.pk → "k240847" or 25K-1234@nu.edu.pk → "25K-1234"
 */
function extractRollNumber(email: string): string {
  const match = email.match(/^([^@]+)@/);
  if (match) {
    return match[1];
  }
  // Fallback: generate random roll number
  const letters = ["K", "L", "M", "I", "F", "P"];
  const year = new Date().getFullYear().toString().substring(2);
  const letter = letters[Math.floor(Math.random() * letters.length)];
  const num = Math.floor(Math.random() * 9999 + 1)
    .toString()
    .padStart(4, "0");
  return `${year}${letter}-${num}`;
}

/**
 * Imports teams from Excel file (processes all sheets)
 */
export async function importTeamsFromExcel(excelFilePath: string) {
  try {
    console.log("Connecting to MongoDB...");
    await clientPromise;
    console.log("Connected!");

    console.log(`Reading Excel file: ${excelFilePath}`);
    const workbook = XLSX.readFile(excelFilePath);
    
    console.log(`Found ${workbook.SheetNames.length} sheets: ${workbook.SheetNames.join(", ")}`);

    console.log("\n⚠️  WARNING: This will DELETE existing Excel-imported teams (batches 2023 & 2024)!");
    console.log("Press Ctrl+C within 3 seconds to cancel...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Clear existing Excel-imported teams (batches 2023 & 2024)
    const excelBatchYears = ["2023", "2024"];
    const db = (await clientPromise).db();
    
    const teamsToDelete = await db.collection("teams").find({ 
      batch: { $in: excelBatchYears } 
    }).toArray();
    const teamIdsToDelete = teamsToDelete.map(t => t._id);
    
    if (teamIdsToDelete.length > 0) {
      await db.collection("teams").deleteMany({ _id: { $in: teamIdsToDelete } });
      await db.collection("participants").deleteMany({ teamId: { $in: teamIdsToDelete } });
      await db.collection("rounds").deleteMany({ teamId: { $in: teamIdsToDelete } });
      console.log(`✅ Cleared ${teamIdsToDelete.length} Excel teams (batches 2023 & 2024) and their participants/rounds.`);
    } else {
      console.log("✅ No previous Excel teams to clear.");
    }

    let successCount = 0;
    let errorCount = 0;

    // Process all sheets in the workbook
    for (const sheetName of workbook.SheetNames) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`📄 Processing sheet: ${sheetName}`);
      console.log("=".repeat(60));
      
      const worksheet = workbook.Sheets[sheetName];
      const rows: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

      console.log(`Found ${rows.length} teams in this sheet`);

      if (rows.length === 0) {
        console.warn(`⚠️  No data found in sheet "${sheetName}", skipping...`);
        continue;
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
      
      try {
        console.log(`\nProcessing team ${i + 1}/${rows.length}: ${row["Team Name"]}`);

        // Validate required fields
        if (!row["Team Name"]) {
          console.error(`  ❌ Skipping: Missing team name`);
          errorCount++;
          continue;
        }
        if (!row["Leader Email Address"]) {
          console.error(`  ❌ Skipping: Missing leader email`);
          errorCount++;
          continue;
        }

        // Derive batch from leader's email
        const batch = deriveBatchFromEmail(row["Leader Email Address"]);
        const totalSolved = row["Total Solved"] || 0;
        const timePenalty = row["Time Penalty"] || 0;

        // ICPC-style scoring
        const pointsPerSolved = 100;
        const totalPoints = totalSolved * pointsPerSolved;

        // Create team
        const teamResult = await Teams.create({
          name: row["Team Name"],
          successfulAttempts: totalSolved,
          unsuccessfulAttempts: 0, // Not provided in Excel
          totalPoints,
          totalPenalty: timePenalty,
          timeTakenPerProblem: [], // Not provided in Excel
          batch,
          rank: i + 1, // Will be recalculated later
        });

        const teamId = teamResult.insertedId;
        console.log(`  ✅ Created team with ID: ${teamId}`);

        // Create participants (leader + members)
        const members = [
          {
            name: row["Leader Name"],
            email: row["Leader Email Address"],
            isLeader: true,
          },
          {
            name: row["Member 1 Name"],
            email: row["Member 1 Email Address"],
            isLeader: false,
          },
          {
            name: row["Member 2 Name"],
            email: row["Member 2 Email Address"],
            isLeader: false,
          },
        ];

        let memberCount = 0;
        for (const member of members) {
          if (member.name && member.email) {
            const rollNumber = extractRollNumber(member.email);

            await Participants.create({
              name: member.name,
              rollNumber,
              picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.name)}`,
              teamId,
            });

            memberCount++;
            console.log(`    ✅ Added ${member.isLeader ? "leader" : "member"}: ${member.name}`);
          }
        }

        if (memberCount === 0) {
          console.warn(`  ⚠️  Warning: No participants created for team ${row["Team Name"]}`);
        }

        // Create scheduled round for this team
        await Rounds.create({
          teamId,
          status: "scheduled",
          passPhase: 1,
        });
        console.log(`  ✅ Created scheduled round`);

        successCount++;
      } catch (err) {
        console.error(`  ❌ Error processing team ${row["Team Name"]}:`, err);
        errorCount++;
      }
    }
  }

    // Recalculate team ranks based on performance (batch-wise)
    console.log("\n" + "=".repeat(60));
    console.log("🔄 Recalculating team ranks for imported batches (2023 & 2024)...");
    
    // Only rank Excel-imported batches (reuse the constant from earlier)
    const allTeams = await Teams.getAll();
    const excelTeams = allTeams.filter(team => excelBatchYears.includes(team.batch || ""));
    
    // Group teams by batch
    const teamsByBatch: { [batch: string]: typeof excelTeams } = {};
    excelTeams.forEach(team => {
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
    console.log("✅ Assigned team ranks for Excel-imported batches (2023 & 2024)");

    console.log("\n" + "=".repeat(60));
    console.log("✅ EXCEL IMPORT COMPLETED!");
    console.log("=".repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   Total teams imported: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Sheets processed: ${workbook.SheetNames.length}`);
    console.log("=".repeat(60) + "\n");

    return { success: true, successCount, errorCount };
  } catch (err) {
    console.error("❌ Error importing teams from Excel:", err);
    throw err;
  }
}

// Export default for convenience
export default importTeamsFromExcel;

// When running directly with RUN_IMPORT_SCRIPT=true
// Usage: RUN_IMPORT_SCRIPT=true EXCEL_FILE_PATH=path/to/file.xlsx ts-node src/scripts/import-excel-teams.ts
if (process.env.RUN_IMPORT_SCRIPT === "true") {
  const excelFilePath = process.env.EXCEL_FILE_PATH;
  
  if (!excelFilePath) {
    console.error("❌ Error: EXCEL_FILE_PATH environment variable is required");
    console.error("\nUsage:");
    console.error('  $env:RUN_IMPORT_SCRIPT="true"; $env:EXCEL_FILE_PATH="path/to/file.xlsx"; npm run import-excel');
    process.exit(1);
  }

  importTeamsFromExcel(excelFilePath)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
