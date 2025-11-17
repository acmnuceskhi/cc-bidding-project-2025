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
 * - Total Solved
 * - Time Penalty
 * 
 * Expected Sheets: Freshmen, Sophomore, Junior, Senior
 */

interface ExcelRow {
  "Team Name": string;
  "Leader Name": string;
  "Leader Email Address": string;
  "Member 1 Name": string;
  "Member 1 Email Address": string;
  "Member 2 Name": string;
  "Member 2 Email Address": string;
  "Total Solved": number;
  "Time Penalty": number;
}

/**
 * Maps sheet name to batch year
 * Freshmen → 2025, Sophomore → 2024, Junior → 2023, Senior → 2022
 */
function deriveBatchFromSheetName(sheetName: string): string {
  const lowerSheet = sheetName.toLowerCase().trim();
  
  if (lowerSheet.includes("freshmen") || lowerSheet.includes("freshman")) {
    return "2025";
  } else if (lowerSheet.includes("sophomore")) {
    return "2024";
  } else if (lowerSheet.includes("junior")) {
    return "2023";
  } else if (lowerSheet.includes("senior")) {
    return "2022";
  }
  
  // Fallback to current year
  console.log(`  ⚠️  Unknown sheet name: ${sheetName}, defaulting to current year`);
  return new Date().getFullYear().toString();
}

/**
 * Generates roll number from email.
 * Example: k250522@nu.edu.pk → "25K-0522" or k240847@nu.edu.pk → "24K-0847"
 */
function extractRollNumber(email: string): string {
  const match = email.match(/^([kK])(\d{2})(\d{4})@/);
  if (match) {
    const letter = match[1].toUpperCase();
    const year = match[2];
    const id = match[3];
    return `${year}${letter}-${id}`;
  }
  
  // Pattern 2: 25K-1234@nu.edu.pk (already in correct format)
  const match2 = email.match(/^(\d{2}[A-Za-z]-\d{4})@/);
  if (match2) {
    return match2[1].toUpperCase();
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

    console.log("\n⚠️  WARNING: This will DELETE existing Excel-imported teams (all 4 batches: 2022-2025)!");
    console.log("Press Ctrl+C within 3 seconds to cancel...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Clear existing Excel-imported teams (all 4 batches)
    const excelBatchYears = ["2022", "2023", "2024", "2025"];
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
      
      // Derive batch from sheet name
      const batch = deriveBatchFromSheetName(sheetName);
      console.log(`📅 Batch: ${batch}`);
      
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
        // Get team statistics
        const totalSolved = row["Total Solved"] || 0;
        const timePenalty = row["Time Penalty"] || 0;

        // Create team
        const teamResult = await Teams.create({
          name: row["Team Name"],
          successfulAttempts: totalSolved,
          unsuccessfulAttempts: 0, // Not provided in Excel
          totalPenalty: timePenalty,
          timeTakenPerProblem: [], // Not provided in Excel
          batch,
          rank: i + 1, // Will be recalculated later
        });

        const teamId = teamResult.insertedId;
        console.log(`  ✅ Created team with ID: ${teamId}`);

        // Create participants (leader + members)
        // Teams can have 2-3 members. Only add participants with valid name.
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
        const usedRollNumbers = new Set<string>();
        
        for (const member of members) {
          // Only require name to be present (email is optional)
          if (member.name) {
            // Skip participants without email (Senior batch doesn't have emails)
            if (!member.email) {
              console.log(`    ⚠️  Skipping ${member.name} - no email provided`);
              continue;
            }

            const rollNumber = extractRollNumber(member.email);

            // Skip duplicate roll numbers (same person entered multiple times)
            if (usedRollNumbers.has(rollNumber)) {
              console.log(`    ⚠️  Skipping duplicate member: ${member.name} (${rollNumber})`);
              continue;
            }

            await Participants.create({
              name: member.name,
              rollNumber: rollNumber,
              picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.name)}`,
              teamId,
            });

            usedRollNumbers.add(rollNumber);
            memberCount++;
            console.log(`    ✅ Added ${member.isLeader ? "leader" : "member"}: ${member.name}`);
          }
        }

        if (memberCount === 0) {
          console.warn(`  ⚠️  Warning: No participants created for team ${row["Team Name"]}`);
        } else if (memberCount < 2) {
          console.warn(`  ⚠️  Warning: Team ${row["Team Name"]} has only ${memberCount} participant(s)`);
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
    console.log("🔄 Recalculating team ranks for all imported batches (2022-2025)...");
    
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
    console.log("✅ Assigned team ranks for all Excel-imported batches (2022-2025)");

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
