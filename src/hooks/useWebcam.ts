import { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'peerjs';
import { ref, set, onValue, onDisconnect, remove } from 'firebase/database';
import { rtdb } from '../services/firebase';

export interface WebcamPeer {
  streamerId: string;
  label: string;
}

interface UseWebcamReturn {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isStreaming: boolean;
  activePeers: WebcamPeer[];
  startStreaming: (label: string) => Promise<MediaStream>;
  stopStreaming: () => void;
}

export function useWebcam(
  boardId: string,
  userId: string,
): UseWebcamReturn {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);
  const [activePeers, setActivePeers] = useState<WebcamPeer[]>([]);

  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeCallsRef = useRef<Map<string, import('peerjs').MediaConnection>>(new Map());
  const peerIdMapRef = useRef<Map<string, string>>(new Map()); // streamerId → peerId
  const isStreamingRef = useRef(false);

  // Keep refs in sync
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  /** Create PeerJS instance lazily */
  const ensurePeer = useCallback((): Promise<Peer> => {
    return new Promise((resolve, reject) => {
      if (peerRef.current && !peerRef.current.destroyed) {
        resolve(peerRef.current);
        return;
      }
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', (peerId) => {
        // Write our peerId to RTDB for discovery — label is set separately
        const peerRef_ = ref(rtdb, `boards/${boardId}/webcamPeers/${userId}/peerId`);
        set(peerRef_, peerId);
        const entryRef = ref(rtdb, `boards/${boardId}/webcamPeers/${userId}`);
        onDisconnect(entryRef).remove();
        resolve(peer);
      });

      peer.on('error', (err) => {
        console.warn('PeerJS error:', err);
        reject(err);
      });

      // Answer incoming calls (viewers calling us)
      peer.on('call', (call) => {
        const stream = localStreamRef.current;
        call.answer(stream ?? new MediaStream());
      });
    });
  }, [boardId, userId]);

  /** Start streaming local camera */
  const startStreaming = useCallback(async (label: string): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: true,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    setIsStreaming(true);

    // Ensure peer is created and registered in RTDB
    const peer = await ensurePeer();

    // Write label to RTDB
    const labelRef = ref(rtdb, `boards/${boardId}/webcamPeers/${userId}/label`);
    set(labelRef, label);

    // Re-register the answer handler with the new stream
    peer.off('call');
    peer.on('call', (call) => {
      call.answer(stream);
    });

    return stream;
  }, [ensurePeer, boardId, userId]);

  /** Stop streaming */
  const stopStreaming = useCallback(() => {
    // Stop all media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Close all active calls
    for (const [, call] of activeCallsRef.current) {
      call.close();
    }
    activeCallsRef.current.clear();
    setRemoteStreams(new Map());

    // Remove RTDB entry
    const entryRef = ref(rtdb, `boards/${boardId}/webcamPeers/${userId}`);
    remove(entryRef);

    // Destroy peer
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    setIsStreaming(false);
  }, [boardId, userId]);

  // Subscribe to ALL webcam peers via RTDB and establish calls to remote ones
  useEffect(() => {
    const peersRef = ref(rtdb, `boards/${boardId}/webcamPeers`);
    const unsub = onValue(peersRef, async (snapshot) => {
      const data = snapshot.val() as Record<string, { peerId?: string; label?: string }> | null;

      // Build active peers list
      const peers: WebcamPeer[] = [];
      const remoteStreamerIds = new Set<string>();

      if (data) {
        for (const [streamerId, entry] of Object.entries(data)) {
          peers.push({
            streamerId,
            label: entry.label ?? 'Anonymous',
          });

          // Skip our own stream — we don't need to call ourselves
          if (streamerId === userId) continue;
          if (!entry.peerId) continue;

          remoteStreamerIds.add(streamerId);
          const remotePeerId = entry.peerId;
          const prevPeerId = peerIdMapRef.current.get(streamerId);

          // If peerId changed (reconnect), close old call
          if (prevPeerId && prevPeerId !== remotePeerId) {
            const oldCall = activeCallsRef.current.get(streamerId);
            if (oldCall) {
              oldCall.close();
              activeCallsRef.current.delete(streamerId);
            }
          }

          peerIdMapRef.current.set(streamerId, remotePeerId);

          // Don't call if we already have an active call to this peer
          if (activeCallsRef.current.has(streamerId) && prevPeerId === remotePeerId) continue;

          // Ensure our peer exists
          try {
            const peer = await ensurePeer();
            const call = peer.call(remotePeerId, new MediaStream());
            activeCallsRef.current.set(streamerId, call);

            call.on('stream', (remoteStream) => {
              setRemoteStreams((prev) => {
                const next = new Map(prev);
                next.set(streamerId, remoteStream);
                return next;
              });
            });

            call.on('close', () => {
              activeCallsRef.current.delete(streamerId);
              setRemoteStreams((prev) => {
                const next = new Map(prev);
                next.delete(streamerId);
                return next;
              });
            });
          } catch (err) {
            console.warn('Failed to call remote peer:', err);
          }
        }
      }

      setActivePeers(peers);

      // Clean up calls to streamers that disappeared from RTDB
      for (const [streamerId] of activeCallsRef.current) {
        if (!remoteStreamerIds.has(streamerId)) {
          const call = activeCallsRef.current.get(streamerId);
          if (call) call.close();
          activeCallsRef.current.delete(streamerId);
          peerIdMapRef.current.delete(streamerId);
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(streamerId);
            return next;
          });
        }
      }
    });

    return () => unsub();
  }, [boardId, userId, ensurePeer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      // Close all calls
      for (const [, call] of activeCallsRef.current) {
        call.close();
      }
      activeCallsRef.current.clear();
      // Remove our RTDB entry
      // (onDisconnect handles this too, but explicit is better)
      const entryRef = ref(rtdb, `boards/${boardId}/webcamPeers/${userId}`);
      remove(entryRef);
      // Destroy peer
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
    };
  }, [boardId, userId]);

  return {
    localStream,
    remoteStreams,
    isStreaming,
    activePeers,
    startStreaming,
    stopStreaming,
  };
}
