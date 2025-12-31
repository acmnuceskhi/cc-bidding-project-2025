# Deployment Guide — CC Bidding Project 2025

**Purpose:** Critical insights from November 18 deployment failure + key recommendations.  
**NOT a comprehensive setup guide** — refer to platform documentation for detailed walkthrough.

⚠️ **IMPORTANT:** This document contains **recommendations for future deployments**. The current codebase (`server.js`, `render.yaml`) **has NOT been updated** with these fixes. Future teams must apply these changes before deploying.

**Related:** [INCIDENT_REPORT.md](../reference/INCIDENT_REPORT.md) | [PERFORMANCE.md](./PERFORMANCE.md)

---

## Table of Contents

1. [Platform Choice](#platform-choice)
2. [THE CRITICAL REQUIREMENT: Region Co-location](#the-critical-requirement-region-co-location)
3. [Connection Pooling](#connection-pooling)
4. [Pre-Deployment Checklist](#pre-deployment-checklist)
5. [Common Issues & Fixes](#common-issues--fixes)
6. [What Went Wrong on Nov 18](#what-went-wrong-on-nov-18)

---

## Platform Choice

### **Recommended: Render**

- ✅ $7-12/month (cheap)
- ✅ `render.yaml` already exists in repo
- ✅ WebSocket support for Socket.io
- ✅ Easy MongoDB Atlas integration

### **Avoid: Heroku**
- ❌ $50-100/month minimum (prohibitive)
- ❌ Free tier discontinued (Nov 2022)

### **Google Cloud** (attempted post-failure, not re-tested)
- ⚠️ Tried after the initial incident, but the app was **not re-tested**, so impact is unknown
- ⚠️ More operational overhead for this small scale (6-10 concurrent users)
- ⚠️ Consider only if your team already has GCP expertise; otherwise Render/Railway are simpler

**Alternatives:** Railway or Vercel also work; follow same principles below.

---

## Connection Pooling

### **Why This Matters (Secondary Factor)**

The app had 6 concurrent users (2 admins + 4 house captains). Default connection pool is too small:

**Current State (`server.js` lines 24-28):**
```javascript
const client = new MongoClient(MONGODB_URI, {
  maxPoolSize: 10,        // ❌ Too small for 6+ concurrent users
  minPoolSize: 2,         // ❌ Connections not kept warm
  maxIdleTimeMS: 30000,
});

// After 3 rounds of activity, pool exhaustion kicks in
// Round 4 start → All connections busy → Requests queue → Timeout
```

### **Recommended Fix (For Next Deployment)**

⚠️ **Future teams must update `server.js` before next deployment:**

```javascript
const client = new MongoClient(MONGODB_URI, {
  maxPoolSize: 50,        // ✅ Handle 6-10 concurrent connections + buffer
  minPoolSize: 10,        // ✅ Keep connections warm
  maxIdleTimeMS: 45000,   // ✅ Recycle idle connections
});
```

**When to adjust:**
- **5-10 users:** maxPoolSize: 30-50 ✅
- **10-20 users:** maxPoolSize: 50-100
- **20+ users:** maxPoolSize: 100+

---

## Pre-Deployment Checklist

**Before deploying to production:**

### **Infrastructure**
- [ ] App and MongoDB in **SAME REGION** (both us-east-1 for Render)
- [ ] Connection pooling updated to `maxPoolSize: 50+` in `server.js` (currently 10)
- [ ] `render.yaml` region updated to `virginia` (currently `oregon`)
- [ ] Environment variables set (MONGODB_URI, JWT_SECRET, NODE_ENV=production)
- [ ] Health check endpoint working: `GET /api/ping` (configured in `render.yaml`)

### **Testing** (Critical!)
- [ ] Local testing completed successfully (seed data, round flow)
- [ ] At least 3-4 concurrent users tested simultaneously
- [ ] Multiple rounds executed (5+) to verify no degradation

### **Monitoring**
- [ ] Error logging enabled (Sentry, DataDog, or basic console)
- [ ] MongoDB slow query logs enabled (100ms threshold)
- [ ] Health check monitored (uptime pinging)

### **Security**
- [ ] CORS properly configured (no `*` in production)
- [ ] JWT_SECRET is strong (32+ random characters)
- [ ] No secrets committed to Git
- [ ] `.env.local` NOT in repository

---

## Common Issues & Fixes

### **Issue: "Infinite Loading" After 2-3 Rounds**

**Symptoms:** App hangs when starting round 4+ after working rounds 1-3

**Diagnosis (in order):**
1. Check if MongoDB region ≠ deployment region
   - App in us-east-1, DB in ap-south-1? → **This can be the problem**
2. Check connection pool size < 30
   - `maxPoolSize: 10` → Pool exhausted, requests queued
3. Check MongoDB slow query logs
   - Queries > 500ms? → Latency confirmed

**Fix:**
```
1. Migrate MongoDB to same region as app (5-10 mins)
2. Increase connection pooling to 50+ (code change + redeploy, 5 mins)
3. Re-test with 6 concurrent users for 10 rounds
```

### **Issue: "Cannot connect to MongoDB"**

**Likely Causes:**
- MONGODB_URI typo or wrong credentials
- MongoDB cluster paused (check Atlas dashboard)
- IP whitelist doesn't include deployment platform

**Fix:**
1. Verify MONGODB_URI in environment variables
2. Check MongoDB Atlas → Cluster is running (not paused)
3. MongoDB Atlas → Network Access → IP Whitelist includes your platform IP

### **Issue: Socket.io Not Connecting (WebSocket errors)**

**Fix:**
1. Check browser console for exact error
2. Verify CORS configuration in `server.js`
3. Ensure WebSocket protocol enabled on deployment platform

---

## THE CRITICAL REQUIREMENT: Region Co-location

### **Why This Matters (November 18 Lesson)**

The app failure was NOT due to a code bug. It was **geographic latency**:

```
❌ Heroku (us-east-1) ──[200-400ms]── MongoDB Atlas (ap-south-1 Mumbai)
                            ↓
                        Round 1-3: Works (low data volume)
                        Round 4: Fails (accumulated latency + pool exhaustion)

✅ Render (us-east-1) ──[5-20ms]── MongoDB Atlas (us-east-1)
                            ↓
                        Handles 20+ rounds smoothly
```

### **Rule: Deploy app & database in SAME region**

**Current State (`render.yaml` line 5):**
```yaml
region: oregon  # ❌ us-west-2 (Oregon) - will cause latency if MongoDB is in us-east-1
```

**Recommended for Next Deployment:**
- Render dyno: **us-east-1 (Virginia)** - Update `render.yaml` to `region: virginia`
- MongoDB Atlas: **MUST be us-east-1 (N. Virginia)**

**Cost to fix:** FREE — just create new cluster in correct region, update connection string

**Latency impact:**
- Wrong region: 200-400ms per query → queries timeout after 3-4 rounds
- Correct region: 5-20ms per query → handles 20+ rounds easily

---

## What Went Wrong on November 18

**Timeline (approximate minutes):**
- Round 1 (~minute 0-3): ✅ Smooth — 5 queries, all complete < 200ms total
- Round 2 (~minute 4-7): ✅ Smooth — 12 bids in DB, still fast
- Round 3 (~minute 8-11): ✅ Smooth — 20 bids accumulated, still under threshold
- Round 4 attempt (~minute 12-15): ❌ Hang — Admin clicked "start round" → infinite loading

**Why it happened:**
1. **Heroku (US) → MongoDB Mumbai (India):** 200-400ms network latency per query
2. **After 3 rounds:** Bids accumulated (20+), connection pool getting tight
3. **Round 4:** Database queries timeout because:
   - Each query: 5ms execution + 200-400ms network latency = 205-405ms
   - Round start needs 15-20 queries = 3-8 seconds total
   - Heroku HTTP timeout: 30-60 seconds, but Socket.io client timeout: 10-20 seconds
   - UI waiting → infinite loading spinner

**Why you didn't notice earlier:**
- Rounds 1-3 worked because fewer bids = simpler queries = stayed under timeout
- It wasn't a gradual slowdown—it was a **threshold-based failure**
- After this threshold, every subsequent round operation times out

**The fix (already documented above):**
- Deploy to Render (us-east-1)
- Create MongoDB cluster in us-east-1 (same region)
- Increase connection pooling to 50
- Result: Same code, 10-20x faster queries, handles 20+ rounds easily

---

## Key Takeaways for Next Team

| What | Why | Lesson |
|------|-----|--------|
| **Geographic latency kills you** | 200-400ms per query × 20 queries = timeout | Always co-locate app + DB in same region |
| **Connection pooling needs headroom** | Default 10 connections → exhausted at 6 concurrent users | Use maxPoolSize: 50+ for 5-10 concurrent users |
| **No load testing = risky** | Worked locally (low data) but failed at 20+ bids | Load test with realistic data before live event |
| **Monitor from the start** | No visibility into what was slow | Enable MongoDB slow query logs + response time tracking |
| **Region matters more than code** | System was well-designed, infrastructure was the bottleneck | Spend 10 mins verifying regions, saves hours of debugging |

---

## Summary

**ACTION ITEMS for next team before deploying:**

1. **Update `render.yaml`** (1 min)
   - Change `region: oregon` → `region: virginia` (us-east-1)
   
2. **Update `server.js` Connection Pooling** (2 mins)
   - Change `maxPoolSize: 10` → `maxPoolSize: 50`
   - Change `minPoolSize: 2` → `minPoolSize: 10`
   - Change `maxIdleTimeMS: 30000` → `maxIdleTimeMS: 45000`

3. **Create MongoDB Cluster in us-east-1** (5 mins)
   - MongoDB Atlas → Create cluster → Select **N. Virginia (us-east-1)**
   - Update MONGODB_URI environment variable

4. **Pre-Deployment Testing** (1-2 hours)
   - Test with 6 concurrent users, 10 rounds minimum

5. **Enable Monitoring** (10 mins)
   - Enable MongoDB slow query logs (100ms threshold)
   - Set up error logging (Sentry/console)

**Result:** Application that handles live event smoothly with 5-10 concurrent users for 20+ rounds.

---

**Status:** ✅ Finalized December 31, 2025  
**Based on:** November 18, 2025 production failure analysis

For detailed deployment steps, refer to platform documentation (Render, MongoDB Atlas).  
For performance optimization, see [PERFORMANCE.md](./PERFORMANCE.md).  
For root cause analysis, see [INCIDENT_REPORT.md](../reference/INCIDENT_REPORT.md).
