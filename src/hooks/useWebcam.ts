import { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'peerjs';
import { ref, set, onValue, onDisconnect, remove } from 'firebase/database';
import { rtdb } from '../services/firebase';
import type { Webcam } from '../types/board';

interface UseWebcamReturn {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isStreaming: boolean;
  startStreaming: () => Promise<MediaStream>;
  stopStreaming: () => void;
}

export function useWebcam(
  boardId: string,
  userId: string,
  webcamObjects: Webcam[],
): UseWebcamReturn {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeCallsRef = useRef<Map<string, import('peerjs').MediaConnection>>(new Map());
  const peerIdMapRef = useRef<Map<string, string>>(new Map()); // streamerId → peerId
  const rtdbUnsubsRef = useRef<Map<string, () => void>>(new Map());
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
        // Write our peerId to RTDB for discovery
        const peerRef_ = ref(rtdb, `boards/${boardId}/webcamPeers/${userId}`);
        set(peerRef_, { peerId });
        onDisconnect(peerRef_).remove();
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
        call.on('stream', (remoteStream) => {
          // We don't need their stream since we're the streamer
          // But store it if it's non-empty (for mutual video later)
        });
      });
    });
  }, [boardId, userId]);

  /** Start streaming local camera */
  const startStreaming = useCallback(async (): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: true,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    setIsStreaming(true);

    // Ensure peer is created and registered in RTDB
    const peer = await ensurePeer();

    // Re-register the answer handler with the new stream
    peer.off('call');
    peer.on('call', (call) => {
      call.answer(stream);
    });

    return stream;
  }, [ensurePeer]);

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
    const peerRef_ = ref(rtdb, `boards/${boardId}/webcamPeers/${userId}`);
    remove(peerRef_);

    // Destroy peer
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    setIsStreaming(false);
  }, [boardId, userId]);

  // Subscribe to remote webcam peers via RTDB and establish calls
  useEffect(() => {
    const remoteWebcams = webcamObjects.filter((w) => w.streamerId !== userId);
    const activeStreamerIds = new Set(remoteWebcams.map((w) => w.streamerId));

    // Subscribe to new remote streamer peerIds
    for (const webcam of remoteWebcams) {
      const { streamerId } = webcam;
      if (rtdbUnsubsRef.current.has(streamerId)) continue;

      const peerRef_ = ref(rtdb, `boards/${boardId}/webcamPeers/${streamerId}`);
      const unsub = onValue(peerRef_, async (snapshot) => {
        const data = snapshot.val();
        if (!data?.peerId) {
          // Streamer went offline — clean up call
          const existingCall = activeCallsRef.current.get(streamerId);
          if (existingCall) {
            existingCall.close();
            activeCallsRef.current.delete(streamerId);
            setRemoteStreams((prev) => {
              const next = new Map(prev);
              next.delete(streamerId);
              return next;
            });
          }
          peerIdMapRef.current.delete(streamerId);
          return;
        }

        const remotePeerId = data.peerId;
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
        if (activeCallsRef.current.has(streamerId) && prevPeerId === remotePeerId) return;

        // Ensure our peer exists
        try {
          const peer = await ensurePeer();
          // Call the remote peer with an empty stream (we just want their video)
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
      });

      rtdbUnsubsRef.current.set(streamerId, unsub);
    }

    // Clean up subscriptions for streamers that are no longer on the board
    for (const [streamerId, unsub] of rtdbUnsubsRef.current) {
      if (!activeStreamerIds.has(streamerId)) {
        unsub();
        rtdbUnsubsRef.current.delete(streamerId);
        const call = activeCallsRef.current.get(streamerId);
        if (call) {
          call.close();
          activeCallsRef.current.delete(streamerId);
        }
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(streamerId);
          return next;
        });
      }
    }
  }, [webcamObjects, userId, boardId, ensurePeer]);

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
      // Unsubscribe RTDB listeners
      for (const [, unsub] of rtdbUnsubsRef.current) {
        unsub();
      }
      rtdbUnsubsRef.current.clear();
      // Remove our RTDB entry
      // (onDisconnect handles this too, but explicit is better)
      const peerRef_ = ref(rtdb, `boards/${boardId}/webcamPeers/${userId}`);
      remove(peerRef_);
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
    startStreaming,
    stopStreaming,
  };
}
