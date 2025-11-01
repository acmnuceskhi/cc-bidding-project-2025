# CC Bidding Project – Project Logic Flow

---

## 1. Actors

- **Admin**
  - Starts and ends rounds only
  - Can view bids immediately when placed
  - Adjusts remaining points if needed
  - **Does not create rounds**; rounds are from a predefined participant list
  - Can rerun rounds in case of ties with identical timestamps

- **House Captain**
  - Places bids from remaining house points
  - Can edit placed bid **once only** before timer ends (tracked via `edits` field)

- **Spectators**
  - Only view projector display
  - Cannot see bids or budget during round
  - Can see winning/losing bids/timestamps when round ends

---

## 2. Project Flow

### A. Admin Workflow

1. Start predefined round → status active (manual or scheduled)
2. Timer runs for the round
3. Admin can end round manually or let timer expire
4. At round end:
   - Determine highest bid
   - Tie → earlier bid timestamp wins
   - Tie with identical timestamps → Admin can rerun round
   - Deduct bid from winning house's remainingBudget atomically
   - Assign participant to winning house
   - Display **winning and losing bid amounts with timestamps** on projector
5. Display results automatically on projector
6. Scheduled rounds: Admin can **offset schedule** for all subsequent rounds by a delay input; all subsequent rounds' scheduled start times are updated atomically
7. If a round is rerun, **previous bids are refunded** to the respective houses

### B. House Captain Workflow

- Place bid within remaining budget
- Bids visible only to Admin during round; visible to all when round ends
- Cannot exceed total budget
- Bid edits tracked with `edits` field; attempts beyond 1 return `409 Conflict`

### C. Spectator / Projector Display

- Current participant info (name, picture, round stats)
- Round number
- Houses that placed a bid (without showing amounts during round)
- Winning house and **winning/losing bid amounts/timestamp** when round ends
- Live updates via **SSE or WebSocket** recommended (polling optional)
- Canonical events (examples):
  - `round:started` → `{ roundId, participantId, scheduledStart }`
  - `bid:placed` → `{ bidId, houseId, amount, edits }`
  - `round:ended` → `{ roundId, winner, losers }`

---

## 3. Rounds / Timer Logic

- Rounds are sequential only
- Round auto-closes at timer end or manually by Admin
- Round timer can be extended by Admin
- Tie → earlier bid timestamp decides winner
- Tie with identical timestamps → Admin can rerun round
- Scheduled rounds: each round can have a pre-defined start time; Admin may apply a **delay offset** to shift all subsequent rounds accordingly

---

## 4. Database Transactions / Atomicity

- Bid submission → check budget → add bid → update round → update house → assign participant
- Ensure **winner calculation** is atomic considering bid amount and timestamp
- Prevent overspend using **server-side budget check + decrement in one atomic operation**
- Bid edits tracked with `edits` field
- Scheduled start time updates must also be atomic
- MongoDB multi-document transactions require **Atlas (replica set)**

**Concurrency note:**  
Example: inside a MongoDB transaction, decrement house budget only if `remainingBudget >= bid.amount` and insert bid atomically to avoid race conditions.

---

## 5. API Endpoints

**All endpoints requiring authentication use JWT:** `Authorization: Bearer <token>`

- Admin-only: `/api/rounds/:id/start`, `/api/rounds/:id/end`, rerun actions
- House Captain-only: `/api/bids`
- Token expiration: 1 hour (example; adjustable)
- 403 Forbidden returned if role not allowed
- 409 Conflict returned for business rule violations (e.g., insufficient budget, exceeding bid edits)

---

### 5.1 Login

**POST /api/auth/login**

**Request Body:**

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
  "role": "admin"
}
```

**Error Response (401 Unauthorized):**

```json
{
  "success": false,
  "error": "INVALID_CREDENTIALS",
  "message": "Username or password incorrect"
}
```

---

### 5.2 Logout

**POST /api/auth/logout**

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 5.3 Get Current User

**GET /api/auth/me**  
Requires `Authorization: Bearer <token>`

**Response (200 OK):**

```json
{
  "id": "u1",
  "username": "admin1",
  "role": "admin",
  "houseId": null
}
```

---

### 5.4 Fetch Rounds

**GET /api/rounds**  
Optional pagination: `?limit=10&page=1`

**Response (200 OK):**

```json
[
  {
    "roundId": "r1",
    "participantId": "p1",
    "status": "active",
    "timerEnd": "2025-11-01T10:30:00Z",
    "scheduledStart": "2025-11-01T10:00:00Z",
    "bids": [
      {
        "bidId": "b1",
        "houseId": "h1",
        "amount": 100,
        "timestamp": "2025-11-01T10:05:00Z",
        "edits": 0
      }
    ]
  }
]
```

---

### 5.5 Start Round

**POST /api/rounds/:id/start**

**Request Body (optional):**

```json
{
  "delayOffsetMinutes": 5
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "roundId": "r1",
  "message": "Round started successfully"
}
```

---

### 5.6 End Round

**POST /api/rounds/:id/end**

**Response (200 OK):**

```json
{
  "success": true,
  "roundId": "r1",
  "winner": {
    "houseId": "h1",
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

**Error Response (409 Conflict for tie needing rerun):**

```json
{
  "success": false,
  "error": "TIE_ROUND",
  "message": "Round ended in a tie; admin can rerun round"
}
```

---

### 5.7 Submit Bid

**POST /api/bids**

**Request Body:**

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
  "message": "Bid submitted successfully"
}
```

**Error Response (409 Conflict for insufficient credits or exceeding edits):**

```json
{
  "success": false,
  "error": "INSUFFICIENT_CREDITS",
  "message": "You have 200 credits remaining, but bid 250"
}
```

```json
{
  "success": false,
  "error": "BID_EDIT_LIMIT",
  "message": "Bid can only be edited once"
}
```

---

### 5.8 Fetch Houses

**GET /api/houses**  
Optional pagination: `?limit=10&page=1`

**Response (200 OK):**

```json
[
  {
    "houseId": "h1",
    "name": "Red House",
    "remainingBudget": 500
  },
  {
    "houseId": "h2",
    "name": "Blue House",
    "remainingBudget": 300
  }
]
```

---

### 5.9 Fetch Participants

**GET /api/participants**  
Optional pagination: `?limit=10&page=1`

**Response (200 OK):**

```json
[
  {
    "participantId": "p1",
    "name": "Alice",
    "picture": "url",
    "assignedHouse": null
  },
  {
    "participantId": "p2",
    "name": "Bob",
    "picture": "url",
    "assignedHouse": "h2"
  }
]
```

---

### 5.10 Projector Status

**GET /api/status**  
Projector display: current participant + round info. SSE/WebSocket recommended for live updates.

**Response (200 OK):**

```json
{
  "roundId": "r1",
  "participant": {
    "participantId": "p1",
    "name": "Alice",
    "picture": "url"
  },
  "roundStatus": "active",
  "timerRemaining": 300,
  "bidsPlaced": [
    {
      "houseId": "h1"
    },
    {
      "houseId": "h2"
    }
  ]
}
```

---

## 6. Budget / Member Rules

- 4 teams per house (enforcement not part of this project)
- Each team: 2–3 members
- Fixed budget per house
- Bids can only be placed within remaining points
- Budget deduction happens after winning bid only
- Participant assignment is only via auction, not pre-created teams

---

## 7. Database / Collections (MongoDB)

All models are located in `src/lib/models/`:

| Collection     | Purpose                                   | Key Fields                                              |
| -------------- | ----------------------------------------- | ------------------------------------------------------- |
| `houses`       | Stores house details and remaining budget | name, totalBudget, remainingBudget                      |
| `participants` | Participant info                          | name, picture, assignedHouse, roundStats[]              |
| `rounds`       | Track each round and bids                 | participantId, bids[], status, timerEnd, scheduledStart |
| `bids`         | Individual bid entries                    | houseId, participantId, amount, timestamp, edits        |
