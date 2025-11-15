<!-- 2225164a-0094-43fe-9ce7-d60d6acccb7e aeb55701-5231-4e19-b70e-5915699b0cb8 -->
# Fix Polling Despite Socket.IO Connection

## Problem

The application continues polling `/api/status` and `/api/houses` every ~150ms even though Socket.IO is connected and should be providing real-time updates via events.

## Root Cause

1. **Stale closure values**: The `scheduleNextPoll` function checks `isConnected` when scheduling, but scheduled timeouts execute even after connection status changes
2. **Missing execution-time check**: Polls are scheduled when `isConnected` is false, but don't re-check connection status when the timeout executes
3. **Effect dependency timing**: The useEffect runs before socket connects, starting polling that doesn't stop when connection is established

## Solution

### 1. Fix Admin Overview Page Polling (`src/app/admin/overview/page.tsx`)

- **Critical Issue**: `pollInterval` is a local variable that gets lost when the effect re-runs after socket connects
- Use a `useRef` to store the interval ID so it persists across effect re-runs
- Check `isConnected` status inside the interval callback, not just when setting it up
- Clear the interval immediately when `isConnected` becomes true
- The cleanup function should use the ref to clear the interval

### 2. Fix Projector Page Polling (`src/app/projector/page.tsx`)

- Modify `scheduleNextPoll` to check `isConnected` both when scheduling AND when executing
- Use a ref to track the latest `isConnected` value to avoid stale closures
- Ensure the timeout callback checks connection status before fetching
- Clear all pending polls immediately when `isConnected` becomes true

### 3. Fix House Dashboard Polling (`src/app/house/[houseId]/page.tsx`)

- Add execution-time check in the `fetchData` timeout callback
- Use ref for `isConnected` to avoid stale closures
- Ensure polling stops immediately when socket connects

### 4. Verify Socket Event Handlers

- Ensure `projector-update` events are properly received and processed
- Verify socket listeners are set up before polling starts
- Add debug logging to confirm socket events are firing

## Files to Modify

- `src/app/admin/overview/page.tsx` - Fix polling interval management with useRef (CRITICAL - this is where the user saw the issue)
- `src/app/projector/page.tsx` - Fix polling logic in `scheduleNextPoll` function
- `src/app/house/[houseId]/page.tsx `- Fix polling logic in `fetchData` function