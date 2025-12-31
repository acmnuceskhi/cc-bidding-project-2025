# Performance Optimization Guide — CC Bidding Project 2025

**Purpose:** Provide concrete, code-level optimizations to achieve sub-500ms response times  
**Target Audience:** Backend developers and DevOps engineers  
**Last Updated:** December 31, 2025

---

## Table of Contents

1. [Performance Targets](#performance-targets)
2. [Connection Pooling Optimization](#connection-pooling-optimization)
3. [Database Query Optimization](#database-query-optimization)
4. [Index Verification](#index-verification)
5. [Caching Strategy](#caching-strategy)
6. [Load Testing Guide](#load-testing-guide)
7. [Monitoring & Profiling](#monitoring--profiling)

---

## Performance Targets

### **Critical Paths (Must be < 500ms)**

| Operation | Target | Tolerance | Notes |
|-----------|--------|-----------|-------|
| **Round Start** | < 300ms | < 500ms | High priority; most visible to users |
| **Bid Placement** | < 200ms | < 300ms | Frequent operation during round |
| **Bid Query** | < 150ms | < 200ms | Admin real-time updates |
| **Round End** | < 500ms | < 1s | Determines winner; acceptable slower |
| **Page Load** | < 1s | < 2s | Initial load only |
| **Socket.io Message Delivery** | < 100ms | < 200ms | Real-time; no jitter |

### **Under Load (10 concurrent users)**

| Metric | Target | Notes |
|--------|--------|-------|
| **P99 Latency** | < 1s | 99th percentile response |
| **Error Rate** | < 0.1% | Connection timeouts, DB errors |
| **Connection Pool Usage** | < 80% | Should not exceed max connections |
| **Memory Usage** | < 500MB | Node.js process |

---

## Connection Pooling Optimization

### **Problem: Default Pool Too Small**

**Current State (server.js - UNCHANGED from Nov 18):**
```javascript
// ❌ Current implementation
const client = new MongoClient(MONGODB_URI, {
  maxPoolSize: 10,    // Only 10 concurrent connections
  minPoolSize: 2,     // Only 2 warm connections
  maxIdleTimeMS: 30000,
});
```

**With 6 concurrent users:** Pool fills up → requests queue → timeouts

### **Recommended: Optimize Pool Size (For Next Deployment)**

```javascript
// ✅ Recommended for production (NOT YET IMPLEMENTED)
const client = new MongoClient(MONGODB_URI, {
  maxPoolSize: 50,        // ✅ Handle 6+ concurrent users + overhead
  minPoolSize: 10,        // ✅ Keep 10 connections warm
  maxIdleTimeMS: 45000,   // Recycle connections after 45s inactivity
  maxConnecting: 10,      // Limit simultaneous new connections
  waitQueueTimeoutMS: 5000, // Fail fast if queue > 5s
});
```

### **Rationale**

```
With 6 concurrent users:
  - Each user: ~2-3 connections (API + Socket.io)
  - Admin operations: ~3-5 extra
  - Total needed: 15-20
  - Buffer for safety: 50 (3x expected max)

With 10 min pool size:
  - Connections stay warm
  - No cold-start delay on first query
  - ~50-100 MB memory impact (acceptable)
```

### **Testing Pool Size**

```bash
# Simulate pool exhaustion
ab -n 1000 -c 50 http://localhost:3000/api/rounds

# Monitor in logs for:
# "MongoServerError: connection limit reached"
# If seen, increase maxPoolSize further
```

### **Also Update: `src/lib/mongodb.ts`**

**Current State (UNCHANGED from Nov 18):**
```typescript
// ❌ src/lib/mongodb.ts - current implementation
const options: MongoClientOptions = {
  maxPoolSize: 10,      // Limit for free tier
  minPoolSize: 2,       // Keep some connections warm
  maxIdleTimeMS: 30000, // Close idle after 30s
};

let client: MongoClient;
if (!global._mongoClientPromise) {
  client = new MongoClient(uri, options);
  global._mongoClientPromise = client.connect();
}
```

**Recommended (For Next Deployment):**
```typescript
// ✅ Recommended optimization (NOT YET IMPLEMENTED)
const options: MongoClientOptions = process.env.NODE_ENV === "production"
  ? {
      maxPoolSize: 50,
      minPoolSize: 10,
      maxIdleTimeMS: 45000,
    }
  : {
      maxPoolSize: 10,  // Dev environment
      minPoolSize: 2,
    };
```

---

## Database Query Optimization

### **1. Verify Indexes Are Applied**

**Current Indexes (from `src/lib/models/`):**

✅ **bids.ts:**
```typescript
await col.createIndex({ roundId: 1, houseId: 1 }, { unique: true });
await col.createIndex({ roundId: 1 });
await col.createIndex({ houseId: 1 });
await col.createIndex({ teamId: 1 });
await col.createIndex({ roundId: 1, amount: -1, timestamp: 1 });
```

✅ **rounds.ts:**
```typescript
await collection.createIndex({ teamId: 1 });
await collection.createIndex({ status: 1 });
await collection.createIndex({ status: 1, timerEnd: 1 });
await collection.createIndex({ passPhase: 1 });
await collection.createIndex({ status: 1, passPhase: 1 });
```

✅ **houses.ts:**
```typescript
await collection.createIndex({ name: 1 });
```

✅ **participants.ts:**
```typescript
await collection.createIndex({ rollNumber: 1 }, { unique: true });
await collection.createIndex({ teamId: 1 });
await collection.createIndex({ houseId: 1 }, { sparse: true });
```

### **2. Critical Query Optimization**

**Slow Query: Fetching bids for a round**

```typescript
// ❌ SLOW: Fetch all bids then filter
const bids = await Bids.getByRound(roundId);
const latestBids = bids.map(bid => bid); // Already latest (good)
const winner = latestBids.sort((a, b) => b.amount - a.amount)[0];

// ✅ FAST: Use MongoDB aggregation
const bidsCollection = client.db().collection<Bid>("bids");
const winner = await bidsCollection
  .find({ roundId: new ObjectId(roundId) })
  .sort({ amount: -1, timestamp: 1 })
  .limit(1)
  .toArray();
```

**Slow Query: Round state transitions**

```typescript
// ❌ SLOW: Multiple separate queries
async function endRound(roundId: string) {
  const round = await Rounds.getById(roundId);
  const bids = await Bids.getByRound(roundId);
  const winner = await Bids.findWinner(roundId);
  await Rounds.update(roundId, { status: "completed" });
  // Total: 4 queries = 4 × 100ms = 400ms
}

// ✅ FAST: Use transaction
async function endRound(roundId: string) {
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      // All in one transaction
      const round = await Rounds.getById(roundId);
      const winner = await Bids.findWinnerFast(roundId); // Uses sort + limit
      await Rounds.update(roundId, { status: "completed" });
    });
  } finally {
    await session.endSession();
  }
  // Total: ~150ms (single transaction)
}
```

### **3. Add Query Result Caching**

**Problem:** Same queries executed repeatedly (e.g., get all houses)

**Note:** Current `src/lib/cache.ts` uses browser-side `sessionStorage` (5-minute TTL), not server-side LRU caching.

**Recommended Server-Side Solution (For Next Deployment):**

```typescript
// Example: Add server-side LRU caching to src/lib/cache.ts
import { LRUCache } from 'lru-cache';

const cache = new LRUCache({
  max: 100, // Keep 100 items
  maxSize: 50_000, // 50KB max
  ttl: 1000 * 5, // 5 second TTL
});

export function getOrCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs: number = 5000
): Promise<T> {
  if (cache.has(key)) {
    return Promise.resolve(cache.get(key) as T);
  }

  return fetchFn().then((result) => {
    cache.set(key, result);
    return result;
  });
}
```

**Usage:**

```typescript
// In API routes
import { getOrCache } from "@/lib/cache";

export const GET = async () => {
  const houses = await getOrCache(
    "all-houses",
    () => Houses.getAll(),
    5000 // Cache for 5 seconds
  );
  return NextResponse.json(houses);
};
```

### **4. Batch Operations**

**Problem:** Creating multiple documents one-by-one

```typescript
// ❌ SLOW: 10 insertOne calls = 10 network roundtrips
for (const bid of bids) {
  await Bids.create(bid);
}

// ✅ FAST: Single insertMany call = 1 network roundtrip
await collection.insertMany(bids);
```

---

## Index Verification

### **Check Indexes in MongoDB**

```bash
# Log into MongoDB Atlas

# In mongo shell:
db.bids.getIndexes()

# Should see:
# [
#   { key: { _id: 1 }, name: "_id_" },
#   { key: { roundId: 1, houseId: 1 }, name: "roundId_1_houseId_1", unique: true },
#   ...
# ]
```

### **If Indexes Missing**

Run seed to rebuild indexes:

```bash
npm run seed-test-data

# This triggers ensureIndexes() in all models
```

### **Index Statistics**

```bash
# In MongoDB Atlas Cloud Shell:

db.bids.aggregate([
  { $indexStats: {} }
])

# Returns:
# - accesses: How often index was used
# - keys: Index definition
# - size: Index storage size
```

---

## Caching Strategy

### **Three-Layer Caching**

#### **Layer 1: Application Memory (5-30s TTL)**

```typescript
// Static data that changes rarely
const CONFIG_CACHE = {
  value: null as AuctionConfig | null,
  timestamp: 0,
  ttl: 30_000, // 30 seconds
};

export async function getCachedConfig(): Promise<AuctionConfig> {
  const now = Date.now();
  if (CONFIG_CACHE.value && now - CONFIG_CACHE.timestamp < CONFIG_CACHE.ttl) {
    return CONFIG_CACHE.value;
  }

  CONFIG_CACHE.value = await Config.get();
  CONFIG_CACHE.timestamp = now;
  return CONFIG_CACHE.value;
}
```

#### **Layer 2: HTTP Caching (Response Headers)**

```typescript
// In API routes
export const GET = async () => {
  const data = await Houses.getAll();

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, max-age=60", // Cache 60 seconds
    },
  });
};
```

#### **Layer 3: Database Query Optimization**

Already covered above with indexes and sorting.

### **Cache Invalidation Strategy**

```typescript
// When data changes, invalidate relevant cache
export async function updateConfig(update: Partial<AuctionConfig>) {
  const result = await Config.update(update);

  // Invalidate cache
  CONFIG_CACHE.value = null;
  CONFIG_CACHE.timestamp = 0;

  // Broadcast to all clients
  io.emit("config-update", await Config.get());

  return result;
}
```

---

## Load Testing Guide

### **Tool: k6 (Recommended)**

```bash
npm install -g k6
```

### **Test Script: k6 (src/scripts/load-test.js)**

Create `src/scripts/load-test.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 5 },   // Ramp up to 5 users
    { duration: '1m30s', target: 10 }, // Ramp up to 10 users
    { duration: '20s', target: 0 },   // Ramp down
  ],
};

export default function () {
  // Simulate round operations
  let roundId = '507f1f77bcf86cd799439011'; // Sample ID

  // 1. Start round
  let startRes = http.post(`http://localhost:3000/api/rounds/${roundId}/start`, {
    headers: {
      'Authorization': 'Bearer YOUR_JWT_TOKEN',
      'Content-Type': 'application/json',
    },
  });

  check(startRes, {
    'start round status 200': (r) => r.status === 200,
    'start round duration < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // 2. Place bid
  let bidRes = http.post(`http://localhost:3000/api/bids`, JSON.stringify({
    teamId: 'team123',
    amount: 100,
  }), {
    headers: {
      'Authorization': 'Bearer YOUR_JWT_TOKEN',
      'Content-Type': 'application/json',
    },
  });

  check(bidRes, {
    'bid placement status 200': (r) => r.status === 200,
    'bid placement duration < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(2);
}
```

### **Run Load Test**

```bash
# Test locally first
k6 run src/scripts/load-test.js

# Output shows:
# - Response times per endpoint
# - Error rates
# - Throughput (requests/sec)

# If all checks pass → ready for production
# If slow → apply optimizations above
```

### **Test Checklist**

Run these tests in order:

- [ ] **Baseline Test (1 concurrent user)**
  ```bash
  k6 run --vus 1 --duration 1m src/scripts/load-test.js
  ```
  Expected: All operations < 200ms

- [ ] **Concurrent Users Test (10 concurrent)**
  ```bash
  k6 run --vus 10 --duration 2m src/scripts/load-test.js
  ```
  Expected: All operations < 500ms (P99)

- [ ] **Spike Test (sudden jump to 20 users)**
  ```bash
  k6 run --stage 1m:1 --stage 30s:20 --stage 1m:0 src/scripts/load-test.js
  ```
  Expected: No connection errors; latency spike recovers

- [ ] **Soak Test (long duration)**
  ```bash
  k6 run --duration 30m --vus 5 src/scripts/load-test.js
  ```
  Expected: No memory leaks; stable latency

---

## Monitoring & Profiling

### **Enable MongoDB Profiling**

```typescript
// In src/lib/mongodb.ts
const client = new MongoClient(MONGODB_URI, {
  // ... existing config
});

// Enable profiling
await client.db().setProfilingLevel('all', { slowms: 100 });
```

**In MongoDB Atlas:**

1. Cluster → Performance Advisor
2. Enable "Profiling" with threshold: 100ms
3. Review slow queries in "Query Profiler"

### **Profile Node.js Performance**

```bash
# Use clinic.js for profiling
npm install -g clinic

clinic doctor -- npm start

# Visit http://localhost:3000 and use app normally
# Ctrl+C to stop
# clinic generates HTML report with CPU/memory profile
```

### **Check Memory Usage**

```bash
# In Node.js at runtime
node --inspect server.js

# Open chrome://inspect in Chrome
# Inspect process → Memory tab → Take heap snapshot
# Look for memory leaks (detached DOM nodes, closures)
```

### **Database Performance Metrics**

**Query Execution Time:**

```bash
# In MongoDB Atlas Cloud Shell
db.system.profile.find({
  "millis": { $gt: 100 }  // Queries > 100ms
}).sort({ ts: -1 }).limit(10)

# Returns slow query details
```

**Index Usage:**

```bash
db.bids.aggregate([
  { $indexStats: {} }
]).pretty()

# accesses: number of times index was used
# If 0 → index not used, may need optimization
```

### **Memory Leak Prevention**

```typescript
// In useSocket.ts - clean up listeners on unmount
useEffect(() => {
  return () => {
    // Remove all listeners to prevent memory leaks
    socket?.offAny();
  };
}, [socket]);
```

---

## Performance Checklist

Before deploying to production, verify:

- [ ] **Connection Pool:** maxPoolSize set to 50
- [ ] **Indexes:** All indexes created (run seed-test-data)
- [ ] **Caching:** Config and static data cached with 5-30s TTL
- [ ] **Load Test:** Passed with 10 concurrent users, all < 500ms
- [ ] **MongoDB Region:** us-east-1 (matches Render)
- [ ] **Monitoring:** Slow query logs enabled in Atlas
- [ ] **Health Check:** `/api/ping` endpoint working
- [ ] **Memory:** Node.js process < 500MB at rest

---

## Quick Performance Wins (Prioritized)

**Implement these in order for maximum impact:**

| Priority | Change | Impact | Time |
|----------|--------|--------|------|
| 🔴 High | Increase maxPoolSize to 50 | Eliminates timeouts | 2 min |
| 🔴 High | Move MongoDB to us-east-1 | 10-20x faster queries | 30 min |
| 🟡 Medium | Add query result caching | Reduces DB load by 30% | 15 min |
| 🟡 Medium | Optimize round transition queries | Faster round end | 20 min |
| 🟢 Low | Enable MongoDB profiling | Better observability | 5 min |

---

## Troubleshooting Performance Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| All endpoints slow (> 1s) | MongoDB region (ap-south-1) | Move to us-east-1 (30 min) |
| Some endpoints slow | Missing indexes | Run seed-test-data (2 min) |
| Timeout after 30s | Connection pool exhausted | Increase maxPoolSize (2 min) |
| Intermittent slowness | No caching; repeated queries | Add layer 1 caching (15 min) |
| Memory increasing over time | Memory leak in Socket.io | Check listener cleanup (20 min) |
| High CPU usage | Slow queries causing lock contention | Add query optimization (20 min) |

---

## Next Steps

1. **Implement** connection pool optimization (2 min)
2. **Deploy** to Render with us-east-1 MongoDB (30 min)
3. **Run** load test locally (10 min)
4. **Verify** all checks < 500ms
5. **Deploy** to production with monitoring enabled

---

**Status:** ✅ Finalized December 31, 2025  
**Review:** Before each deployment
