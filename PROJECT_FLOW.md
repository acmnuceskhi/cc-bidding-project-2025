# CC Bidding Project – Project Logic Flow

Team-based auction system. Qualified teams from Round 1 are auctioned to houses through competitive blind bidding with real-time Socket.io updates.

---

## 1. Actors

- **Admin**
  - Starts, stops, and restarts rounds (from `/admin/rounds`)
  - Views all bids in real-time
  - Adjusts house budgets from `/admin` or `/api/houses/[id]/budget`
  - Configures auction settings from `/admin/config` (teams per batch, round duration, countdown warning, delays)
  - Can restart any round at any time to refund winning bid and reset team assignment
  - **Note:** Rounds are predefined for all qualified teams; admin controls timing only

- **House Captain**
  - Places bids from remaining house budget
  - Can edit placed bid **unlimited times** before timer ends
  - Subject to batch constraints (max teams from same batch, configurable)

- **Spectators (Projector)**
  - View team information (rank, batch, Round 1 stats, team members)
  - Cannot see bid amounts during active rounds
  - See all bids with timestamps when round ends
  - Subscribe to live updates via Socket.io (no polling)

---

## 2. Project Flow

### A. Admin Workflow

1. Start predefined round (or start "next" unsold team) → status active
2. Timer runs for the round (configurable via `/admin/config`)
3. Admin can end round manually or let timer expire
4. At round end:
   - Determine highest bid
   - Tie → earlier bid timestamp wins
   - Deduct bid from **winning house only**
   - Assign team to winning house
   - Display **winning and losing bid amounts with timestamps** on projector
5. Results displayed automatically via Socket.io
6. Admin can **restart any completed round** from `/admin/rounds`:
   - Refunds the **winning house bid only** (only winner's budget was deducted)
   - Clears team assignment (team.houseId set to null)
   - Deletes all bids for that round

- Round status reset to scheduled/pending for re-auction
- If the round was unsold in pass 1, restart moves it to pass 2

7. Admin configures auction settings from `/admin/config`:
   - Max teams per batch per house

- Round duration and countdown warning time
- Auto-start next round behavior and delay between rounds

Additional admin actions:

- Validate win for the currently-open team via `POST /api/validate-win` (deducts winner budget and assigns team; emits socket updates)
- Start next available unsold team via `POST /api/rounds/next/start`

### B. House Captain Workflow

- Place bid within remaining budget
- Bids visible only to Admin during active round
- All bids visible to everyone when round ends
- Cannot exceed remaining budget
- Can edit bid unlimited times before timer ends
- Last bid per house is considered; previous bid is replaced atomically
- Send `{ teamId, amount }` to `POST /api/bids` (back-compat: `roundId` accepted as `teamId`)
- Sending `amount: 0` acts as an explicit skip (no bid document created)

### C. Spectator / Projector Display

- Current team info:
  - Team rank and batch
  - Round 1 statistics (successful/unsuccessful attempts, points, penalty)
  - **Team members** (participant names, team captain indicated)
- Round number and pass phase
- Houses that placed bids (without amounts during round)
- Winning house and **all bid amounts/timestamps** when round ends
- Live updates via **Socket.io**

---

## 3. Rounds / Timer Logic

- Rounds are sequential (one at a time)
- Round auto-closes when timer expires or manually ended by Admin
- Tie → earlier bid timestamp wins
- Tie with identical timestamps → Admin can rerun round
- Bid submission and budget deduction are atomic to prevent overspending
- Authoritative auction window (start/end) is stored in `config` and broadcast to clients

---

## 4. Key Database Models

| Collection     | Key Fields                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `teams`        | rank, batch, successfulAttempts, unsuccessfulAttempts, totalPoints, totalPenalty, timeTakenPerProblem, houseId?                     |
| `participants` | name, batch, teamId, houseId?, isTeamCaptain                                                                                        |
| `rounds`       | teamId, status ("scheduled" \| "active" \| "completed"), timerEnd, finalized, passPhase                                             |
| `bids`         | roundId, houseId, teamId, amount, timestamp (latest per house per team is authoritative)                                            |
| `houses`       | name, totalBudget, remainingBudget                                                                                                  |
| `users`        | username, password, role ("admin" \| "house_captain"), houseId?, createdAt, lastLogin?                                              |
| `config`       | maxTeamsPerBatch, roundDurationSeconds, countdownWarningSeconds, autoStartNextRound, delayBetweenRoundsSeconds (singleton document) |
| (config state) | currentRound, auctionStartTime, auctionEndTime, currentRoundStartTime, currentRoundEndTime                                          |

---

## 5. Budget & Rules

- **Teams:** Variable number of qualified teams from Round 1 (e.g., 16 teams for testing, actual number TBD)
- **Team composition:** 2-3 participants per team
- **Houses:** 4 houses competing to acquire teams
- **Budget:** Fixed budget per house (e.g., 1000 points)
- **Bidding:** Only winning bid deducts from house budget (losing bids not deducted)
- **Team assignment:** Teams assigned to houses via auction only
- **Batch constraints:** Configurable max teams per batch per house (via `/admin/config`)
- **Pass phases:**
  - **Pass 1:** All qualified teams auctioned sequentially
  - **Pass 2:** Only triggers if any house fails to meet minimum team requirement in Pass 1
  - In Pass 2, only unsold teams are re-auctioned
- **Bid semantics:** `amount: 0` is treated as "skip"; no batch-limit enforcement for skip

---

## 6. Server-Client Architecture

### Real-time Communication

The system uses Socket.io for real-time bidding updates. HTTP APIs remain authoritative for mutations and one-off reads.

Principles:

- Database is the source of truth (MongoDB)
- Socket server is stateless; authoritative state is derived from the `config` document and broadcast as `auction-state`
- No periodic polling for UI state; clients request a one-time snapshot on connect and then listen for events
- Independent time sync via `/api/time` every ~10s for stable countdowns

### Socket.io Events

Server → Client:

- `auction-state` — Authoritative snapshot built from `config`:
  - `{ currentRound, auctionStartTime, auctionEndTime, currentRoundStartTime, currentRoundEndTime, serverTime }`
- `state-update` — Lightweight signal to refresh UI context (bidding/results cues)
- `round-started` — `{ roundId, timerEnd }` when a round opens
- `round-ended` — `{ roundId, winner, losers }` when a round closes
- `bid-notification` — `{ houseId, houseName, roundId }` on bid placement
- `bids-update` —
  - To `admins` room: `{ teamId, bids: Array<{ houseId, houseName, amount }> }`
  - To a `house:<id>` room: `{ teamId, houseId, amount }`
- `budget-update` — `{ houseId, remainingBudget }` after win validation

Client → Server:

- `request-state` — Acks with `auction-state` for immediate resync on connect/reconnect
- `bid-placed` — Client-side notification after placing a bid via REST

### Resilience & Behavior

1. Stateless sockets

- On connect/reconnect, the server emits `auction-state` built from `config` (see `server.js: buildAuctionStateFromConfig`)
- No in-memory authoritative state; UI can always resync via `request-state`

2. Reconnection

- Client auto-reconnects with backoff; on `connect` the hook sends `request-state`
- If the ack is empty, the client falls back to `GET /api/config` once

3. Time sync

- `useServerTime` syncs via `GET /api/time` every ~10s; countdowns derive from `auction-state` timestamps + offset

4. Rooms & auth

- Client sends `handshake.auth.token` (JWT) from `sessionStorage`
- Server joins `house:<houseId>` for captains; `admins` room for admins
- API routes emit targeted updates using rooms

5. Error handling

- Socket errors are logged (dev) and do not crash the server
- UI removes listeners on unmount and shows reconnecting states when applicable

### Production Notes

Socket.io configuration (see `server.js`):

```ts
new Server(httpServer, {
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e6,
  transports: ["websocket", "polling"],
  cors: {
    origin: process.env.RENDER_EXTERNAL_URL || "*",
    methods: ["GET", "POST"],
  },
});
```

Authoritative state broadcasting:

- On connect and on `request-state`, server emits `auction-state` built from `config`
- API routes also emit `auction-state` after changes to `config` timestamps and currentRound

Scaling:

- Single instance is sufficient for the expected audience; for horizontal scaling use the Redis adapter and sticky sessions

---

## 7. API Reference

See `API.md` for complete endpoint documentation including:

- **Authentication** - Login, logout, session management
- **Round Management** - Create, start, end, restart rounds
- **Bidding Operations** - Submit bids, fetch bids, validate eligibility
- **Houses** - Fetch houses, update budgets, check batch constraints
- **Teams** - Fetch teams, get team details with members
- **Participants** - Query participants by team, house, or batch
- **System Endpoints** - Projector status, server time sync

Quick reference:

| Category     | Endpoints                                                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth         | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`                                                                                                                   |
| Rounds       | `GET /api/rounds`, `GET /api/rounds/:id`, `POST /api/rounds`, `POST /api/rounds/:id/start`, `POST /api/rounds/:id/end`, `POST /api/rounds/:id/restart`, `POST /api/rounds/next/start` |
| Bidding      | `POST /api/bids` (body: `{ teamId, amount, previousAmount }`, back-compat `roundId`), `GET /api/bids?teamId=...`/`?houseId=...`                                                       |
| Config       | `GET /api/config`, `PUT /api/config` (also emits `auction-state`)                                                                                                                     |
| Validation   | `POST /api/validate-win` (finalize winner and budget; emits `budget-update`/`bids-update`)                                                                                            |
| Houses       | `GET /api/houses`, `PATCH /api/houses/:id/budget`                                                                                                                                     |
| Teams        | `GET /api/teams`, `GET /api/teams/:id`                                                                                                                                                |
| Participants | `GET /api/participants`                                                                                                                                                               |
| System       | `GET /api/status` (admin orchestration/snapshot), `GET /api/time` (time sync)                                                                                                         |

---
