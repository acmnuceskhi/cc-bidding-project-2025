# Auction Scripts

**Related Documentation:**

- [Root README](../../README.md) - Project overview
- [ONBOARDING.md](../../ONBOARDING.md) - Environment setup (`.env.local` configuration)
- [PROJECT_FLOW.md](../../PROJECT_FLOW.md) - Data models and auction logic

---

> Utility scripts to manage data for the CC Bidding System. All scripts load `.env.local` / `.env` and exit 0 on success, 1 on failure.

## Scripts

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

### seed-test-data

Seeds test dataset without dropping collections first. Useful for development.
Run:

```powershell
npx tsx src/scripts/seed-test-data.ts
```

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

### init-data (legacy)

Deprecated; prefer `full-reset` or `seed-test-data`.

## Quick Testing

```powershell
# Fresh start
npm run full-reset
npm run dev

# Between tests
npm run reset-auction
```

## Troubleshooting

- Ensure `MONGODB_URI` in `.env.local` or `.env`
- Atlas: whitelist your IP
- Missing collections → `npm run full-reset`

## Adding a Script

1. Create file under `src/scripts/`
2. Add npm script in `package.json`
3. Document here succinctly

## Notes

- TypeScript + `tsx`
- MongoDB driver, async/await
- Clear logging + proper exit codes
