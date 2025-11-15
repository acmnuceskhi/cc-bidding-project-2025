# ⚡ Socket.IO Quick Reference

**TL;DR:** This is a cheat sheet for implementing sockets. See `SOCKET_IMPLEMENTATION_PLAN.md` for full details.

---

## 🎯 What We're Doing

**Goal:** Replace 4-5 second polling delays with instant (< 100ms) socket updates.

**Approach:** Hybrid - Sockets for real-time, polling as backup (15-30s intervals).

---

## 📁 Files to Create/Modify

### New Files
- ✅ `src/lib/socket-shared.ts` (already created)

### Files to Modify
1. `server.js` - Export socket instance
2. `src/app/api/bids/route.ts` - Emit on bid
3. `src/app/api/rounds/[id]/start/route.ts` - Emit on start
4. `src/app/api/rounds/[id]/end/route.ts` - Emit on end
5. `src/app/api/status/route.ts` - Emit on auto-end
6. `src/app/projector/page.tsx` - Listen for events
7. `src/app/house/[houseId]/page.tsx` - Listen for events
8. `src/app/admin/rounds/page.tsx` - Listen for events (optional)

### Files to Delete
- ❌ `src/lib/socket-server.ts` (dead code)

---

## 🔌 Socket Events

### Events Emitted (Backend → Frontend)

| Event | When | Data |
|-------|------|------|
| `bid-notification` | Bid placed/updated | `{ houseId, houseName, roundId }` |
| `round-started` | Round begins | `{ roundId, teamId, team, timerEnd }` |
| `round-ended` | Round completes | `{ roundId, winner, allBids }` |
| `state-update` | State changes | `{ screen, roundId, ... }` |

### Events Received (Frontend → Backend)

| Event | From | Purpose |
|-------|------|---------|
| `connect` | All | Client connected |
| `disconnect` | All | Client disconnected |

*(Currently no client→server events needed, but can add later)*

---

## 💻 Code Snippets

### 1. Setup Socket Instance (server.js)

```javascript
const { setSocketInstance } = require("./src/lib/socket-shared");

const io = new Server(httpServer, { cors: { origin: "*" } });
setSocketInstance(io); // ✅ Make accessible to API routes
```

### 2. Emit from API Route

```typescript
import { getSocketInstance } from "@/lib/socket-shared";

// After successful operation:
try {
  const io = getSocketInstance();
  io.emit("event-name", { data: "here" });
} catch (err) {
  console.warn("Socket emit failed:", err);
  // Don't fail the request!
}
```

### 3. Listen in Component

```typescript
import { useSocket } from "@/hooks/useSocket";

const { on } = useSocket();

useEffect(() => {
  if (!on) return;
  
  const unsubscribe = on("event-name", (data) => {
    // Update state immediately
    setState(data);
  });
  
  return unsubscribe;
}, [on]);
```

### 4. Reduce Polling

```typescript
// Before: 4-5 seconds
setInterval(fetchData, 4000);

// After: 15-30 seconds (backup only)
setInterval(fetchData, 15000);
```

---

## ✅ Implementation Checklist

### Backend
- [ ] Create `socket-shared.ts` ✅ (done)
- [ ] Update `server.js` to export instance
- [ ] Add emit to bid API
- [ ] Add emit to round start API
- [ ] Add emit to round end API
- [ ] Add emit to auto-end (status API)

### Frontend
- [ ] Projector: Listen for `bid-notification`
- [ ] Projector: Listen for `round-started`
- [ ] Projector: Listen for `round-ended`
- [ ] Projector: Reduce polling to 15s
- [ ] House dashboard: Listen for `round-started`
- [ ] House dashboard: Listen for `round-ended`
- [ ] House dashboard: Reduce polling to 10s
- [ ] Admin: Listen for events (optional)

### Cleanup
- [ ] Delete `socket-server.ts`
- [ ] Clean up `server.js` (remove unused handlers)

### Testing
- [ ] Test bid notifications appear instantly
- [ ] Test round start/end updates instantly
- [ ] Test polling still works as backup
- [ ] Test socket reconnection
- [ ] Test with multiple clients

---

## 🐛 Common Issues

### "Socket.IO instance not initialized"
**Fix:** Make sure `server.js` calls `setSocketInstance(io)` after creating the server.

### Events not received
**Check:**
1. Socket connected? (`isConnected` should be true)
2. Event name matches? (case-sensitive!)
3. Server logs show emit? (check console)
4. Browser console shows connection? (check Network tab)

### Polling still happening too often
**Fix:** Make sure you updated `setInterval` intervals in components.

### Socket fails but API succeeds
**This is correct!** Socket failures shouldn't break API requests. They're logged as warnings.

---

## 📊 Before vs After

| Metric | Before | After |
|--------|--------|-------|
| API Requests/min | 65 | 10-15 |
| Update Latency | 0-5s | < 100ms |
| Server Load | Medium | Low |
| User Experience | Good | Excellent |

---

## 🎯 Quick Start (30 minutes)

1. **Setup (5 min):**
   - Update `server.js` to export instance
   - Test: Check logs show "Instance registered"

2. **Bid Events (10 min):**
   - Add emit to bid API
   - Add listener to projector
   - Test: Place bid, see instant update

3. **Round Events (10 min):**
   - Add emit to round start/end APIs
   - Add listeners to components
   - Test: Start/end round, see instant updates

4. **Reduce Polling (5 min):**
   - Update intervals in components
   - Test: Verify backup polling still works

**Done!** You now have real-time updates.

---

## 📚 Full Documentation

See `SOCKET_IMPLEMENTATION_PLAN.md` for:
- Detailed step-by-step instructions
- Complete code examples
- Testing checklist
- Rollback procedures
- Timeline recommendations

---

**Happy coding! 🚀**

