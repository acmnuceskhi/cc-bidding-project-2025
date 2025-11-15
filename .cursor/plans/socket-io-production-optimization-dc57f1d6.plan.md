<!-- dc57f1d6-fb3a-49dc-92d2-076cab3c828f 9ed078ac-2520-4784-ad02-3d42ae16f459 -->
# Socket.IO Production Optimization & Performance Plan

## 🎯 Overview

Prepare the auction system for production deployment on Render free tier with optimized Socket.IO, reduced database queries, and production-ready configurations. Target: ~10-20 concurrent users, continuous event tomorrow.

---

## 🔴 Critical Fixes (High Impact - Must Do)

### 1. Make Socket.IO Stateless & Production-Ready

**Issue:** [`server.js`](server.js) maintains `currentState` in memory which is lost on server restart/redeploy. Uses default Socket.IO configs not optimized for production.

**Fix:**

- Remove in-memory `currentState` variable
- On client connection, fetch current state from database (active round, bids, etc.)
- Add production Socket.IO options:
  ```javascript
  {
    pingTimeout: 60000,      // 60s before considering dead
    pingInterval: 25000,     // Ping every 25s
    connectTimeout: 45000,   // 45s to establish connection
    transports: ["websocket", "polling"], // Fallback to long-polling
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? ["https://your-render-url.onrender.com"] 
        : "*"
    }
  }
  ```

- Ensure graceful reconnection handling

**Files:** [`server.js`](server.js)

### 2. Optimize Polling Intervals

**Issue:** House pages poll every 3s, projector every 2s = ~25 requests/second to database during active rounds.

**Fix:**

- Reduce house polling to 10 seconds (Socket.IO will handle real-time updates)
- Reduce projector polling to 10 seconds
- Only poll when round is active (pause when idle)
- Add exponential backoff on errors

**Files:**

- [`src/app/house/[houseId]/page.tsx`](src/app/house/[houseId]/page.tsx) (line 184-188)
- [`src/app/projector/page.tsx`](src/app/projector/page.tsx) (line 448-453)

### 3. Optimize /api/status Endpoint

**Issue:** [`src/app/api/status/route.ts`](src/app/api/status/route.ts) runs complex auto-end logic with DB transactions on EVERY request. Called 10+ times/second during bidding.

**Fix:**

- Move auto-end logic to a server-side check (Socket.IO server or separate background check)
- Simplify status endpoint to just fetch and return data (no mutations)
- Add simple in-memory cache (30-second TTL) for phase counts and unsold teams
- Return cached data for most requests, only recalculate on round state changes

**Files:** [`src/app/api/status/route.ts`](src/app/api/status/route.ts)

### 4. Remove Duplicate/Dead Socket Code

**Issue:** [`src/lib/socket-server.ts`](src/lib/socket-server.ts) exists but is NEVER used. Creates confusion about architecture.

**Fix:**

- Delete [`src/lib/socket-server.ts`](src/lib/socket-server.ts) entirely
- Consolidate all Socket.IO logic in [`server.js`](server.js)
- Update any imports/references (appears there are none)

**Files:** [`src/lib/socket-server.ts`](src/lib/socket-server.ts)

---

## 🟡 Important Improvements (Medium Impact)

### 5. Add Production Environment Variables

**Issue:** No environment-based configuration for URLs, polling rates, or Socket.IO settings.

**Fix:**

- Create `.env.example` with required variables
- Add `NEXT_PUBLIC_SOCKET_URL` for production Socket.IO connection
- Add `NEXT_PUBLIC_POLLING_INTERVAL` for configurable polling
- Update [`render.yaml`](render.yaml) with environment variable references

**Files:** `.env.example` (create), [`render.yaml`](render.yaml)

### 6. Optimize Socket.IO Client Reconnection

**Issue:** [`src/hooks/useSocket.ts`](src/hooks/useSocket.ts) uses default reconnection settings and doesn't refetch state after reconnecting.

**Fix:**

- Add reconnection config:
  ```javascript
  {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  }
  ```

- On reconnect, fetch fresh state from `/api/status`
- Show connection status indicator (connected/reconnecting)

**Files:** [`src/hooks/useSocket.ts`](src/hooks/useSocket.ts)

### 7. Add Simple Request Deduplication

**Issue:** Multiple components might trigger polling simultaneously, causing duplicate API calls.

**Fix:**

- Add request deduplication using in-flight promise tracking
- If request is already in progress, return existing promise
- Prevents duplicate DB queries for identical requests within 100ms window

**Files:** [`src/lib/fetchWithAuth.ts`](src/lib/fetchWithAuth.ts), [`src/lib/fetchPublic.ts`](src/lib/fetchPublic.ts)

---

## 🟢 Nice-to-Have Optimizations (Low Impact)

### 8. Add Production Logging

**Issue:** Heavy use of `console.log` in production code. No structured logging.

**Fix:**

- Wrap console.logs in environment check: `process.env.NODE_ENV === 'development'`
- Keep critical error logs for debugging
- Remove verbose debug logs from hot paths

**Files:** [`server.js`](server.js), [`src/app/api/status/route.ts`](src/app/api/status/route.ts), [`src/app/projector/page.tsx`](src/app/projector/page.tsx)

### 9. Add MongoDB Connection Pooling Config

**Issue:** Default MongoDB connection settings may not be optimal for free tier.

**Fix:**

- Add explicit connection pool settings in [`src/lib/mongodb.ts`](src/lib/mongodb.ts):
  ```javascript
  {
    maxPoolSize: 10,      // Limit for free tier
    minPoolSize: 2,       // Keep some connections warm
    maxIdleTimeMS: 30000  // Close idle after 30s
  }
  ```


**Files:** [`src/lib/mongodb.ts`](src/lib/mongodb.ts)

---

## 📊 Expected Impact

### Before:

- **Database Queries:** ~25/second during active rounds
- **API Response Time:** 200-500ms (due to auto-end logic)
- **Socket.IO:** Loses state on reconnect
- **Render Limits:** Risk of hitting free tier quotas

### After:

- **Database Queries:** ~2-3/second (80% reduction)
- **API Response Time:** 50-100ms (cached data)
- **Socket.IO:** Stateless, production-optimized, handles reconnects
- **Render Limits:** Well within free tier (750 hours compute, 100GB bandwidth)

---

## ✅ Checklist for Tomorrow's Event

- [ ] All Socket.IO connections tested with reconnection scenarios
- [ ] Projector displays correctly with 10s polling
- [ ] House captain pages show real-time bid updates via Socket.IO
- [ ] Auto-end works correctly when timer expires
- [ ] Manual end round works from admin panel
- [ ] No memory leaks after 2+ hours of operation
- [ ] Render deployment tested in production mode

---

## 🚫 What We're NOT Doing

- ❌ Redis caching (overkill for 10-20 users)
- ❌ Horizontal scaling (single instance sufficient)
- ❌ WebSocket-only mode (need HTTP polling fallback)
- ❌ Complex monitoring/alerting (no time, use Render dashboard)
- ❌ Database indexes (MongoDB free tier handles this load fine)
- ❌ Frontend bundle optimization (not the bottleneck)
- ❌ Super complex architectural changes

---

## 🎯 Implementation Order

1. **Critical Fixes** (1-3): Core functionality, must complete
2. **Important Improvements** (5-7): Significant impact, high priority
3. **Nice-to-Have** (8-9): Polish, do if time permits

Each fix is small, targeted, and independently testable. We'll commit after each meaningful change.

### To-dos

- [ ] Make Socket.IO stateless - remove in-memory currentState, fetch from DB on connect, add production configs
- [ ] Reduce polling to 10s intervals in house/projector pages, add idle detection
- [ ] Simplify /api/status endpoint, move auto-end logic, add simple caching
- [ ] Delete unused socket-server.ts file
- [ ] Add production environment variables and update render.yaml
- [ ] Improve Socket.IO client reconnection with config and state refetch
- [ ] Add simple request deduplication to prevent duplicate API calls
- [ ] Clean up console.logs and add environment-based logging
- [ ] Add explicit MongoDB connection pooling configuration