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

Imports qualified teams from Excel file (typically for batches 2023 and 2024).

**Required Excel Columns:**
1. Team Name
2. Leader Name
3. Leader Email Address
4. Member 1 Name
5. Member 1 Email Address
6. Member 2 Name
7. Member 2 Email Address
8. Vjudge Used (informational)
9. Total Solved (maps to `successfulAttempts`)
10. Time Penalty (maps to `totalPenalty`)

**Example Excel Row:**
| Team Name | Leader Name | Leader Email | Member 1 Name | Member 1 Email | Member 2 Name | Member 2 Email | Vjudge Used | Total Solved | Time Penalty |
|-----------|-------------|--------------|---------------|----------------|---------------|----------------|-------------|--------------|--------------|
| Maqsad | Huzaifa Ahmed Bari | k240847@nu.edu.pk | Shoaib Hayat | k241028@nu.edu.pk | Muhammad Yahya Khan | k241030@nu.edu.pk | _Maqsad_ | 7 | 50 |

**How it works:**
1. Reads Excel file (first sheet)
2. Derives batch from email (e.g., `k240847@nu.edu.pk` → "2024")
3. Calculates `totalPoints = Total Solved × 100`
4. Creates team with `successfulAttempts` and `totalPenalty`
5. Creates 3 participants (leader + 2 members) with roll numbers from emails
6. Creates scheduled round for team
7. Recalculates ranks for ALL teams in database

**Usage:**

```powershell
# One-liner
$env:RUN_IMPORT_SCRIPT="true"; $env:EXCEL_FILE_PATH="D:\data\qualified-teams-2023-2024.xlsx"; npm run import-excel

# Or step-by-step
$env:EXCEL_FILE_PATH = "D:\data\qualified-teams.xlsx"
$env:RUN_IMPORT_SCRIPT = "true"
npm run import-excel
```

**Important Notes:**
- ⚠️ **Adds** teams (doesn't replace) - run `seed-test-data` first for fresh start
- ✅ Required: Team Name, Leader Email
- ⚠️ Optional: Member 1/2 (team created even if missing)
- 📧 Email format: `25K-1234@nu.edu.pk` (extracts batch "2025" and roll "25K-1234")
- 🏆 Ranks: Most solved → Least penalty → Highest points

**Troubleshooting:**
- `EXCEL_FILE_PATH required` → Set environment variable
- `No data found` → Check Excel has rows (not just headers)
- `Cannot find module 'xlsx'` → Run `npm install xlsx`
- `No participants created` → Check Leader Name and Email columns

---

### reset-auction

Resets auction state while keeping core entities.

- Sets every round to `scheduled` status
- Deletes all bids
- Restores each house's `remainingBudget` to `totalBudget`
- Clears participant `houseId`

Run:

```powershell
npm run reset-auction
```

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

Complete setup for production auction:

```powershell
# 1. Seed 24 sample teams (12 freshmen + 12 seniors) + houses + config + users
$env:RUN_SEED_SCRIPT="true"
npm run seed-test-data

# 2. Import real qualified teams from Excel (batches 2023 and 2024)
$env:RUN_IMPORT_SCRIPT="true"; $env:EXCEL_FILE_PATH="D:\acm-data\qualified-teams-2023-2024.xlsx"; npm run import-excel

# 3. Verify in admin panel
# - http://localhost:3000/admin/teams (check all teams appear)
# - http://localhost:3000/admin/rounds (verify scheduled rounds)

# 4. Start auction
# - http://localhost:3000/admin/main
# - Click "Start Round" to begin bidding
```

**Result:** 24 sample teams + Excel imports (e.g., 30+ total teams if Excel has 6 teams)

---

## Quick Testing

```powershell
# Fresh start
npm run full-reset
npm run dev

# Between tests
npm run reset-auction
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
