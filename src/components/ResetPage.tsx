import { useState, useCallback } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { ref as dbRef, remove } from 'firebase/database';
import { ref as storageRef, listAll, deleteObject } from 'firebase/storage';
import { db, rtdb, storage } from '../services/firebase';
import { signOutUser } from '../services/authService';

type LogEntry = { message: string; status: 'info' | 'ok' | 'error' };

export function ResetPage() {
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const log = useCallback((message: string, status: LogEntry['status'] = 'info') => {
    setLogs((prev) => [...prev, { message, status }]);
  }, []);

  const runReset = useCallback(async () => {
    setStarted(true);

    // 1. Get all board IDs
    log('Fetching all boards...');
    let boardIds: string[] = [];
    try {
      const boardsSnap = await getDocs(collection(db, 'boards'));
      boardIds = boardsSnap.docs.map((d) => d.id);
      log(`Found ${boardIds.length} board(s)`, 'ok');
    } catch (e) {
      log(`Failed to fetch boards: ${e}`, 'error');
    }

    // 2. Delete all board subcollections (objects, undoHistory) and the board doc itself
    for (const boardId of boardIds) {
      // Delete objects subcollection
      try {
        const objectsSnap = await getDocs(collection(db, 'boards', boardId, 'objects'));
        const deletes = objectsSnap.docs.map((d) => deleteDoc(d.ref));
        await Promise.all(deletes);
        log(`  [${boardId}] Deleted ${objectsSnap.size} objects`, 'ok');
      } catch (e) {
        log(`  [${boardId}] Failed to delete objects: ${e}`, 'error');
      }

      // Delete undoHistory subcollection
      try {
        const undoSnap = await getDocs(collection(db, 'boards', boardId, 'undoHistory'));
        const deletes = undoSnap.docs.map((d) => deleteDoc(d.ref));
        await Promise.all(deletes);
        if (undoSnap.size > 0) log(`  [${boardId}] Deleted ${undoSnap.size} undo history docs`, 'ok');
      } catch (e) {
        log(`  [${boardId}] Failed to delete undo history: ${e}`, 'error');
      }

      // Delete the board document itself
      try {
        await deleteDoc(doc(db, 'boards', boardId));
        log(`  [${boardId}] Board document deleted`, 'ok');
      } catch (e) {
        log(`  [${boardId}] Failed to delete board doc: ${e}`, 'error');
      }
    }

    // 3. Delete all userBoards documents
    log('Deleting userBoards collection...');
    try {
      const userBoardsSnap = await getDocs(collection(db, 'userBoards'));
      const deletes = userBoardsSnap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletes);
      log(`Deleted ${userBoardsSnap.size} userBoards doc(s)`, 'ok');
    } catch (e) {
      log(`Failed to delete userBoards: ${e}`, 'error');
    }

    // 4. Wipe RTDB boards/ node (presence, cursors, chat)
    log('Wiping Realtime Database (boards/)...');
    try {
      await remove(dbRef(rtdb, 'boards'));
      log('RTDB boards/ cleared', 'ok');
    } catch (e) {
      log(`Failed to clear RTDB: ${e}`, 'error');
    }

    // 5. Delete all Firebase Storage files under boards/
    log('Deleting Storage screenshots...');
    try {
      const boardsStorageRef = storageRef(storage, 'boards');
      const listResult = await listAll(boardsStorageRef);

      // Delete files at root level
      for (const item of listResult.items) {
        await deleteObject(item);
      }

      // Delete files in subdirectories (boards/{boardId}/preview.jpg)
      for (const prefix of listResult.prefixes) {
        const subList = await listAll(prefix);
        for (const item of subList.items) {
          await deleteObject(item);
        }
      }

      const totalFiles = listResult.items.length + listResult.prefixes.length;
      log(`Deleted screenshots from ${totalFiles} location(s)`, 'ok');
    } catch (e) {
      log(`Failed to delete storage files: ${e}`, 'error');
    }

    // 6. Sign out
    log('Signing out...');
    try {
      await signOutUser();
      log('Signed out', 'ok');
    } catch (e) {
      log(`Failed to sign out: ${e}`, 'error');
    }

    log('Factory reset complete.', 'ok');
    setDone(true);
  }, [log]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      color: '#e2e8f0',
      fontFamily: 'monospace',
      padding: '2rem',
    }}>
      <h1 style={{ color: '#ef4444', fontSize: '1.5rem', marginBottom: '1rem' }}>
        Factory Reset
      </h1>

      {!started && (
        <div>
          <p style={{ marginBottom: '1rem', color: '#f59e0b' }}>
            This will permanently delete ALL boards, objects, screenshots, presence data, and undo history.
            This action cannot be undone.
          </p>
          <button
            onClick={runReset}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '0.75rem 2rem',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontWeight: 'bold',
            }}
          >
            Confirm Factory Reset
          </button>
        </div>
      )}

      {logs.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          {logs.map((entry, i) => (
            <div key={i} style={{
              color: entry.status === 'ok' ? '#22c55e' : entry.status === 'error' ? '#ef4444' : '#94a3b8',
              padding: '0.15rem 0',
              fontSize: '0.875rem',
            }}>
              {entry.status === 'ok' ? '  ' : entry.status === 'error' ? '  ' : '  '} {entry.message}
            </div>
          ))}
        </div>
      )}

      {done && (
        <div style={{ marginTop: '1.5rem' }}>
          <a
            href="/"
            style={{
              color: '#3b82f6',
              textDecoration: 'underline',
              fontSize: '1rem',
            }}
          >
            Return to app
          </a>
        </div>
      )}
    </div>
  );
}
