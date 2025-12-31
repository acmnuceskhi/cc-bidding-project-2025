⚠️ **STATUS:** This API documentation may be out of sync with the latest repository state. Please verify endpoint behavior against current route files in `src/app/api/` before relying on this documentation.

# CC Bidding Project - API Documentation

Complete API reference for the team-based auction system.

**Related Documentation:**

- [README.md](../../README.md) - Project overview
- [PROJECT_FLOW.md](./PROJECT_FLOW.md) - System workflows and Socket.io architecture
- [ONBOARDING.md](../../ONBOARDING.md) - Setup and development guide

---

## Authentication & Authorization

All API endpoints (except `/api/time` and `/api/ping`) require JWT authentication via `Authorization: Bearer <token>` header.

**Role-based access:**

- **Admin-only:**
  - Start/end/restart rounds (`/api/rounds/:id/start`, `/api/rounds/:id/end`, `/api/rounds/:id/restart`)
  - Adjust house budgets (`PATCH /api/houses/:id/budget`)
  - View all bids immediately
  - Create rounds (`POST /api/rounds`)

- **House Captain-only:**
  - Submit bids and edit **unlimited times** (`POST /api/bids`)
  - Check batch eligibility (`GET /api/houses/:id/canPlaceBid`)

- **Public endpoints:**
  - Projector status (`GET /api/status`)
  - Server time sync (`GET /api/time`)

**Error Codes:**

- `401 Unauthorized` — Missing or invalid JWT
- `403 Forbidden` — Role not permitted for this endpoint
- `409 Conflict` — Business rule violation (insufficient budget, batch limit, etc.)
- `400 Bad Request` — Invalid request parameters
- `404 Not Found` — Resource not found
- `500 Internal Server Error` — Server-side error

**JWT expiration:** 1 hour (configurable)

---

## Authentication Endpoints

### Login

**POST /api/auth/login**

Authenticate user and receive JWT token.

**Request:**

```json
{
  "username": "admin1",
  "password": "securepassword"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "token": "JWT_TOKEN_HERE",
  "role": "admin",
  "houseId": null
}
```

**Error (401 Unauthorized):**

```json
{
  "success": false,
  "error": "INVALID_CREDENTIALS",
  "message": "Username or password incorrect"
}
```

---

### Logout

**POST /api/auth/logout**

Invalidate current session.

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Get Current User

**GET /api/auth/me**

Retrieve currently authenticated user information.

**Response (200 OK):**

```json
{
  "id": "u1",
  "username": "admin1",
  "role": "admin",
  "houseId": null
}
```

**Response (401 Unauthorized):**

```json
{
  "error": "Authentication required"
}
```

---

## Round Management

### Fetch Rounds

**GET /api/rounds**

Retrieve all rounds with optional filtering.

**Query Parameters:**

- `status` (optional) - Filter by status: `scheduled`, `active`, `completed`
- `passPhase` (optional) - Filter by pass phase: `1`, `2`

**Response:**

```json
[
  {
    "roundId": "r1",
    "teamId": "t1",
    "status": "active",
    "timerEnd": "2025-11-01T10:30:00Z",
    "finalized": false,
    "passPhase": 1,
    "bids": [
      {
        "bidId": "b1",
        "houseId": "h1",
        "teamId": "t1",
        "amount": 100,
        "timestamp": "2025-11-01T10:05:00Z"
      }
    ]
  }
]
```

---

### Create Round

**POST /api/rounds**

Create a new round for a team. **Admin only.**

**Request:**

```json
{
  "teamId": "t1",
  "passPhase": 1
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "roundId": "r1",
  "message": "Round created successfully"
}
```

**Error (400 Bad Request):**

```json
{
  "error": "INVALID_TEAM_ID",
  "message": "Team not found"
}
```

---

### Start Round

**POST /api/rounds/:id/start**

Start a scheduled round. **Admin only.**

**Response (200 OK):**

```json
{
  "success": true,
  "roundId": "r1",
  "timerEnd": "2025-11-01T10:30:00Z",
  "message": "Round started successfully"
}
```

**Error (409 Conflict):**

```json
{
  "error": "ROUND_ALREADY_ACTIVE",
  "message": "Another round is currently active"
}
```

---

### End Round

**POST /api/rounds/:id/end**

Manually end an active round. **Admin only.**

**Response (200 OK):**

```json
{
  "success": true,
  "roundId": "r1",
  "winner": {
    "houseId": "h1",
    "houseName": "Red House",
    "amount": 250,
    "timestamp": "2025-11-01T10:15:30Z"
  },
  "losers": [
    {
      "houseId": "h2",
      "amount": 200,
      "timestamp": "2025-11-01T10:14:00Z"
    }
  ],
  "message": "Round ended successfully"
}
```

**Response (no bids):**

```json
{
  "success": true,
  "roundId": "r1",
  "winner": null,
  "losers": [],
  "message": "Round ended with no bids"
}
```

---

### Restart Round

**POST /api/rounds/:id/restart**

Restart a completed round. Refunds winning house bid, clears team assignment, deletes all bids. **Admin only.**

**Response (200 OK):**

```json
{
  "success": true,
  "canRestart": true,
  "refundedCount": 1,
  "totalRefundAmount": 250,
  "bidsCleared": 3,
  "message": "Round restarted successfully"
}
```

**Response (round not completed):**

```json
{
  "success": true,
  "canRestart": false,
  "refundedCount": 0,
  "message": "Round is not completed; no restart needed"
}
```

---

## Bidding

### Submit Bid

**POST /api/bids**

Submit or update a bid for the active round. **House Captain only.**

**Request:**

```json
{
  "roundId": "r1",
  "amount": 250
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "bidId": "b1",
  "isUpdate": false,
  "message": "Bid submitted successfully"
}
```

**Response (bid updated):**

```json
{
  "success": true,
  "bidId": "b1",
  "isUpdate": true,
  "message": "Bid updated successfully"
}
```

**Error (409 Conflict - Insufficient Budget):**

```json
{
  "success": false,
  "error": "INSUFFICIENT_CREDITS",
  "message": "You have 200 credits remaining, but bid 250"
}
```

**Error (409 Conflict - Batch Limit):**

```json
{
  "success": false,
  "error": "BATCH_LIMIT_EXCEEDED",
  "message": "Cannot bid: house already has maximum teams from this batch"
}
```

**Error (409 Conflict - Round Closed):**

```json
{
  "success": false,
  "error": "ROUND_NOT_ACTIVE",
  "message": "Round is not active for bidding"
}
```

---

### Get Bids

**GET /api/bids?roundId=r1**

Retrieve all bids for a specific round. **Admin can see all bids; House Captains see only their own.**

**Query Parameters:**

- `roundId` (required) - Round ID to fetch bids for

**Response (200 OK):**

```json
{
  "bids": [
    {
      "_id": "b1",
      "roundId": "r1",
      "houseId": "h1",
      "teamId": "t1",
      "amount": 250,
      "timestamp": "2025-11-01T10:05:00Z"
    },
    {
      "_id": "b2",
      "roundId": "r1",
      "houseId": "h2",
      "teamId": "t1",
      "amount": 200,
      "timestamp": "2025-11-01T10:04:30Z"
    }
  ]
}
```

---

## Houses

### Fetch Houses

**GET /api/houses**

Retrieve all houses with budget information.

**Response:**

```json
[
  {
    "_id": "h1",
    "name": "Red House",
    "totalBudget": 1000,
    "remainingBudget": 500
  },
  {
    "_id": "h2",
    "name": "Blue House",
    "totalBudget": 1000,
    "remainingBudget": 300
  }
]
```

---

### Update House Budget

**PATCH /api/houses/:id/budget**

Adjust house budget. **Admin only.**

**Request:**

```json
{
  "totalBudget": 1200,
  "adjustRemainingBy": 50
}
```

**Parameters:**

- `totalBudget` (optional) - Set new total budget
- `adjustRemainingBy` (optional) - Adjust remaining budget by amount (positive or negative)

**Response (200 OK):**

```json
{
  "success": true,
  "house": {
    "_id": "h1",
    "name": "Red House",
    "totalBudget": 1200,
    "remainingBudget": 550
  }
}
```

**Error (400 Bad Request):**

```json
{
  "error": "INVALID_ADJUSTMENT",
  "message": "At least one of totalBudget or adjustRemainingBy must be provided"
}
```

---

### Check Batch Eligibility

**GET /api/houses/:id/canPlaceBid?teamId=t1**

Check if house can bid on a team based on batch constraints.

**Query Parameters:**

- `teamId` (required) - Team ID to check eligibility for

**Response (200 OK - Can bid):**

```json
{
  "canPlaceBid": true,
  "reason": "House can place bid on this team"
}
```

**Response (200 OK - Cannot bid):**

```json
{
  "canPlaceBid": false,
  "reason": "House already has 3 teams from batch 25K (max: 3)"
}
```

---

## Teams

### Fetch Teams

**GET /api/teams**

Retrieve teams with optional filtering.

**Query Parameters:**

- `batch` (optional) - Filter by batch: `25K`, `24K`, etc.
- `houseId` (optional) - Filter by assigned house

**Response:**

```json
[
  {
    "_id": "t1",
    "rank": 1,
    "batch": "25K",
    "successfulAttempts": 8,
    "unsuccessfulAttempts": 2,
    "totalPoints": 850,
    "totalPenalty": 120,
    "houseId": "h1"
  },
  {
    "_id": "t2",
    "rank": 2,
    "batch": "25K",
    "successfulAttempts": 7,
    "unsuccessfulAttempts": 3,
    "totalPoints": 780,
    "totalPenalty": 150,
    "houseId": null
  }
]
```

---

### Get Team Details

**GET /api/teams/:id**

Retrieve detailed information about a specific team including members.

**Response:**

```json
{
  "_id": "t1",
  "rank": 1,
  "batch": "25K",
  "successfulAttempts": 8,
  "unsuccessfulAttempts": 2,
  "totalPoints": 850,
  "totalPenalty": 120,
  "timeTakenPerProblem": [30, 45, 60],
  "houseId": "h1",
  "members": [
    {
      "_id": "p1",
      "name": "Alice",
      "batch": "25K",
      "isTeamCaptain": true
    },
    {
      "_id": "p2",
      "name": "Bob",
      "batch": "25K",
      "isTeamCaptain": false
    }
  ]
}
```

**Error (404 Not Found):**

```json
{
  "error": "TEAM_NOT_FOUND",
  "message": "Team not found"
}
```

---

## Participants

### Fetch Participants

**GET /api/participants**

Retrieve participants with optional filtering.

**Query Parameters:**

- `teamId` (optional) - Filter by team ID
- `houseId` (optional) - Filter by assigned house
- `batch` (optional) - Filter by batch

**Response:**

```json
[
  {
    "_id": "p1",
    "name": "Alice",
    "batch": "25K",
    "teamId": "t1",
    "isTeamCaptain": true,
    "houseId": "h1"
  },
  {
    "_id": "p2",
    "name": "Bob",
    "batch": "25K",
    "teamId": "t1",
    "isTeamCaptain": false,
    "houseId": "h1"
  }
]
```

---

## System Endpoints

### Projector Status

**GET /api/status**

Get current auction state for projector display. **Public endpoint.**

**Response (Bidding Screen):**

```json
{
  "screen": "bidding",
  "roundId": "r1",
  "roundNumber": 5,
  "currentTeam": {
    "id": "t1",
    "rank": 1,
    "batch": "25K",
    "successfulAttempts": 8,
    "totalPoints": 850,
    "members": [
      {
        "name": "Alice",
        "isTeamCaptain": true
      },
      {
        "name": "Bob",
        "isTeamCaptain": false
      }
    ]
  },
  "roundStatus": "active",
  "timerEnd": "2025-11-01T10:30:00Z",
  "timeLeft": 300,
  "bidsPlaced": [
    {
      "houseId": "h1",
      "houseName": "Red House"
    },
    {
      "houseId": "h2",
      "houseName": "Blue House"
    }
  ]
}
```

**Response (Results Screen):**

```json
{
  "screen": "results",
  "roundId": "r1",
  "roundNumber": 5,
  "roundEnded": true,
  "winner": {
    "houseName": "Red House",
    "amount": 250
  },
  "allBids": [
    {
      "houseId": "h1",
      "houseName": "Red House",
      "amount": 250,
      "timestamp": "2025-11-01T10:15:30Z"
    },
    {
      "houseId": "h2",
      "houseName": "Blue House",
      "amount": 200,
      "timestamp": "2025-11-01T10:14:00Z"
    }
  ]
}
```

**Response (Waiting Screen):**

```json
{
  "screen": "waiting",
  "roundStatus": "idle",
  "message": "Waiting for admin to start next round..."
}
```

---

### Server Time

**GET /api/time**

Get server time for client synchronization. **Public endpoint.**

**Response:**

```json
{
  "serverTime": 1730728800000,
  "isoString": "2025-11-01T10:00:00.000Z"
}
```

**Usage:**
Clients should fetch this once on load to calculate time offset:

```javascript
const offset = serverTime - Date.now();
// Use Date.now() + offset for all time calculations
```

---

## Real-time Events (Socket.io)

The system uses Socket.io for real-time updates. See [PROJECT_FLOW.md](./PROJECT_FLOW.md) section 6 for complete Socket.io architecture and event documentation.

**Key Events:**

- `state-update` - Broadcast auction state changes
- `round-started` - Round begins
- `round-ended` - Round completes with results
- `bid-notification` - Bid placed/updated (without amount)
