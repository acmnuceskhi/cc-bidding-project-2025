# 🚀 Socket.IO Implementation Plan

**Goal:** Replace polling with real-time Socket.IO events for instant updates

**Current State:** Socket.IO server exists but is unused. Everything uses REST API polling.

**Target State:** Real-time updates via sockets, with polling as backup fallback.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Implementation Strategy](#implementation-strategy)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Code Changes Required](#code-changes-required)
5. [Testing Checklist](#testing-checklist)
6. [Rollback Plan](#rollback-plan)
7. [Timeline Options](#timeline-options)

---

## 🏗️ Architecture Overview

### Current Architecture (Polling Only)
```
Frontend → Poll /api/status every 4-5s → Update UI
         → Poll /api/houses every 5s → Update budget
```

### Target Architecture (Sockets + Polling Backup)
```
Frontend → Connect to Socket.IO → Listen for events → Update UI instantly
         → Poll every 15-30s as backup (if socket fails)
```

### Socket Events Flow
```
┌─────────────┐
│ API Routes  │
│ (Backend)   │
└──────┬──────┘
       │ Emit socket events
       ▼
┌─────────────┐
│ Socket.IO   │
│   Server    │
└──────┬──────┘
       │ Broadcast to all clients
       ▼
┌─────────────┐
│  Frontend   │
│ Components  │
└─────────────┘
```

---

## 🎯 Implementation Strategy

### Phase 1: Make Socket Server Accessible
- Export socket instance from `server.js` so API routes can use it
- Create helper functions to emit events

### Phase 2: Emit Events from API Routes
- `POST /api/bids` → Emit `bid-placed` event
- `POST /api/rounds/[id]/start` → Emit `round-started` event
- `POST /api/rounds/[id]/end` → Emit `round-ended` event
- `GET /api/status` (auto-end) → Emit `round-ended` event

### Phase 3: Listen in Frontend Components
- Projector: Listen for `bid-notification`, `round-started`, `round-ended`
- House dashboards: Listen for `round-started`, `round-ended`
- Admin: Listen for all events

### Phase 4: Reduce Polling Frequency
- Keep polling as backup (15-30s intervals)
- Use sockets for real-time updates

### Phase 5: Clean Up Dead Code
- Remove unused `socket-server.ts` file
- Consolidate socket logic in `server.js`

---

## 📝 Step-by-Step Implementation

### Step 1: Export Socket Instance from server.js

**File:** `server.js`

**Change:** Make `io` accessible to API routes

```javascript
// At the top, after creating io
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ✅ ADD THIS: Export io instance
global.io = io; // Make it globally accessible

// Or better: Create a module to share it
// (See Step 2 for better approach)
```

**Better Approach:** Create a shared socket module

**File:** `src/lib/socket-shared.ts` (NEW FILE)

```typescript
import { Server as SocketIOServer } from "socket.io";

let ioInstance: SocketIOServer | null = null;

export function setSocketInstance(io: SocketIOServer) {
  ioInstance = io;
}

export function getSocketInstance(): SocketIOServer {
  if (!ioInstance) {
    throw new Error("Socket.IO instance not initialized. Make sure server.js has called setSocketInstance()");
  }
  return ioInstance;
}

export function emitToAll(event: string, data: any) {
  if (ioInstance) {
    ioInstance.emit(event, data);
  } else {
    console.warn(`[Socket] Cannot emit ${event}: Socket.IO not initialized`);
  }
}
```

**Update server.js:**
```javascript
const { setSocketInstance } = require("./src/lib/socket-shared");

// After creating io:
const io = new Server(httpServer, { ... });
setSocketInstance(io); // ✅ Make it accessible
```

---

### Step 2: Emit Events from Bid API

**File:** `src/app/api/bids/route.ts`

**Location:** After successful bid creation (line 199)

```typescript
import { getSocketInstance } from "@/lib/socket-shared";

// ... existing code ...

// After line 199: await Bids.upsertBid(...)
await Bids.upsertBid(roundId, houseId, round.teamId.toString(), amount);

// ✅ ADD THIS: Emit socket event
try {
  const io = getSocketInstance();
  io.emit("bid-notification", {
    houseId,
    houseName: house.name,
    roundId,
    timestamp: new Date().toISOString(),
  });
  console.log(`[Socket] Emitted bid-notification for house ${house.name}`);
} catch (err) {
  // Don't fail the request if socket fails
  console.warn("[Socket] Failed to emit bid-notification:", err);
}

return NextResponse.json({
  success: true,
  remainingBudget: house.remainingBudget,
  // ... rest of response
});
```

---

### Step 3: Emit Events from Round Start API

**File:** `src/app/api/rounds/[id]/start/route.ts`

**Location:** After successfully starting round (line 200)

```typescript
import { getSocketInstance } from "@/lib/socket-shared";
import { Teams } from "@/lib/models/teams";

// ... existing code ...

// After line 200: await Rounds.update(...)
await Rounds.update(targetRoundId, {
  status: "active",
  timerEnd,
  scheduledStart: new Date(),
});

// ✅ ADD THIS: Emit socket events
try {
  const io = getSocketInstance();
  const round = await Rounds.getById(targetRoundId);
  const team = round ? await Teams.getById(round.teamId.toString()) : null;
  
  // Emit round-started event
  io.emit("round-started", {
    roundId: targetRoundId,
    teamId: round?.teamId.toString(),
    team: team ? {
      teamId: team._id?.toString(),
      rank: team.rank,
      batch: team.batch,
      memberCount: 0, // Calculate if needed
    } : null,
    timerEnd: timerEnd.toISOString(),
    timestamp: new Date().toISOString(),
  });
  
  // Emit state-update for projector
  io.emit("state-update", {
    screen: "bidding",
    roundId: targetRoundId,
    teamId: round?.teamId.toString(),
    timeLeft: timerEnd.getTime() - Date.now(),
  });
  
  console.log(`[Socket] Emitted round-started for round ${targetRoundId}`);
} catch (err) {
  console.warn("[Socket] Failed to emit round-started:", err);
}

return NextResponse.json({
  success: true,
  roundId: targetRoundId,
  timerEnd: timerEnd.toISOString(),
  message: "Round started successfully",
});
```

---

### Step 4: Emit Events from Round End API

**File:** `src/app/api/rounds/[id]/end/route.ts`

**Location:** After successfully ending round (line 165, after transaction)

```typescript
import { getSocketInstance } from "@/lib/socket-shared";

// ... existing code ...

// After line 165: await session.endSession()
await session.endSession();

// ✅ ADD THIS: Emit socket events
try {
  const io = getSocketInstance();
  
  // Emit round-ended event
  io.emit("round-ended", {
    roundId: id,
    winner: winningBid
      ? {
          houseId: winningBid.houseId.toString(),
          houseName: winningHouse?.name,
          amount: winningBid.amount,
          timestamp: winningBid.timestamp.toISOString(),
        }
      : null,
    allBids: bids.map((bid) => ({
      houseId: bid.houseId.toString(),
      amount: bid.amount,
      timestamp: bid.timestamp.toISOString(),
    })),
    timestamp: new Date().toISOString(),
  });
  
  // Emit state-update for projector
  io.emit("state-update", {
    screen: "results",
    roundId: id,
    winner: winningBid
      ? {
          houseId: winningBid.houseId.toString(),
          houseName: winningHouse?.name,
          amount: winningBid.amount,
        }
      : null,
    losers: bids
      .filter((bid) => bid.houseId.toString() !== winningBid?.houseId.toString())
      .map((bid) => ({
        houseId: bid.houseId.toString(),
        amount: bid.amount,
      })),
  });
  
  console.log(`[Socket] Emitted round-ended for round ${id}`);
} catch (err) {
  console.warn("[Socket] Failed to emit round-ended:", err);
}

return NextResponse.json({
  success: true,
  // ... rest of response
});
```

---

### Step 5: Emit Events from Auto-End (Status API)

**File:** `src/app/api/status/route.ts`

**Location:** After auto-ending round (line 243, after transaction)

```typescript
import { getSocketInstance } from "@/lib/socket-shared";

// ... existing code in auto-end section ...

// After line 243: await session.endSession()
await session.endSession();

// ✅ ADD THIS: Emit socket events (same as manual end)
try {
  const io = getSocketInstance();
  
  io.emit("round-ended", {
    roundId: activeRound._id!.toString(),
    winner: winningHouse
      ? {
          houseId: winningBid!.houseId.toString(),
          houseName: winningHouse.name,
          amount: winningBid!.amount,
          timestamp: winningBid!.timestamp.toISOString(),
        }
      : null,
    allBids: bids.map((bid) => ({
      houseId: bid.houseId.toString(),
      amount: bid.amount,
      timestamp: bid.timestamp.toISOString(),
    })),
    timestamp: new Date().toISOString(),
  });
  
  io.emit("state-update", {
    screen: "results",
    roundId: activeRound._id!.toString(),
    winner: winningHouse
      ? {
          houseId: winningBid!.houseId.toString(),
          houseName: winningHouse.name,
          amount: winningBid!.amount,
        }
      : null,
    losers: bids
      .filter((bid) => bid.houseId.toString() !== winningBid!.houseId.toString())
      .map((bid) => ({
        houseId: bid.houseId.toString(),
        amount: bid.amount,
      })),
  });
  
  console.log(`[Socket] Emitted round-ended (auto) for round ${activeRound._id}`);
} catch (err) {
  console.warn("[Socket] Failed to emit round-ended (auto):", err);
}

// Continue with return statement...
```

---

### Step 6: Update Projector to Listen for Socket Events

**File:** `src/app/projector/page.tsx`

**Changes:**
1. Import and use `useSocket` hook
2. Listen for socket events
3. Reduce polling frequency

```typescript
import { useSocket } from "@/hooks/useSocket";

export default function ProjectorDisplay() {
  // ... existing state ...
  
  const { on, isConnected } = useSocket();
  
  // ✅ ADD THIS: Listen for bid notifications
  useEffect(() => {
    if (!on) return;
    
    const unsubscribe = on("bid-notification", (data: {
      houseId: string;
      houseName: string;
      roundId: string;
    }) => {
      console.log("🎯 [Socket] Bid notification received:", data);
      
      // Update bid state immediately
      setHouseBidStates((prev) => {
        const houseId = data.houseId;
        const prevState = prev[houseId];
        
        if (!prevState || prevState.status === "no-bid") {
          // First bid from this house
          return {
            ...prev,
            [houseId]: {
              status: "bid-placed",
              showFlash: true,
            },
          };
        } else {
          // Bid updated
          return {
            ...prev,
            [houseId]: {
              ...prevState,
              status: "bid-updated",
              showFlash: true,
            },
          };
        }
      });
      
      // Play bid sound
      if (bidSoundRef.current) {
        try {
          bidSoundRef.current.currentTime = 0;
          void bidSoundRef.current.play();
        } catch (e) {
          console.warn("Bid sound play failed", e);
        }
      }
      
      // Auto-hide flash after 2s
      setTimeout(() => {
        setHouseBidStates((prev) => ({
          ...prev,
          [data.houseId]: {
            ...prev[data.houseId],
            showFlash: false,
          },
        }));
      }, 2000);
    });
    
    return unsubscribe;
  }, [on]);
  
  // ✅ ADD THIS: Listen for round started
  useEffect(() => {
    if (!on) return;
    
    const unsubscribe = on("round-started", (data: {
      roundId: string;
      teamId: string;
      timerEnd: string;
    }) => {
      console.log("🚀 [Socket] Round started:", data);
      // Trigger a fetch to get full round data
      fetchData();
    });
    
    return unsubscribe;
  }, [on]);
  
  // ✅ ADD THIS: Listen for round ended
  useEffect(() => {
    if (!on) return;
    
    const unsubscribe = on("round-ended", (data: {
      roundId: string;
      winner: { houseName: string; amount: number } | null;
      allBids: Array<{ houseId: string; amount: number }>;
    }) => {
      console.log("🏆 [Socket] Round ended:", data);
      // Trigger fetch to get full winner data
      fetchData();
    });
    
    return unsubscribe;
  }, [on]);
  
  // ✅ MODIFY THIS: Reduce polling frequency (keep as backup)
  useEffect(() => {
    fetchData();
    // Increase from 4s to 15s since sockets handle real-time
    const pollInterval = setInterval(() => {
      fetchData();
    }, 15000); // 15 seconds as backup
    return () => clearInterval(pollInterval);
  }, []);
  
  // ... rest of component ...
}
```

---

### Step 7: Update House Dashboard to Listen for Socket Events

**File:** `src/app/house/[houseId]/page.tsx`

**Changes:**
1. Import and use `useSocket` hook
2. Listen for round start/end events
3. Reduce polling frequency

```typescript
import { useSocket } from "@/hooks/useSocket";

export default function HouseDashboard() {
  // ... existing state ...
  
  const { on, isConnected } = useSocket();
  
  // ✅ ADD THIS: Listen for round started
  useEffect(() => {
    if (!on) return;
    
    const unsubscribe = on("round-started", (data: {
      roundId: string;
      teamId: string;
      timerEnd: string;
    }) => {
      console.log("🚀 [Socket] Round started, refreshing data");
      // Refresh data immediately
      fetchData(true);
    });
    
    return unsubscribe;
  }, [on, houseId]);
  
  // ✅ ADD THIS: Listen for round ended
  useEffect(() => {
    if (!on) return;
    
    const unsubscribe = on("round-ended", (data: {
      roundId: string;
      winner: { houseName: string; amount: number } | null;
    }) => {
      console.log("🏆 [Socket] Round ended, refreshing data");
      // Refresh data immediately
      fetchData(true);
    });
    
    return unsubscribe;
  }, [on, houseId]);
  
  // ✅ MODIFY THIS: Reduce polling frequency
  useEffect(() => {
    fetchData(true);
    // Increase from 5s to 10s since sockets handle real-time
    const pollInterval = setInterval(() => {
      fetchData(false);
    }, 10000); // 10 seconds as backup
    return () => clearInterval(pollInterval);
  }, [houseId]);
  
  // ... rest of component ...
}
```

---

### Step 8: Update Admin Pages (Optional)

**File:** `src/app/admin/rounds/page.tsx`

**Changes:** Listen for round events to update UI

```typescript
import { useSocket } from "@/hooks/useSocket";

export default function RoundsPage() {
  // ... existing state ...
  
  const { on } = useSocket();
  
  // ✅ ADD THIS: Listen for round events
  useEffect(() => {
    if (!on) return;
    
    const unsubscribeRoundStarted = on("round-started", () => {
      console.log("🚀 [Socket] Round started, refreshing rounds");
      fetchRounds();
    });
    
    const unsubscribeRoundEnded = on("round-ended", () => {
      console.log("🏆 [Socket] Round ended, refreshing rounds");
      fetchRounds();
    });
    
    return () => {
      unsubscribeRoundStarted();
      unsubscribeRoundEnded();
    };
  }, [on]);
  
  // ... rest of component ...
}
```

---

### Step 9: Clean Up server.js

**File:** `server.js`

**Changes:** Remove duplicate socket handlers (they're now in API routes)

```javascript
// ❌ REMOVE: These handlers are now in API routes
// socket.on("admin:start-round", ...)
// socket.on("admin:end-round", ...)
// socket.on("bid-placed", ...)

// ✅ KEEP: Basic connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  
  // Send current state to newly connected client
  // (You might want to fetch from DB here)
  socket.emit("state-update", {
    screen: "waiting",
    message: "Waiting for admin to start...",
  });
  
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});
```

---

### Step 10: Delete Dead Code

**Files to Delete:**
- `src/lib/socket-server.ts` (entire file - never used)

**Why:** This file was never called. All socket logic is now in `server.js` and API routes.

---

## 🧪 Testing Checklist

### Backend Testing

- [ ] **Socket server starts correctly**
  - Check logs: "Socket.IO server running"
  - Verify no errors on startup

- [ ] **Bid API emits events**
  - Place a bid via API
  - Check server logs: "Emitted bid-notification"
  - Verify event is broadcast

- [ ] **Round start API emits events**
  - Start a round via API
  - Check server logs: "Emitted round-started"
  - Verify event is broadcast

- [ ] **Round end API emits events**
  - End a round via API
  - Check server logs: "Emitted round-ended"
  - Verify event is broadcast

- [ ] **Auto-end emits events**
  - Let a round expire
  - Check server logs: "Emitted round-ended (auto)"
  - Verify event is broadcast

### Frontend Testing

- [ ] **Projector connects to socket**
  - Open projector page
  - Check browser console: "Socket connected"
  - Verify `isConnected` is true

- [ ] **Bid notifications appear instantly**
  - Place bid from house dashboard
  - Projector should update within 100ms
  - Sound should play
  - Flash animation should show

- [ ] **Round start updates instantly**
  - Admin starts round
  - Projector should show new round immediately
  - House dashboards should update immediately

- [ ] **Round end updates instantly**
  - Admin ends round or timer expires
  - Projector should show winner immediately
  - House dashboards should update immediately

- [ ] **Polling still works as backup**
  - Disconnect socket (close browser tab, reopen)
  - Verify polling still updates UI
  - Reconnect should work automatically

- [ ] **Multiple clients receive events**
  - Open projector + 2 house dashboards
  - Place bid from one house
  - All 3 should update simultaneously

### Edge Cases

- [ ] **Socket disconnection handling**
  - Disconnect network temporarily
  - Verify reconnection works
  - Verify polling takes over during disconnect

- [ ] **API route fails but socket succeeds**
  - Simulate API error
  - Verify socket event still emits (if possible)
  - Verify error handling doesn't break socket

- [ ] **Socket fails but API succeeds**
  - Simulate socket error
  - Verify API still returns success
  - Verify polling updates UI

---

## 🔄 Rollback Plan

If something breaks, here's how to rollback:

### Quick Rollback (5 minutes)

1. **Revert polling intervals:**
   ```typescript
   // projector/page.tsx
   setInterval(fetchData, 4000); // Back to 4s
   
   // house/[houseId]/page.tsx
   setInterval(fetchData, 5000); // Back to 5s
   ```

2. **Remove socket listeners:**
   - Comment out all `useEffect` hooks that use `on()`
   - Comment out `useSocket()` hook usage

3. **Keep socket emits in API routes:**
   - They won't hurt anything if no one is listening
   - Or wrap in try-catch to silence errors

### Full Rollback (15 minutes)

1. **Git revert:**
   ```bash
   git log --oneline  # Find commit before socket changes
   git revert <commit-hash>
   ```

2. **Or manually revert:**
   - Delete `src/lib/socket-shared.ts`
   - Remove socket emit code from API routes
   - Remove socket listeners from components
   - Restore original polling intervals

---

## ⏰ Timeline Options

### Option A: Implement Before Event (2-3 hours)

**Pros:**
- ✅ Better user experience during event
- ✅ Less server load
- ✅ More impressive demo

**Cons:**
- ❌ Risk of breaking things
- ❌ Less time to test
- ❌ Stress before event

**Recommendation:** Only if you have 3+ hours and can test thoroughly

### Option B: Implement After Event (Recommended)

**Pros:**
- ✅ No risk to event
- ✅ Time to test properly
- ✅ Can iterate and improve

**Cons:**
- ❌ Event still uses polling (which works fine)

**Recommendation:** Do this. Your polling works, no need to rush.

### Option C: Hybrid Approach (1 hour)

**Minimal implementation:**
1. Only emit `bid-notification` events (most visible impact)
2. Keep everything else as-is
3. Add socket listeners only to projector

**Pros:**
- ✅ Quick to implement
- ✅ Low risk
- ✅ Immediate visual impact (bids appear instantly)

**Cons:**
- ❌ Incomplete implementation
- ❌ Still need to do full implementation later

**Recommendation:** Good middle ground if you want some improvement before event

---

## 📊 Expected Improvements

### Performance Metrics

**Before (Polling Only):**
- API requests: ~65/minute
- Update latency: 0-5 seconds
- Server load: Medium

**After (Sockets + Polling Backup):**
- API requests: ~10-15/minute (75% reduction!)
- Update latency: < 100ms (real-time)
- Server load: Low
- Socket connections: ~6-10 (one per client)

### User Experience

**Before:**
- Bid appears 0-5 seconds after placement
- Round updates 0-5 seconds after start/end
- Noticeable delay during fast bidding

**After:**
- Bid appears instantly (< 100ms)
- Round updates instantly
- Smooth, real-time experience
- Polling as backup if socket fails

---

## 🎯 Success Criteria

Implementation is successful if:

1. ✅ All socket events are emitted from API routes
2. ✅ Frontend components listen and update instantly
3. ✅ Polling still works as backup
4. ✅ No increase in errors or bugs
5. ✅ 75%+ reduction in API requests
6. ✅ Sub-100ms update latency
7. ✅ Graceful handling of socket disconnections

---

## 📚 Additional Resources

### Socket.IO Documentation
- https://socket.io/docs/v4/
- https://socket.io/docs/v4/client-api/

### Best Practices
- Always wrap socket emits in try-catch
- Never fail API requests if socket fails
- Use polling as backup
- Handle reconnection gracefully
- Log socket events for debugging

---

## 🚀 Next Steps

1. **Review this plan** - Make sure you understand all changes
2. **Choose timeline** - Before event, after event, or hybrid
3. **Create feature branch** - `git checkout -b feature/socket-implementation`
4. **Follow steps 1-10** - Implement in order
5. **Test thoroughly** - Use testing checklist
6. **Deploy to staging** - Test on Render staging environment
7. **Monitor and iterate** - Fix any issues
8. **Merge to main** - When ready

---

**Good luck! This will make your system much more responsive and reduce server load significantly! 🎉**

