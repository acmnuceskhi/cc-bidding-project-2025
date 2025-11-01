# Quick Setup Guide

## 1. Prerequisites
- Node.js 18+
- MongoDB (local or cloud)

## 2. Installation
```bash
npm install
```

## 3. Environment Setup
Create `.env.local`:
```
MONGODB_URI=mongodb://localhost:27017/cc_bidding_system
```

## 4. Initialize Database
```bash
npm run init-data
```

## 5. Start Development
```bash
npm run dev
```

## 6. Access Points
- **Home**: http://localhost:3000
- **Admin**: http://localhost:3000/admin
- **Projector**: http://localhost:3000/projector
- **Houses**: http://localhost:3000/house/[houseId]

## 7. Usage Flow
1. Admin starts a round for a participant
2. Houses place bids within 1 minute
3. System determines winner (highest bid, earliest timestamp)
4. Results shown on projector
5. Repeat for all 48 participants

## 8. Default Data
- 4 Houses: Lord Shen, Dragon Warrior, Master Oogway, Tai Lung
- 48 Participants: Participant 1-48
- $1000 budget per house

## Troubleshooting
- Ensure MongoDB is running
- Check environment variables
- Run `npm run init-data` if no data appears
- Check browser console for errors