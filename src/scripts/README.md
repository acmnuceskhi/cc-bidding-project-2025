# Auction Scripts

> Utility scripts to manage data for the CC Bidding System. All scripts load `.env.local` / `.env` and exit 0 on success, 1 on failure.

## Scripts

### reset-auction

Resets auction state while keeping core entities.

- Sets every round to `scheduled` (keeps original `scheduledStart`)
- Deletes all bids
- Restores each house's `remainingBudget` to `totalBudget`
- Clears participant `houseId`

Run:

```powershell
npm run reset-auction
```

### full-reset

Drops all collections and reseeds canonical demo data.

- 4 houses (1000 credits each)
- Ranked Round‑1 teams (rank 1..4)
- 48 participants (with roll numbers + team assignment)
- Users: 1 admin + 4 captains
- Scheduled rounds with `scheduledStart` + `timerEnd`

Credentials:

- Admin: `admin / admin123`
- Captains:
  - `captain_lord_shen / captain123`
  - `captain_dragon_warrior / captain123`
  - `captain_master_oogway / captain123`
  - `captain_tai_lung / captain123`

Run:

```powershell
npm run full-reset
```

### seed-test-data

Seeds test dataset (same credential scheme as full-reset) without dropping collections first. Useful after manual tweaks.
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
