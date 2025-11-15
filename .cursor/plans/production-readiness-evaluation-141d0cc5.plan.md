<!-- 141d0cc5-9d86-4e0e-9043-eb40c28fdc44 44c00b89-1ed9-4770-a753-6f443020d27d -->
# Production Readiness Evaluation

## Executive Summary

**Overall Assessment**: The codebase is functional but has several critical performance and production-readiness issues that could cause problems during the event, especially on Render's free tier. The system will work for a small event but may struggle under concurrent load.

**Key Concerns**:

1. **Heavy polling** (every 2-3 seconds) from multiple clients will exhaust Render free tier compute quota
2. **Inefficient database queries** in `/api/status` endpoint (fetches ALL data on every request)
3. **No caching** - every request hits MongoDB
4. **Race conditions** in auto-end logic
5. **No rate limiting** - API endpoints vulnerable to abuse

---

## Critical Issues (Must Fix Before Event)

### 1. **Status Endpoint Performance** - HIGH PRIORITY

**File**: `src/app/api/status/route.ts`

**Problem**: The `/api/status` endpoint is called every 2-3 seconds by multiple clients and performs expensive operations:

- Fetches ALL rounds (`Rounds.getAll()`)
- Fetches ALL participants (`Participants.getAll()`) 
- Fetches ALL teams (`Teams.getAll()`)
- Filters in-memory instead of using database queries
- No caching whatsoever

**Impact**:

- With 5 clients polling every 2 seconds = 150 requests/minute = 9,000 requests/hour
- Each request does 3+ full collection scans
- Will quickly exhaust Render free tier (750 hours/month = ~31 days continuous)
- Response times already showing 3-4 seconds in terminal logs

**Fix**:

- Cache status response for 500ms-1s (use in-memory cache with TTL)
- Use database aggregation pipelines instead of fetching all data
- Only fetch active round data when round is active
- Add database indexes (already present, but verify they're used)

### 2. **Excessive Polling** - HIGH PRIORITY

**Files**:

- `src/app/projector/page.tsx` (line 449: 2000ms interval)
- `src/app/admin/overview/page.tsx` (line 323: 2000ms interval)
- `src/app/house/[houseId]/page.tsx` (line 184: 3000ms interval)

**Problem**: Multiple clients polling simultaneously creates request storms. With 1 projector + 1 admin + 4 house captains = 6 clients × 30 requests/min = 180 requests/minute.

**Impact**: Render free tier has compute limits. Heavy polling will:

- Consume compute quota quickly
- Slow down all requests
- Potentially cause timeouts

**Fix**:

- Increase polling intervals to 5 seconds (still responsive, 60% fewer requests)
- Use Socket.io more effectively (currently underutilized)
- Implement exponential backoff on errors
- Stop polling when page is hidden (Page Visibility API)

### 3. **Race Condition in Auto-End** - MEDIUM PRIORITY

**File**: `src/app/api/status/route.ts` (lines 74-257)

**Problem**: Multiple concurrent requests to `/api/status` can all detect an expired round and try to auto-end it simultaneously. While there's a "processing" status check, the logic is complex and could still have edge cases.

**Impact**: Could cause:

- Duplicate budget deductions
- Inconsistent round states
- Database corruption

**Fix**: The atomic `findOneAndUpdate` with "processing" status is good, but add:

- Better error handling if auto-end fails
- Logging for debugging
- Consider using MongoDB transactions more consistently

### 4. **No Rate Limiting** - MEDIUM PRIORITY

**Problem**: API endpoints have no rate limiting. A malicious user or bug could spam requests.

**Impact**: Could exhaust resources or cause DoS.

**Fix**: Add simple rate limiting middleware (even basic in-memory counter per IP would help).

---

## Performance Issues (Should Fix)

### 5. **Inefficient Database Queries**

**Files**: Multiple model files

**Problems**:

- `Rounds.getAll()` fetches all rounds then sorts in-memory (line 126-133 in `rounds.ts`)
- `Participants.getAll()` fetches all participants for member count (line 14 in `status/route.ts`)
- `Teams.getAll()` fetches all teams then filters unsold teams in-memory (line 26-28 in `status/route.ts`)

**Fix**: Use database queries with filters:

```typescript
// Instead of fetching all and filtering
const unsoldTeams = await Teams.getAll().then(list => list.filter(...))

// Use database query
const unsoldTeams = await db.collection('teams').find({ houseId: { $exists: false } }).toArray()
```

### 6. **No Response Caching**

**Problem**: Identical requests return same data but always hit database.

**Fix**: Add simple in-memory cache with TTL for:

- `/api/houses` (changes infrequently)
- `/api/status` (can cache for 500ms-1s)
- `/api/rounds` (when not active)

### 7. **Console.logs in Production**

**Files**: Throughout codebase (40+ instances)

**Problem**: Excessive console.logs will clutter logs and slow down production.

**Fix**: Replace with proper logging library or at least guard with `if (process.env.NODE_ENV === 'development')`.

---

## Render Free Tier Concerns

### Compute Quota Analysis

**Render Free Tier Limits**:

- 750 hours/month compute time
- 512MB RAM
- Starter plan (limited CPU)

**Current Usage Estimate**:

- 6 clients polling every 2-3 seconds = ~180 requests/minute
- Each `/api/status` request takes ~400-450ms (from logs)
- Active time per request = 0.4s × 180 = 72 seconds/minute of compute
- For a 2-hour event: 72s/min × 120 min = 8,640 seconds = 2.4 hours of compute

**Verdict**: Should be fine for a single event, but:

- If event runs longer or has more clients, could hit limits
- Heavy database queries could cause timeouts
- No headroom for errors/retries

**Recommendations**:

1. Reduce polling frequency (5s instead of 2-3s)
2. Optimize status endpoint (biggest win)
3. Monitor Render dashboard during event
4. Have backup plan (pause polling if issues occur)

---

## Code Quality Issues

### 8. **Error Handling**

**Problem**: Some API routes have try-catch but don't handle specific error types. Frontend has minimal error boundaries.

**Fix**: Add error boundaries for React components, better error messages.

### 9. **Type Safety**

**Problem**: Some `any` types and type assertions (`as any`) in codebase.

**Impact**: Low for event, but could cause runtime errors.

### 10. **Socket.io Underutilization**

**File**: `src/lib/socket-server.ts`

**Problem**: Socket.io is set up but clients still rely heavily on polling. Socket events are sent but clients don't use them effectively.

**Impact**: Wasted resources maintaining WebSocket connections that aren't fully utilized.

---

## Security Concerns (Low Priority for Event)

### 11. **CORS Too Permissive**

**File**: `server.js` line 28, `socket-server.ts` line 40

**Problem**: `origin: "*"` allows any origin to connect.

**Impact**: Low for internal event, but not production-ready.

### 12. **No Input Validation**

**Problem**: Some endpoints don't validate input thoroughly (though bids endpoint does well).

**Impact**: Low risk for controlled event.

### 13. **Session Management**

**File**: `src/lib/auth.ts`

**Problem**: Session timeout is 30 minutes but `lastActiveAt` updates are throttled to 60 seconds. This could cause premature logouts.

**Impact**: Users might get logged out unexpectedly.

---

## Positive Aspects

1. **Good Database Indexing**: Indexes are properly created on startup
2. **Atomic Operations**: Budget deduction uses transactions
3. **Race Condition Protection**: Auto-end has atomic checks
4. **Error Handling**: Most API routes have try-catch
5. **TypeScript**: Good type coverage overall
6. **Testing**: Test suite exists (though not reviewed)

---

## Recommended Action Plan

### Before Event (Critical)

1. ✅ Optimize `/api/status` endpoint (add caching, reduce queries)
2. ✅ Increase polling intervals to 5 seconds
3. ✅ Add simple rate limiting
4. ✅ Remove/guard console.logs

### During Event (Monitoring)

1. Monitor Render dashboard for compute usage
2. Watch for slow API responses
3. Have plan to reduce polling if issues occur

### After Event (If Needed)

1. Implement proper logging
2. Add error boundaries
3. Improve Socket.io utilization
4. Add response caching layer
5. Tighten CORS
6. Add input validation middleware

---

## Quick Wins (Low Effort, High Impact)

1. **Cache status endpoint** (30 min): Add simple Map-based cache with 1s TTL
2. **Increase polling intervals** (5 min): Change 2000ms → 5000ms
3. **Stop polling on hidden tabs** (15 min): Use Page Visibility API
4. **Guard console.logs** (10 min): Wrap in development check

**Total time**: ~1 hour for significant performance improvement

### To-dos

- [ ] Evaluate /api/status endpoint performance and database query efficiency
- [ ] Analyze polling frequency and impact on Render free tier
- [ ] Review race condition handling in auto-end logic
- [ ] Assess security measures (rate limiting, CORS, input validation)
- [ ] Calculate Render free tier compute quota usage estimates