<!-- f391b45f-6af6-46e7-90b8-0bfaa7d248d8 8d45e1b5-4af3-4de0-a668-5f9fd1a9d38b -->
# Socket.IO Integration & Final Production Optimizations

## Current State Analysis

### What's Working Well

- Socket.IO server is configured with production settings in `server.js`
- Polling intervals reduced to 10s (house & projector pages)
- `/api/status` has 30s cache and probabilistic auto-end check (20% chance)
- Request deduplication implemented in `fetchWithAuth.ts` and `fetchPublic.ts`
- MongoDB connection pooling configured
- Environment variables set up in `render.yaml`

### Critical Issues Found

1. **Socket.IO is NOT being used** - `useSocket` hook exists but is never imported/used in components
2. **No socket events on bid placement** - `/api/bids` route doesn't emit socket events
3. **No socket events on admin actions** - Round start/end routes don't emit socket events
4. **Missing performance packages** - `bufferutil` and `utf-8-validate` not installed

## Implementation Plan

### 1. Integrate Socket.IO in House Pages (High Impact)

**Issue:** House captain pages only poll, don't use real-time socket updates.

**Fix:**

- Import and use `useSocket` hook in `src/app/house/[houseId]/page.tsx`
- Listen for `bid-notification` events to show when other houses bid
- Listen for `round-started` and `round-ended` events
- Keep polling as fallback (reduce to 15s when socket connected)
- Emit `bid-placed` event after successful bid placement

**Files:** `src/app/house/[houseId]/page.tsx`

### 2. Integrate Socket.IO in Projector (High Impact)

**Issue:** Projector only polls, doesn't use real-time updates.

**Fix:**

- Import and use `useSocket` hook in `src/app/projector/page.tsx`
- Listen for `state-update`, `round-started`, `round-ended`, `bid-notification`
- Update house bid states immediately on socket events
- Keep polling as fallback (reduce to 15s when socket connected)

**Files:** `src/app/projector/page.tsx`

### 3. Emit Socket Events from Bid Placement (Critical)

**Issue:** When bids are placed, no socket events are emitted to notify other clients.

**Fix:**

- In `src/app/api/bids/route.ts` POST handler, after successful bid placement:
- Get house name from database
- Emit `bid-placed` event via Socket.IO (need to access `io` instance)
- Use a shared socket instance or emit via HTTP to a socket endpoint

**Challenge:** Next.js API routes don't have direct access to Socket.IO server instance.

**Solution Options:**

- Option A: Create a shared module that exports the `io` instance
- Option B: Create a separate API endpoint that emits socket events (POST `/api/socket/emit`)
- Option C: Use a message queue/event bus pattern

**Recommended:** Option A - Create `src/lib/socket-instance.ts` that exports the `io` instance, import it in both `server.js` and API routes.

**Files:**

- `src/lib/socket-instance.ts` (new)
- `server.js` (modify to export io)
- `src/app/api/bids/route.ts`

### 4. Emit Socket Events from Admin Actions (Critical)

**Issue:** When admin starts/ends rounds, no socket events are emitted.

**Fix:**

- In `src/app/api/rounds/next/start/route.ts`, after starting round:
- Emit `admin:start-round` event via socket (or call socket endpoint)
- In round end route (if exists), emit `admin:end-round` event
- Use the shared socket instance from step 3

**Files:**

- `src/app/api/rounds/next/start/route.ts`
- Round end route (need to find this)

### 5. Install Socket.IO Performance Packages (Low Impact, Easy Win)

**Issue:** Missing optional performance packages that improve WebSocket efficiency.

**Fix:**

- Install `bufferutil` and `utf-8-validate` as optional dependencies
- These improve WebSocket frame operations (masking/unmasking, UTF-8 validation)
- Server will fall back to JS implementation if unavailable

**Command:** `npm install --save-optional bufferutil utf-8-validate`

**Files:** `package.json` (auto-updated)

### 6. Optimize Socket.IO Client Connection (Medium Impact)

**Issue:** Socket client connects on every component mount, may create duplicate connections.

**Fix:**

- Ensure `useSocket` hook uses singleton pattern (already does via module-level `socket` variable)
- Add connection status indicator in UI (optional, nice-to-have)
- Verify reconnection logic works correctly

**Files:** `src/hooks/useSocket.ts` (verify, may already be correct)

### 7. Fix Socket.IO Server State Building (Low Impact)

**Issue:** `buildStateFromDB()` in `server.js` makes HTTP request to `/api/status`, which is inefficient.

**Fix:**

- Directly import and use database models instead of HTTP fetch
- Reduces latency and avoids circular dependency risks

**Files:** `server.js`

## Expected Impact

### Before:

- **Real-time updates:** None (polling only)
- **Database queries:** ~2-3/second (good)
- **User experience:** 10s delay for updates
- **Socket.IO:** Configured but unused

### After:

- **Real-time updates:** Instant via Socket.IO, polling as fallback
- **Database queries:** ~2-3/second (unchanged)
- **User experience:** Instant updates when bids placed
- **Socket.IO:** Fully integrated and functional

## Render Free Tier Considerations

- **Compute:** Socket.IO adds minimal overhead (~1-2% CPU)
- **Bandwidth:** WebSocket connections are more efficient than polling
- **Memory:** Socket.IO connections use ~2-4KB per client (10-20 users = ~40-80KB)
- **Connection limits:** Render free tier supports 100+ concurrent connections easily

## Testing Checklist

- [ ] House pages receive real-time bid notifications
- [ ] Projector updates immediately when bids placed
- [ ] Round start/end events broadcast correctly
- [ ] Polling still works as fallback when socket disconnected
- [ ] No duplicate socket connections
- [ ] Reconnection works after network interruption
- [ ] Performance packages installed (check logs for native addon usage)

## Implementation Order

1. **Critical:** Steps 3-4 (Emit socket events from API routes)
2. **High Impact:** Steps 1-2 (Integrate sockets in components)
3. **Easy Wins:** Step 5 (Performance packages), Step 7 (Optimize state building)
4. **Polish:** Step 6 (Verify client connection)

Each step is independently testable. Test after steps 3-4 before proceeding to 1-2.

### To-dos

- [ ] Create shared socket instance module (src/lib/socket-instance.ts) to allow API routes to emit events
- [ ] Emit socket events from /api/bids POST route when bids are placed
- [ ] Emit socket events from admin round start/end routes
- [ ] Integrate useSocket hook in house captain pages to receive real-time updates
- [ ] Integrate useSocket hook in projector page to receive real-time updates
- [ ] Install bufferutil and utf-8-validate as optional dependencies for Socket.IO performance
- [ ] Replace HTTP fetch in buildStateFromDB() with direct database queries