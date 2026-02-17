# Presence Heartbeat System

## Overview
The presence system now uses a heartbeat mechanism to accurately track online users and automatically remove inactive users who have closed their browser tab, logged out, or lost connection.

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

### Future Improvements

- **Adaptive heartbeat**: Slow down heartbeat when tab is not focused
- **Visibility API**: Pause heartbeat when tab is hidden
- **Server-side cleanup**: Cloud Function to periodically clean up very old presence records
- **Activity indicators**: Show "idle" status if user hasn't moved cursor in 2+ minutes
