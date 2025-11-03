# CC Bidding Project – Project Logic Logic Flow

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
  - Can edit placed bid **once only** before timer ends

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

---

## 3. Rounds / Timer Logic

- Rounds are sequential only
- Round auto-closes at timer end or manually by Admin
- Round timer can be extended by Admin
- Tie → earlier bid timestamp decides winner
- Tie with identical timestamps → Admin can rerun round
- Scheduled rounds: each round can have a pre-defined start time; Admin may apply a **delay offset** to shift all subsequent rounds accordingly

**Note:** Bid submission and budget deduction occur atomically on the server to prevent overspending. Scheduled round offsets are also applied atomically.

---

## 4. Key Database Models

| Collection     | Key Fields                                                                        |
| -------------- | --------------------------------------------------------------------------------- |
| `houses`       | name, totalBudget, remainingBudget                                                |
| `participants` | name, picture?, houseId?, roundStats[]                                            |
| `rounds`       | participantId, bids[], status, timerEnd, scheduledStart?                          |
| `bids`         | roundId, houseId, participantId, amount, timestamp, edits?                        |
| `users`        | username, password, role ("admin" \| "house_captain"), houseId?, createdAt, lastLogin? |

---

## 5. Budget & Rules

- 4 teams per house (enforcement outside scope)
- Each team: 2–3 members
- Fixed budget per house
- Only winning bid deducts budget
- Participant assignment via auction only

---


## 6. API Endpoints

**Role-based access (JWT required):**

* **Admin-only:**
  * Start/end rounds (`/api/rounds/:id/start`, `/api/rounds/:id/end`)
  * Rerun rounds in case of tie
  * Adjust house budgets (`PUT /api/houses/:id`)
  * View all bids immediately

* **House Captain-only:**
  * Submit bids and edit **once only** (`/api/bids`)

* **Spectators / Projector-only:**
  * View projector display info (`/api/status`)

* **Public / Auth endpoints:**
  * Login/logout (`/api/auth/login`, `/api/auth/logout`)
  * Ping (`/api/ping`)

**Error / status behavior:**
* 401 Unauthorized — missing or invalid JWT
* 403 Forbidden — role not permitted
* 409 Conflict — business rule violation (bid exceeds budget, bid edit limit, tie needing rerun)
* JWT expiration: 1 hour (adjustable)


**Endpoints:**

### 6.1 Login

**POST /api/auth/login**

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
  "role": "admin"
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

### 6.2 Logout

**POST /api/auth/logout**

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 6.3 Get Current User

**GET /api/auth/me**

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

### 6.4 Fetch Rounds

**GET /api/rounds**

**Response:**
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

### 6.5 Start Round

**POST /api/rounds/:id/start**

**Optional:**
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

### 6.6 End Round

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

**Error (409 Conflict for tie):**
```json
{
  "success": false,
  "error": "TIE_ROUND",
  "message": "Round ended in a tie; admin can rerun round"
}
```

---

### 6.7 Submit Bid

**POST /api/bids**

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
  "message": "Bid submitted successfully"
}
```

**Error (409 Conflict):**
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

### 6.8 Fetch Houses

**GET /api/houses**

**Response:**
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

### 6.9 Fetch Participants

**GET /api/participants**

**Response:**
```json
[
  {
    "participantId": "p1",
    "name": "Alice",
    "picture": "url",
    "houseId": null
  },
  {
    "participantId": "p2",
    "name": "Bob",
    "picture": "url",
    "houseId": "h2"
  }
]
```

---

### 6.10 Projector Status

**GET /api/status**

**Response:**
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