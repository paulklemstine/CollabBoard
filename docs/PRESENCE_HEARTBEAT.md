# Presence & Cursor Timeout System

## Overview
Both the presence system and cursor system now use timeout mechanisms to accurately track active users and automatically remove stale data from users who have closed their browser tab, logged out, or lost connection.

- **Presence System**: Uses heartbeat (5s) + timeout (15s) to track online users
- **Cursor System**: Uses timestamp filtering + timeout (3s) to remove stale cursors

## How It Works

### Heartbeat Mechanism
- **Interval**: Every 5 seconds (`HEARTBEAT_INTERVAL = 5000ms`)
- **Action**: Updates the user's `lastSeen` timestamp in Firebase RTDB
- **Purpose**: Continuously signals that the user is active

### Timeout & Cleanup
- **Timeout**: 15 seconds (`PRESENCE_TIMEOUT = 15000ms`)
- **Logic**: Users whose `lastSeen` is older than 15 seconds are automatically filtered from the online users list
- **Result**: Inactive users disappear from the presence panel within 15 seconds

### Lifecycle

#### User Joins
1. User opens the board
2. `usePresence` hook registers user as online with current timestamp
3. Sets up `onDisconnect` handler to remove user on connection loss
4. Starts heartbeat interval

#### User Active
1. Every 5 seconds, heartbeat fires
2. Updates `lastSeen` timestamp in RTDB
3. All other users see this update and know the user is still active

#### User Leaves (Graceful)
1. User closes tab or navigates away
2. React cleanup function runs
3. Clears heartbeat interval
4. Marks user as `online: false`
5. Other users immediately see user as offline

#### User Leaves (Ungraceful)
1. User loses internet connection or browser crashes
2. Heartbeat stops sending updates
3. After 15 seconds, `lastSeen` is too old
4. Other users' clients filter out the stale user
5. User disappears from presence panel

### Configuration

```typescript
// In src/hooks/usePresence.ts

// Heartbeat: update presence every 5 seconds
export const HEARTBEAT_INTERVAL = 5000;

// Timeout: consider user offline if no heartbeat for 15 seconds
export const PRESENCE_TIMEOUT = 15000;
```

**Tuning Guidelines:**
- **Lower heartbeat interval** = more responsive but more database writes
- **Higher timeout** = more tolerant of network hiccups but slower to remove stale users
- **Recommended ratio**: Timeout should be 2-3x the heartbeat interval

### Database Writes

**Per user, per session:**
- Initial registration: 1 write
- Heartbeat (5s interval): 12 writes/minute
- Graceful exit: 1 write
- **Total for 5-minute session**: ~61 writes

**Cost optimization:**
- Firebase RTDB: 1M operations = $0.50
- 100 concurrent users for 1 hour = ~73,200 writes = $0.037

### Benefits

1. **Accurate presence tracking** - Stale users removed within 15 seconds
2. **Handles all edge cases** - Works for tab close, browser crash, network loss, logout
3. **No manual cleanup needed** - Client-side filtering automatically removes stale users
4. **Lightweight** - Only requires timestamp updates, no complex server logic
5. **Real-time** - All clients see presence updates immediately

### Testing

Run tests with:
```bash
npm test -- src/hooks/usePresence.test.ts
```

Manual testing:
1. Open board in 2+ browser windows
2. Close one window without signing out
3. Within 15 seconds, user disappears from presence panel in other windows
4. Check RTDB in Firebase Console - heartbeats update every 5 seconds

## Cursor Timeout System

The cursor system works differently from presence - instead of a heartbeat, it relies on the existing cursor movement updates and filters out stale cursors.

### How Cursors Work

1. **Cursor Movement**: When user moves their cursor, it's throttled to ~10 updates/second (100ms)
2. **Timestamp**: Each cursor update includes a `timestamp` field
3. **Timeout**: 3 seconds (`CURSOR_TIMEOUT = 3000ms`)
4. **Filtering**: Client-side filtering removes cursors with timestamps older than 3 seconds

### Configuration

```typescript
// In src/hooks/useCursors.ts

// Cursor timeout: remove cursors if no update for 3 seconds
export const CURSOR_TIMEOUT = 3000;
```

### Why 3 seconds?

- **Shorter than presence**: Cursors need to disappear faster for better UX
- **Movement-based**: Users expect cursors to disappear quickly when someone stops moving
- **Throttle-aware**: Longer than throttle interval (100ms) to avoid false positives
- **Network tolerance**: Allows for minor network hiccups without cursor flicker

### Cursor Lifecycle

#### User Moves Cursor
1. Cursor position updates (throttled to 100ms)
2. Timestamp updated with each movement
3. Other users see cursor position in real-time

#### User Stops Moving (Still Active)
1. No more cursor updates
2. After 3 seconds, cursor disappears from other users' screens
3. User is still "online" in presence panel
4. Cursor reappears when user moves again

#### User Leaves
1. **Graceful**: `onDisconnect` removes cursor immediately
2. **Ungraceful**: After 3 seconds of no updates, cursor filtered out

### Database Writes

**Cursors (per user, per session):**
- Movement-based, not time-based
- ~10 writes/second while moving
- 0 writes when idle
- Very cost-efficient (only pays for actual activity)

### Future Improvements

- **Adaptive heartbeat (presence)**: Slow down heartbeat when tab is not focused
- **Visibility API**: Pause heartbeat when tab is hidden
- **Server-side cleanup**: Cloud Function to periodically clean up very old presence/cursor records
- **Activity indicators**: Show "idle" status if user hasn't moved cursor in 2+ minutes
- **Cursor fade-out**: Visual fade animation before cursor disappears
