# CC Bidding Project – Project Logic Flow

---

## 1. Actors

- **Admin**
  - Starts and ends rounds only
  - Can view bids (admin-only)
  - Adjusts remaining points if needed
  - **Does not create rounds**; rounds are from a predefined participant list

- **House Captain**
  - Places bids from remaining house points
  - Can edit placed bid once only before timer ends

- **Spectators**
  - Only view projector display
  - Cannot see bids or budget

---

## 2. Project Flow

### A. Admin Workflow

1. Start predefined round → status active
2. Timer runs for the round
3. Admin can end round manually or let timer expire
4. At round end:
   - Determine highest bid
   - Deduct bid from winning house's remainingBudget
   - Assign participant to winning house
   - Update house's team members
   - If tie → re-run round with tied houses only
5. Display results automatically on projector

### B. House Captain Workflow

- Place bid within remaining budget
- Bids visible only to Admin
- Cannot exceed total budget

### C. Spectator / Projector Display

- Current participant info (name, picture, round stats)
- Round number
- Houses that placed a bid (without showing amounts)
- Winning house when timer ends

---

## 3. Rounds / Timer Logic

- Rounds are sequential only
- Round auto-closes at timer end or manually by Admin
- Round timer can be extended by Admin
- Tie → rerun round with tied houses only

---

## 4. Database Transactions / Atomicity

- Bid submission → check budget → add bid → update round → update house → assign participant

---

## 5. API Endpoints

| Endpoint                | Method | Description                                         |
| ----------------------- | ------ | --------------------------------------------------- |
| `/api/rounds`           | GET    | Fetch current/previous rounds                       |
| `/api/rounds/:id/start` | POST   | Admin: start round                                  |
| `/api/rounds/:id/end`   | POST   | Admin: end round, determine winner                  |
| `/api/bids`             | POST   | House captain: place bid                            |
| `/api/houses`           | GET    | Fetch house info & remaining budget                 |
| `/api/participants`     | GET    | Fetch participant info                              |
| `/api/status`           | GET    | Projector display: current participant + round info |

---

## 6. Budget / Member Rules

- 4 teams per house
- Each team: 2–3 members
- Fixed budget per house
- Bids can only be placed within remaining points
- Budget deduction happens after winning bid only

---

## 7. Database / Collections (MongoDB)

All models are located in `src/lib/models/`:

| Collection     | Purpose                                   | Key Fields                                    |
| -------------- | ----------------------------------------- | --------------------------------------------- |
| `houses`       | Stores house details and remaining budget | name, totalBudget, remainingBudget, teams[]   |
| `participants` | Participant info                          | name, picture, assignedHouse, roundStats[]    |
| `rounds`       | Track each round and bids                 | participantId, bids[], status, timerEnd       |
| `bids`         | Individual bid entries                    | houseId, participantId, amount, timestamp     |
| `teams`        | Optional: separate teams per house        | houseId, members[]                            |
