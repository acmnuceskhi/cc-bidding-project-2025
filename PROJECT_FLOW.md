# CC Bidding Project – Project Logic Flow

**Team-based auction system**. Qualified teams from Round 1 are auctioned to houses through competitive bidding.

---

## 1. Actors

- **Admin**
  - Starts, stops, and restarts rounds (from `/admin/rounds`)
  - Views all bids in real-time
  - Adjusts house budgets from `/admin` or `/api/houses/[id]/budget`
  - Configures auction settings from `/admin/config` (teams per batch, round duration, etc.)
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

---

## 2. Project Flow

### A. Admin Workflow

1. Start predefined round → status active
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
7. Admin configures auction settings from `/admin/config`:
   - Max teams per batch per house
   - Round duration and countdown warning time
   - Auto-start next round behavior

### B. House Captain Workflow

- Place bid within remaining budget
- Bids visible only to Admin during active round
- All bids visible to everyone when round ends
- Cannot exceed remaining budget
- Can edit bid unlimited times before timer ends
- Bid edits update `bids.amount` only

### C. Spectator / Projector Display

- Current team info:
  - Team rank and batch
  - Round 1 statistics (successful/unsuccessful attempts, points, penalty)
  - **Team members** (participant names, team captain indicated)
- Round number and pass phase
- Houses that placed bids (without amounts during round)
- Winning house and **all bid amounts/timestamps** when round ends
- Live updates via **WebSocket** (Socket.io)

---

## 3. Rounds / Timer Logic

- Rounds are sequential (one at a time)
- Round auto-closes when timer expires or manually ended by Admin
- Tie → earlier bid timestamp wins
- Tie with identical timestamps → Admin can rerun round
- Bid submission and budget deduction are atomic to prevent overspending

---

## 4. Key Database Models

| Collection     | Key Fields                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `teams`        | rank, batch, successfulAttempts, unsuccessfulAttempts, totalPoints, totalPenalty, timeTakenPerProblem, houseId?                     |
| `participants` | name, batch, teamId, houseId?, isTeamCaptain                                                                                        |
| `rounds`       | teamId, status ("scheduled" \| "active" \| "completed"), timerEnd, finalized, passPhase                                             |
| `bids`         | roundId, houseId, teamId, amount, timestamp                                                                                         |
| `houses`       | name, totalBudget, remainingBudget                                                                                                  |
| `users`        | username, password, role ("admin" \| "house_captain"), houseId?, createdAt, lastLogin?                                              |
| `config`       | maxTeamsPerBatch, roundDurationSeconds, countdownWarningSeconds, autoStartNextRound, delayBetweenRoundsSeconds (singleton document) |

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

---

## 6. Server-Client Architecture

### Real-time Communication

The system uses **Socket.io** for real-time bidding updates alongside traditional HTTP APIs. Both mechanisms work together for resilience.

**Architecture Principles:**

1. **Database as Source of Truth**: All critical data (rounds, bids, teams, houses) stored in MongoDB
2. **Stateless Socket.io**: Server doesn't hold state in memory; fetches from DB on reconnection
3. **Polling Fallback**: Clients poll `/api/status` every 2 seconds as backup to Socket.io
4. **Independent Time Sync**: Clients sync time once via `/api/time` and calculate countdowns locally

### Socket.io Events

**Server → Client (Broadcast):**

- `state-update` - Current auction state (screen, roundId, teamId, timeLeft)
- `round-started` - Round begins with team details and timer
- `round-ended` - Round completes with winner and all bids
- `bid-notification` - House placed/updated bid (without amount for privacy)

**Client → Server (Admin only):**

- `admin:start-round` - Start a round (triggers broadcast)
- `admin:end-round` - End round manually (triggers broadcast)
- `bid-placed` - Notify all clients when bid submitted

**Client → Server (House Captains):**

- `bid-placed` - Notify bid submission (triggers broadcast)

### Resilience Mechanisms

**1. Stateless Socket.io Server**

- On client reconnection, server fetches current state from MongoDB
- No in-memory state that can be lost on server restart
- `currentState` rebuilt from database queries on every new connection
- Implementation: `buildStateFromDB()` function queries active/recent rounds

**2. Automatic Reconnection**

- Socket.io client auto-reconnects with exponential backoff
- On reconnect, client re-fetches `/api/status` to sync with DB
- Polling continues even when Socket.io disconnected
- Implementation: `useSocket` hook handles reconnection logic

**3. API Polling Fallback**

- Projector polls `/api/status` every 2 seconds
- House captain pages poll status during active rounds
- Admin dashboard polls rounds list
- Ensures functionality even if Socket.io fails completely

**4. Independent Timer System**

- Clients fetch server time once via `/api/time`
- Calculate time offset: `serverTime - clientTime`
- All countdowns use `Date.now() + offset` for accuracy
- Timers continue running even if server crashes
- Implementation: `useServerTime` and `useSynchronizedCountdown` hooks

**5. Error Handling**

- Socket.io errors logged but don't crash server
- Client shows reconnection status in UI
- Graceful degradation: polling takes over if Socket.io fails
- Try-catch blocks around all socket event handlers

### Production Deployment Best Practices

**Socket.io Configuration:**

```typescript
// server.js - Production-ready settings
io = new SocketIOServer(httpServer, {
  pingTimeout: 60000, // 60s before considering connection dead
  pingInterval: 25000, // Send ping every 25s
  connectTimeout: 45000, // 45s to establish connection
  transports: ["websocket", "polling"], // Fallback to polling
});
```

**State Management:**

```typescript
// socket-server.ts - Stateless approach
io.on("connection", async (socket) => {
  // Always fetch fresh state from DB, never from memory
  const currentState = await buildStateFromDB();
  socket.emit("state-update", currentState);
});

async function buildStateFromDB(): Promise<AppState> {
  // 1. Check for active round
  const activeRound = await Rounds.findOne({ status: "active" });
  if (activeRound) return buildBiddingState(activeRound);

  // 2. Check for recently completed round (show results)
  const recentCompleted = await Rounds.findOne(
    { status: "completed", finalized: true },
    { sort: { timerEnd: -1 } }
  );
  if (recentCompleted && withinLast30Seconds(recentCompleted)) {
    return buildResultsState(recentCompleted);
  }

  // 3. Default to waiting screen
  return { screen: "waiting", message: "..." };
}
```

**Client Reconnection:**

```typescript
// useSocket.ts - Handle reconnection
socket.on("connect", async () => {
  setIsConnected(true);

  // Re-sync state from DB after reconnection
  const res = await fetch("/api/status");
  const freshState = await res.json();
  // Update local state from authoritative DB source
});
```

**Memory Management:**

- Socket.io connections cleaned up on disconnect automatically
- No in-memory state stored (prevents memory leaks)
- Garbage collection handles closed connections
- Event listeners properly removed on disconnect

**Scalability:**

- Single server instance sufficient for ~50 concurrent users
- For horizontal scaling: use Redis adapter for Socket.io
  ```bash
  npm install @socket.io/redis-adapter redis
  ```
- Database connection pooling via MongoDB client (already configured)
- Consider sticky sessions for multi-instance deployments

**Crash Recovery:**

- Server restart: clients auto-reconnect within 1-2 seconds
- State recovered from MongoDB immediately via `buildStateFromDB()`
- Active rounds continue (timers are client-side with `useServerTime`)
- No data loss since all critical state in database

**Monitoring:**

- Log Socket.io connections/disconnections with timestamps
- Track API polling frequency and response times
- Monitor MongoDB query performance (add indexes if needed)
- Alert on high reconnection rates (indicates server instability)
- Track memory usage to detect leaks

**Error Scenarios Handled:**

1. Server crash → Clients reconnect, fetch state from DB, timers continue
2. Database slowdown → Socket.io continues, polling provides fallback
3. Network interruption → Client reconnects automatically, re-syncs state
4. Socket.io failure → Polling provides full functionality
5. Memory exhaustion → Stateless design prevents state accumulation

---

## 7. API Reference

See **[API.md](./API.md)** for complete API endpoint documentation including:

- **Authentication** - Login, logout, session management
- **Round Management** - Create, start, end, restart rounds
- **Bidding Operations** - Submit bids, fetch bids, validate eligibility
- **Houses** - Fetch houses, update budgets, check batch constraints
- **Teams** - Fetch teams, get team details with members
- **Participants** - Query participants by team, house, or batch
- **System Endpoints** - Projector status, server time sync

**Quick Reference:**

| Category     | Endpoints                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Auth         | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`                                                             |
| Rounds       | `GET /api/rounds`, `POST /api/rounds`, `POST /api/rounds/:id/start`, `POST /api/rounds/:id/end`, `POST /api/rounds/:id/restart` |
| Bidding      | `POST /api/bids`, `GET /api/bids`                                                                                               |
| Houses       | `GET /api/houses`, `PATCH /api/houses/:id/budget`, `GET /api/houses/:id/canPlaceBid`                                            |
| Teams        | `GET /api/teams`, `GET /api/teams/:id`                                                                                          |
| Participants | `GET /api/participants`                                                                                                         |
| System       | `GET /api/status`, `GET /api/time`                                                                                              |

---
