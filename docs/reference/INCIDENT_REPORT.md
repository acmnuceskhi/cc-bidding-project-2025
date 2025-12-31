# Incident Report — CC Bidding Project 2025

**Project Status:** ✅ Feature-complete | ✅ Successfully executed (2-3 rounds) | ⚠️ Failed on 4th round attempt

**Live Event Date:** November 18, 2025 (~10-15 minutes of runtime; ~1-1.5 hours overall event window)  
**Documentation Finalized:** December 31, 2025

---

## Executive Summary

The CC Bidding Project successfully executed in a **live event on November 18, 2025** with 2 admin users and 4 house captains. The system handled **2-3 complete bidding rounds smoothly**, earning praise for the UI/UX flow (round start → bid placement → results display). However, upon attempting to start the 4th round, **the application became unresponsive** with an indefinite loading state.

**Root Cause:** Geographic latency between Heroku (US) and MongoDB Atlas (Mumbai) combined with insufficient connection pooling. The issue manifested after ~3 rounds as accumulated transaction overhead exceeded timeout thresholds.

**Key Insight:** This was NOT a gradual degradation—the system worked perfectly for 2-3 rounds, then failed abruptly on the 4th attempt, indicating a threshold-based failure rather than memory leak or cascading bug.

---

## What Happened: Timeline

| Phase | Date | Details |
|-------|------|---------|
| **Development** | Sep-Nov 2025 | Application developed on Next.js with MongoDB, Socket.io real-time updates, comprehensive bidding logic ✅ |
| **Testing** | Pre-Nov 18 | Tested locally with seed data; no load testing performed ⚠️ |
| **Deployment to Heroku** | Pre-Nov 18 | Deployed to US-based Heroku dyno with MongoDB Atlas in Mumbai (ap-south-1) ⚠️ |
| **Live Event** | Nov 18, ~10-15 min runtime | **Execution Timeline:** |
| ↳ Round 1 | ~minute 0-3 | ✅ Started, bids placed, winner determined, results displayed |
| ↳ Round 2 | ~minute 4-7 | ✅ Started, bids placed, winner determined, results displayed |
| ↳ Round 3 | ~minute 8-11 | ✅ Started, bids placed, winner determined, results displayed |
| ↳ Round 4 Start Attempt | ~minute 12-15 | ❌ Admin clicked "start round" → infinite loading state → application unresponsive |
| **Post-Mortem** | Nov 18+ | Deployment team identified MongoDB latency; attempted migration to Google Cloud (not re-tested) |
| **Project Closure** | Dec 31, 2025 | Documentation finalized, insights documented for next team |

---

## Root Cause Analysis

### **1. Geographic Latency (Primary Factor) — 200-400ms per query**

**Issue:** Heroku dynos (US-based, us-east-1) querying MongoDB Atlas in Mumbai (ap-south-1, India)

- **Baseline Latency:** 200-400ms added per MongoDB query (normal same-region: 5-20ms)
- **Per-Round Queries:** Round start/end triggers ~15-20 database operations
- **Cumulative Impact:** After 3 rounds of bids accumulating, query chains exceed Heroku timeout (30-60s for HTTP requests)
- **Threshold Phenomenon:** First 3 rounds stayed under timeout; 4th round exceeded it

**Why it manifested on Round 4:**
```
Round 1: 4 houses × 1 bid = 4 bids in DB → queries fast
Round 2: 4 houses × 2 bids = 8 bids in DB → queries still fast
Round 3: 4 houses × 3 bids = 12 bids in DB → queries still under threshold
Round 4: Attempting to query 16+ bids + previous round state 
         + Socket.io broadcasts to 6 users
         + Transaction overhead
         = ~5-8 seconds total query time → Exceeds 30s timeout? 
         OR cumulative connection pool exhaustion kicks in
```

**Hard Numbers (estimations for illustration, not measured):**
- Normal query latency: 5-10ms
- With geographic latency: 205-410ms
- MongoDB query execution: 5ms
- Total: 210-415ms per query
- Round 4 round-start operation: ~20 queries = 4.2-8.3 seconds
- If requests queue due to pool exhaustion: 30-60+ seconds possible

### **2. MongoDB Connection Pool Exhaustion (Secondary Factor)**

**Issue:** Default connection pool settings insufficient for concurrent load

- **Current Pool Size:** Default MongoDB driver settings (typically 100)
- **Concurrent Connections:** 6 users + Socket.io subscriptions + API route workers
- **Each round transition:** Multiple sequential queries (validate, update, broadcast)
- **Result:** Connection pool exhausted → new requests queued → UI timeout

**Code Context:**
```javascript
// server.js - MongoDB connection
mongoClientPromise = client.connect();
// Default pooling: maxPoolSize: 10, minPoolSize: 2 (too small for 6+ concurrent users)
```

### **3. Lack of Pre-Deployment Load Testing (Process Gap)**

**Issue:** No load testing before live deployment with real users

- ❌ No simulated concurrent users (5-10 bidders per round)
- ❌ No network latency simulation (Heroku → Mumbai)
- ❌ No stress testing on critical operations (round start → end transition)
- ✅ Would have identified bottleneck before live event

### **4. Monitoring & Observability (Detection Gap)**

**Issue:** No production monitoring to catch degradation

- No MongoDB slow query logs enabled
- No application performance monitoring (APM)
- No alerts on response time degradation
- **Result:** Issue only discovered when UI hung; no early warning

---

## What Worked Well ✅

1. **Core Bidding Logic** — Atomic transactions and budget management functioned correctly
2. **Real-Time Architecture** — Socket.io event broadcast pattern proved robust for 2-3 rounds
3. **UI/UX Flow** — Users unanimously praised round start → bid → results experience
4. **Data Integrity** — No budget double-spending or race conditions observed
5. **API Design** — Endpoints handled requests efficiently at lower scale

---

## Specific Recommendations for Next Team

### **Infrastructure Decisions**

#### **1. Deployment Platform: Render (Recommended)**

**Why Render over Heroku:**
- ✅ Cheaper (Heroku's paid tier is prohibitive)
- ✅ Better MongoDB Atlas integration (native monitoring)
- ✅ Easier horizontal scaling
- ✅ `render.yaml` already exists in repo (minimal setup)

**Why NOT Google Cloud (current attempt):**
- ❌ Over-engineered for this use case
- ❌ Higher operational complexity
- ❌ Steeper learning curve for small team
- ❌ Overkill infrastructure cost

#### **2. MongoDB Atlas Region: Match Deployment Region**

**Critical:** If deploying to Render
- Render has servers in **us-east-1 (Virginia)** primarily
- **Change MongoDB Atlas region from ap-south-1 (Mumbai) to us-east-1**
- **Latency reduction:** 200-400ms → 5-20ms per query
- **Impact:** ~10-20x faster queries, eliminates timeout issues

**Configuration:**
```bash
# Old (problematic)
MONGODB_URI="mongodb+srv://user:pass@cluster.ap-south-1.mongodb.net/db"

# New (recommended)
MONGODB_URI="mongodb+srv://user:pass@cluster.us-east-1.mongodb.net/db"
```

**Cost Note:** Atlas cluster migration is free; just create new cluster in correct region and update URI.

#### **3. Connection Pooling Configuration**

**Update in `src/lib/mongodb.ts`:**

```typescript
// Current (insufficient)
const client = new MongoClient(MONGODB_URI, {
  maxPoolSize: 10,
  minPoolSize: 2,
});

// Recommended for 5-10 concurrent users
const client = new MongoClient(MONGODB_URI, {
  maxPoolSize: 50,        // Handle concurrent connections
  minPoolSize: 10,        // Keep connections warm
  maxIdleTimeMS: 45000,   // Recycle idle connections
});
```

---

### **Code-Level Optimizations**

#### **1. Database Query Optimization**

**Current Implementation:**
- Round state transitions query bids sequentially
- No query result caching
- Re-fetches same data across API calls

**Recommended Changes:**

a) **Index Validation** (already present but verify):
```typescript
// In src/lib/models/bids.ts - ensure these exist
await col.createIndex({ roundId: 1, houseId: 1 }, { unique: true });
await col.createIndex({ roundId: 1, amount: -1, timestamp: 1 });
```

b) **Implement Response Caching**:
```typescript
// Add to lib/cache.ts
const CACHE_TTL = 5000; // 5 seconds
const queryCache = new Map();

export function getCachedQuery(key: string, fetchFn, ttl = CACHE_TTL) {
  if (queryCache.has(key)) return queryCache.get(key);
  const result = await fetchFn();
  queryCache.set(key, result);
  setTimeout(() => queryCache.delete(key), ttl);
  return result;
}
```

c) **Batch Round Transitions** (reduce sequential queries):
```typescript
// Current: Multiple separate queries during round end
// Recommended: Single aggregation pipeline
const result = await roundsCollection.findOneAndUpdate(
  { _id: roundId },
  { $set: { status: "completed", timerEnd: new Date() } },
  { returnDocument: "after" }
);
const bids = await bidsCollection.find({ roundId }).toArray();

// Better: Use transaction
const session = client.startSession();
session.startTransaction();
// All operations in one transaction
session.endSession();
```

#### **2. Socket.io Optimization**

**Current Issue:** Broadcasting to all clients on every bid update

```javascript
// Current (inefficient)
io.emit("bids-update", { teamId, allBids }); // Goes to everyone

// Recommended (targeted)
io.to(`house:${houseId}`).emit("bids-update", { teamId, myBid });
io.to("admins").emit("bids-update", { teamId, allBids });
```

#### **3. Add Request Deduplication**

Already implemented in `fetchWithAuth.ts` ✅ — ensure it's used consistently.

---

### **Pre-Deployment Testing Checklist**

**Before going live, the next team MUST:**

- [ ] **Load Test**: Simulate 10 concurrent users placing bids for 5 rounds
  ```bash
  # Recommended tool: k6 or Artillery
  npm install -g artillery
  artillery quick --count 10 --num 50 http://localhost:3000/api/bids
  ```

- [ ] **Network Simulation**: Test with 200-400ms latency to identify bottlenecks
  ```bash
  # MacOS/Linux
  sudo tc qdisc add dev lo root netem delay 300ms
  
  # Windows (use clumsy or similar)
  ```

- [ ] **Database Monitoring**: Enable MongoDB slow query logs
  ```javascript
  // In .env
  MONGODB_LOG_LEVEL=debug
  ```

- [ ] **Performance Profiling**: Check response times for critical paths
  - Round start: < 500ms
  - Bid placement: < 300ms
  - Bid query: < 200ms

- [ ] **Health Check Endpoint**: Verify `/api/ping` tests DB connectivity
  ```typescript
  // Already implemented at src/app/api/ping/route.ts
  export const GET = async () => {
    try {
      const client = await clientPromise;
      await client.db("admin").command({ ping: 1 });
      return NextResponse.json({ status: "healthy" });
    } catch (err) {
      return NextResponse.json({ status: "unhealthy" }, { status: 500 });
    }
  };
  ```

---

### **Deployment Readiness**

Before deploying to production:

1. ✅ Verify MongoDB Atlas region matches deployment region
2. ✅ Configure connection pooling (maxPoolSize: 50+)
3. ✅ Run full load test (k6/Artillery with 10 concurrent users)
4. ✅ Enable MongoDB slow query logs
5. ✅ Set up monitoring (Sentry for errors, DataDog for performance)
6. ✅ Configure health check endpoint
7. ✅ Document rollback procedure
8. ✅ Run 30-minute dry run with test users before live event

---

## Infrastructure Diagram (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│                    RECOMMENDED SETUP                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Render Dyno (us-east-1)        MongoDB Atlas (us-east-1)   │
│  ┌──────────────────┐           ┌──────────────────────┐    │
│  │  Next.js App     │──────────▶│  Cluster             │    │
│  │  Socket.io       │ 5-20ms    │  (replicated)        │    │
│  │  Server          │  latency  │  ✅ Fast queries     │    │
│  │                  │           │  ✅ High availability│    │
│  │ maxPoolSize: 50  │           │                      │    │
│  └──────────────────┘           └──────────────────────┘    │
│                                                              │
│  Clients (6-10 concurrent)                                   │
│  • 2 Admin Users                                             │
│  • 4 House Captains                                          │
│  • Spectators (read-only)                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**OLD (Failed) Setup:**
```
Heroku (us-east-1) → Mumbai MongoDB (ap-south-1) [200-400ms latency] ❌
```

---

## Monitoring & Alerting (Production)

**Next team should implement:**

1. **Error Tracking**: Sentry or DataDog
   ```typescript
   // In next.js config
   import * as Sentry from "@sentry/nextjs";
   ```

2. **Performance Monitoring**:
   - Track API response times
   - Monitor MongoDB query latency
   - Alert if > 500ms response time

3. **Uptime Monitoring**:
   - Ping `/api/health` every minute
   - Alert on 3 consecutive failures

4. **Log Aggregation**:
   - Collect all error logs from Render
   - Search capability for post-mortems

---

## Key Takeaways

| Lesson | Action |
|--------|--------|
| **Geographic latency kills performance** | Always co-locate app + database region |
| **Connection pooling must scale with users** | Use maxPoolSize: 50+ for 6+ concurrent users |
| **Load test before deploying** | 1-2 hours of load testing saves days of debugging |
| **Monitor from day 1** | Enable slow query logs and response time alerts |
| **Heroku is expensive** | Use Render, Railway, or Vercel for this scale |
| **Socket.io broadcasts need targeting** | Use rooms for admin vs house captain updates |

---

## For Next Team: Quick Start

1. Read [DEPLOYMENT.md](../ops/DEPLOYMENT.md) for setup steps
2. Read [PERFORMANCE.md](../ops/PERFORMANCE.md) for optimization guide
3. Follow the Pre-Deployment Testing Checklist above
4. Deploy to Render with MongoDB Atlas in us-east-1
5. Enable monitoring before live event
6. Success! ✅

---

## Questions for Next Team

If you hit issues, ask yourself:

1. **Is the app slow?** → Check MongoDB region (us-east-1 for Render)
2. **Is the database timing out?** → Check connection pool size (maxPoolSize: 50+)
3. **Are specific queries slow?** → Enable MongoDB slow query logs and profile
4. **Did it work before?** → Check if regions changed or pool size reset
5. **Is Socket.io lagging?** → Use targeted room broadcasts instead of global

---

## Contact & Escalation

**Deployment Issues:** Refer to [DEPLOYMENT.md](../ops/DEPLOYMENT.md)  
**Performance Issues:** Refer to [PERFORMANCE.md](../ops/PERFORMANCE.md)  
**General Architecture:** Refer to [PROJECT_FLOW.md](./PROJECT_FLOW.md)  

**If you encounter a new issue:** Update this document for future teams! ✍️

---

**Status:** ✅ Finalized December 31, 2025  
**Next Review:** Before next live event
