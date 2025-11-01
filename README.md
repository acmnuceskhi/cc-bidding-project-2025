# CC Bidding System

A real-time bidding platform for College Championship participant selection. Built with Next.js, MongoDB, and TypeScript.

## 🚀 Features

- **Real-time bidding system** with 1-minute rounds
- **Admin dashboard** for managing rounds and participants
- **House captain interfaces** for placing bids
- **Live projector display** for spectators
- **Budget management** with equal starting budgets
- **Tie-breaking logic** (highest bid wins, earliest timestamp breaks ties)
- **No socket dependency** - uses polling for real-time updates

## 🏗️ Architecture

### Actors
- **Admin**: Starts/ends rounds, monitors all bids, manages system
- **House Captains**: Place bids within budget constraints
- **Spectators**: View live projector display (no bidding access)

### Core Rules
- 48 participants total
- 4 houses with equal starting budgets ($1000 each)
- 1-minute bidding rounds
- One bid per house per participant
- Highest bid wins (earliest timestamp breaks ties)
- Budget deducted only after winning

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+ 
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd cc-bidding-project-2025
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your MongoDB connection string:
   ```
   MONGODB_URI=mongodb://localhost:27017/cc_bidding_system
   ```

3. **Initialize the database**
   ```bash
   npm run init-data
   ```
   This creates 4 houses and 48 participants with sample data.

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Home: http://localhost:3000
   - Admin Dashboard: http://localhost:3000/admin
   - Projector Display: http://localhost:3000/projector
   - House Dashboards: http://localhost:3000/house/[houseId]

## 📱 Usage Guide

### For Admins
1. Go to `/admin`
2. Select a participant from available list
3. Click "Start Round" to begin 1-minute timer
4. Monitor bids in real-time
5. End round manually or let timer expire
6. View results and winning house

### For House Captains
1. Go to `/house/[your-house-id]` (get ID from home page)
2. Wait for admin to start a round
3. Enter bid amount within your remaining budget
4. Submit bid (one bid per participant allowed)
5. Wait for round results

### For Spectators
1. Go to `/projector` for full-screen display
2. View current participant information
3. See which houses have placed bids (amounts hidden)
4. Watch live countdown timer
5. See results when round ends

## 🗄️ Database Schema

### Collections

**houses**
- `name`: House name (e.g., "Lord Shen")
- `totalBudget`: Starting budget amount
- `remainingBudget`: Current available budget
- `teams[]`: Array of team references

**participants**
- `name`: Participant name
- `picture`: Profile image URL
- `assignedHouse`: Winning house ID (after auction)
- `roundStats[]`: Historical round data

**rounds**
- `participantID`: Current participant being bid on
- `bids[]`: Array of house bids
- `status`: "active" or "completed"
- `timerEnd`: Round expiration timestamp

**bids**
- `houseID`: Bidding house reference
- `participantID`: Target participant reference
- `amount`: Bid amount
- `timestamp`: When bid was placed

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/houses` | GET | Get all houses and budgets |
| `/api/participants` | GET | Get all participants |
| `/api/rounds` | GET/POST | Manage bidding rounds |
| `/api/rounds/[id]/start` | POST | Start specific round |
| `/api/rounds/[id]/end` | POST | End round and determine winner |
| `/api/bids` | GET/POST | Place and retrieve bids |
| `/api/status` | GET | Get current system status for projector |

## 🎯 Key Features

### Real-time Updates
- Polling-based updates every 1-2 seconds
- No WebSocket dependency
- Automatic UI refresh across all interfaces

### Budget Management
- Equal starting budgets for all houses
- Real-time budget validation
- Automatic deduction after winning bids

### Tie Breaking
- Highest bid amount wins
- If amounts equal, earliest timestamp wins
- Clear winner determination logic

### Security
- Budget validation on server-side
- Round timing enforcement
- One bid per house per participant limit

## 🚀 Deployment

### Environment Variables
```bash
MONGODB_URI=your_mongodb_connection_string
```

### Build and Start
```bash
npm run build
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

---

**Built for College Championship 2025** 🏆