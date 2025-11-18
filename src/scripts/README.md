# Auction Scripts

**Related Documentation:**

- [Root README](../../README.md) - Project overview
- [ONBOARDING.md](../../ONBOARDING.md) - Environment setup (`.env.local` configuration)
- [PROJECT_FLOW.md](../../PROJECT_FLOW.md) - Data models and auction logic

---

> Utility scripts to manage data for the CC Bidding System. All scripts load `.env.local` / `.env` and exit 0 on success, 1 on failure.

## Scripts

### seed-test-data

Seeds the database with sample teams, houses, config, and users. **Does not drop collections first** - adds to existing data.

**What it creates:**
- 4 houses (2000 credits each): Lord Shen, Dragon Warrior, Master Oogway, Tai Lung
- **24 sample teams**: 12 freshmen (2025) + 12 seniors (2022)
- 72 participants (3 per team with realistic names and roll numbers)
- Scheduled rounds for each team
- Users: 1 admin + 4 house captains

**Team attributes** (matching Excel import format):
- `successfulAttempts`: 3-10 problems solved
- `totalPenalty`: 100-400 minutes
- `totalPoints`: solved × 100
- NO `unsuccessfulAttempts`, NO `timeTakenPerProblem`

**Credentials:**
- Admin: `admin / admin123`
- House Captains: `captain_lord_shen / captain123`, etc.

Run:

```powershell
$env:RUN_SEED_SCRIPT="true"
npm run seed-test-data
```

---

### import-excel

**Script:** `src/scripts/import-excel-teams.ts`

Imports all qualified teams from Excel file (all 4 batches: Freshmen, Sophomore, Junior, Senior).

**Required Excel Format:**
- **4 sheets**: Freshmen, Sophomore, Junior, Senior
- **Sheet → Batch mapping**: Freshmen=2025, Sophomore=2024, Junior=2023, Senior=2022
- **Rows must be pre-sorted by rank** (highest Total Solved, lowest Time Penalty)

**Required Columns:**
1. Team Name
2. Leader Name
3. Leader Email Address
4. Member 1 Name
5. Member 1 Email Address
6. Member 2 Name
7. Member 2 Email Address
8. Total Solved (maps to `successfulAttempts`)
9. Time Penalty (maps to `totalPenalty`)

**Example Excel Row:**
| Team Name | Leader Name | Leader Email | Member 1 Name | Member 1 Email | Member 2 Name | Member 2 Email | Total Solved | Time Penalty |
|-----------|-------------|--------------|---------------|----------------|---------------|----------------|--------------|--------------|
| Maqsad | Huzaifa Ahmed Bari | k240847@nu.edu.pk | Shoaib Hayat | k241028@nu.edu.pk | Muhammad Yahya Khan | k241030@nu.edu.pk | 7 | 50 |

**How it works:**
1. Clears all existing teams from batches 2022-2025
2. Processes all 4 sheets (Freshmen, Sophomore, Junior, Senior)
3. Derives batch from sheet name (not email)
4. Extracts roll numbers from emails (e.g., `k250522@nu.edu.pk` → `25K-0522`)
5. Handles 2-3 member teams (Member 2 is optional)
6. Skips duplicate members by adding suffix (e.g., `25K-0874-2` for same person twice)
7. Creates team with `successfulAttempts` and `totalPenalty` (NO totalPoints field)
8. Creates participants with properly formatted roll numbers
9. Creates scheduled round for each team
10. Assigns batch-wise ranks (1-N per batch based on row order in Excel)

**Usage:**

```powershell
# One-liner
$env:RUN_IMPORT_SCRIPT="true"; $env:EXCEL_FILE_PATH="path\to\your\excel\file.xlsx"; npm run import-excel

# Or step-by-step
$env:EXCEL_FILE_PATH = "path\to\your\excel\file.xlsx"
$env:RUN_IMPORT_SCRIPT = "true"
npm run import-excel
```

**Important Notes:**
- ⚠️ **Clears batches 2022-2025** before import (destructive operation)
- ✅ Required: Team Name, Leader Name, Leader Email
- ⚠️ Optional: Member 1/2 (teams can have 2-3 members)
- 📧 Roll number format: `k250522@nu.edu.pk` → `25K-0522`, `25K-1234@nu.edu.pk` → `25K-1234`
- 🏆 Ranks: Assigned 1-N per batch based on Excel row order
- 👥 Duplicate handling: Same person as multiple members gets suffix (e.g., `25K-0874-2`)
- ❌ Does NOT create `totalPoints` field (not in Excel data)

**Troubleshooting:**
- `EXCEL_FILE_PATH required` → Set environment variable
- `No data found` → Check Excel has rows (not just headers)
- `Cannot find module 'xlsx'` → Run `npm install xlsx`
- `No participants created` → Check Leader Name and Email columns

---

### reset-auction

**Script:** `src/scripts/reset-auction.ts`

Resets auction to initial state while preserving teams, participants, and house definitions. Use this between auction rounds or to restart a fresh auction.

**What it resets:**
- ✅ All rounds → `status: "scheduled"`, `passPhase: 1`
- ✅ Clears `timerEnd`, `finalized`, `winningBid` from all rounds
- ✅ Deletes all bids
- ✅ Deletes all locks (`_locks` collection)
- ✅ Restores house budgets: `remainingBudget = totalBudget`
- ✅ Clears team assignments: `houseId = null` for all teams
- ✅ Resets config: `auctionStarted = false`, `currentRoundId = null`

**What it preserves:**
- ✅ Teams (name, batch, rank, stats)
- ✅ Participants (name, roll numbers, pictures)
- ✅ Houses (definitions, totalBudget)
- ✅ Users (admin, captains)

**Usage:**

```powershell
npm run reset-auction
```

**Safety:** Requires environment variable `RUN_RESET_AUCTION=true` to execute (automatically set by npm script).

**When to use:**
- Between auction sessions
- After testing/demo to restart fresh
- To undo incorrect bids/assignments
- Before production auction start

---

### full-reset

Drops all collections and reseeds canonical demo data.

- 4 houses (1000 credits each)
- 16 teams with Round 1 stats (ranks 1-16)
- 48 participants (3 per team with roll numbers)
- Users: 1 admin + 4 house captains
- Scheduled rounds

Credentials:

- Admin: `admin / admin123`
- Captains: `captain_<housename> / captain123` (check output for house names)

Run:

```powershell
npm run full-reset
```

---

### export-bids

Exports full bid history (every bid, including updates) to CSV.

- Columns: `bidId,roundId,houseId,houseName,participantId,participantName,amount,timestampISO`
- Default filename: `bids-YYYY-MM-DDTHH-MM-SS.csv` (repo root)
- Provide custom path as arg for target location.

Run (default):

```powershell
npx tsx src/scripts/export-bids.ts
```

Run (custom path):

```powershell
npx tsx src/scripts/export-bids.ts .\exports\bids.csv
```

---

## Production Workflow

Complete setup for production auction using `import-excel-teams.ts` and `reset-auction.ts`:

```powershell
# 1. Import all qualified teams from Excel (clears batches 2022-2025 first)
$env:RUN_IMPORT_SCRIPT="true"; $env:EXCEL_FILE_PATH="path\to\your\excel\file.xlsx"; npm run import-excel

# Expected result: 44 teams (16 Freshmen + 12 Sophomore + 12 Junior + 4 Senior)

# 2. Verify data in database
# - Check teams: Should see all 44 teams with proper batches (2022-2025)
# - Check participants: Should have 130+ participants with roll numbers like "25K-0522"
# - Check rounds: Should have 44 scheduled rounds (1 per team)

# 3. Ensure auction is in reset state (if needed)
npm run reset-auction

# 4. Verify in admin panel
# - http://localhost:3000/admin/teams (check all teams appear)
# - http://localhost:3000/admin/rounds (verify scheduled rounds)
# - http://localhost:3000/admin/houses (verify budgets are $2000 each)

# 5. Start auction
# - http://localhost:3000/admin/main
# - Click "Start Round" to begin bidding

# 6. Between auction rounds (if needed)
npm run reset-auction  # Clears bids, resets rounds, preserves teams
```

**Result:** Production-ready auction with all qualified teams, proper roll numbers, and clean state.

---

## Quick Testing

```powershell
# Fresh start with sample data
npm run full-reset
npm run dev

# Between tests - reset auction state only
npm run reset-auction  # Preserves teams/participants, clears bids/assignments

# Re-import Excel data
$env:RUN_IMPORT_SCRIPT="true"; $env:EXCEL_FILE_PATH="path\to\excel.xlsx"; npm run import-excel
```

---

## Database Schema Mapping (Excel Import)

| Excel Column | Database Field | Model | Notes |
|-------------|----------------|-------|-------|
| Team Name | `name` | Team | Optional |
| Total Solved | `successfulAttempts` | Team | Ranking (primary) |
| Time Penalty | `totalPenalty` | Team | Ranking (secondary) |
| - | `totalPoints` | Team | Calculated: `Total Solved × 100` |
| - | `batch` | Team | Derived from leader's email |
| - | `rank` | Team | Recalculated after import |
| Leader Name | `name` | Participant | Participant #1 |
| Leader Email | `rollNumber` | Participant | Extracted: `25K-1234` |
| Member 1 Name | `name` | Participant | Participant #2 |
| Member 1 Email | `rollNumber` | Participant | Extracted from email |
| Member 2 Name | `name` | Participant | Participant #3 |
| Member 2 Email | `rollNumber` | Participant | Extracted from email |

---

## Troubleshooting

- Ensure `MONGODB_URI` in `.env.local` or `.env`
- Atlas: whitelist your IP
- Missing collections → `npm run full-reset`
- Excel import fails → Verify column names match exactly

---

## Adding a Script

1. Create file under `src/scripts/`
2. Add npm script in `package.json`
3. Document here succinctly

---

## Notes

- TypeScript + `tsx` or `ts-node`
- MongoDB driver, async/await
- Clear logging + proper exit codes
- Excel import uses `xlsx` package (v0.18.5)
