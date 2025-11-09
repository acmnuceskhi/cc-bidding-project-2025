# Auction System Scripts

This directory contains utility scripts for managing the CC Bidding System.

## Available Scripts

### 1. Reset Auction (`reset-auction`)

**Purpose**: Resets the auction to its initial state while keeping all data intact.

**What it does**:
- ✅ Resets all rounds to "scheduled" status
- ✅ Clears all bids
- ✅ Resets house budgets to original amounts
- ✅ Clears participant house assignments

**When to use**: Between testing sessions when you want to start fresh auctions without recreating all the data.

**Usage**:
```bash
npm run reset-auction
```

---

### 2. Full Reset (`full-reset`)

**Purpose**: Complete system reset with fresh data.

**What it does**:
- 🗑️ Drops all collections
- 🏯 Creates 4 houses with $1000 budget each
- 👥 Creates 50 participants
- 🔐 Creates admin and house captain users
- 📋 Creates scheduled rounds for all participants

**When to use**: When you want to start completely fresh or if data gets corrupted.

**Usage**:
```bash
npm run full-reset
```

**Login Credentials** (after full reset):
- **Admin**:
  - Username: `admin`
  - Password: `password123`

- **House Captains**:
  - Lord Shen: `lordshen` / `password123`
  - Dragon Warrior: `dragonwarrior` / `password123`
  - Master Oogway: `masteroogway` / `password123`
  - Tai Lung: `tailung` / `password123`

---

### 3. Initialize Data (`init-data`)

**Purpose**: Initial data seeding (legacy script).

**Usage**:
```bash
npm run init-data
```

---

## Quick Testing Workflow

### Option 1: Quick Reset (Recommended for testing)
```bash
# Reset auction between test runs
npm run reset-auction

# Start the dev server
npm run dev
```

### Option 2: Complete Fresh Start
```bash
# Full system reset
npm run full-reset

# Start the dev server
npm run dev
```

---

## Script Details

### Reset Auction Script
- **File**: `src/scripts/reset-auction.ts`
- **Safe**: Yes, preserves all base data
- **Duration**: ~1 second
- **Use case**: Quick testing iterations

### Full Reset Script
- **File**: `src/scripts/full-reset.ts`
- **Safe**: No, drops all data
- **Duration**: ~2-3 seconds
- **Use case**: Fresh start or data corruption

---

## Troubleshooting

### Script fails with "Cannot connect to MongoDB"
- Check your `.env.local` file has `MONGODB_URI` set
- Ensure MongoDB Atlas is accessible
- Verify your IP is whitelisted in MongoDB Atlas

### Script runs but no changes visible
- Refresh your browser (hard refresh: Ctrl+Shift+R)
- Check the script output for errors
- Verify you're connected to the correct database

### "Collection not found" errors
- Run `npm run full-reset` to recreate all collections
- Check MongoDB Atlas to ensure database exists

---

## Development Notes

All scripts use:
- TypeScript with `tsx` runner
- MongoDB native driver
- Async/await patterns
- Proper error handling and logging

To create a new script:
1. Create file in `src/scripts/`
2. Add script command to `package.json`
3. Document it in this README
