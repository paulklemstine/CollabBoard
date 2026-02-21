import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ref, set, onValue, onDisconnect, remove, push, onChildAdded,
} from 'firebase/database';
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

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

/** Separator for connection keys — safe because Firebase UIDs are alphanumeric */
const SEP = '__';

interface PeerConn {
  pc: RTCPeerConnection;
  cleanup: () => void;
}

export function useWebcam(
  boardId: string,
  userId: string,
): UseWebcamReturn {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);
  const [activePeers, setActivePeers] = useState<WebcamPeer[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const connectionsRef = useRef<Map<string, PeerConn>>(new Map());
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // --------------- Connection helpers ---------------

  const destroyConnection = useCallback((connKey: string) => {
    const conn = connectionsRef.current.get(connKey);
    if (conn) {
      conn.cleanup();
      conn.pc.close();
      connectionsRef.current.delete(connKey);
    }
    pendingRef.current.delete(connKey);
  }, []);

  const destroyAllConnections = useCallback(() => {
    for (const key of [...connectionsRef.current.keys()]) {
      destroyConnection(key);
    }
  }, [destroyConnection]);

  // --------------- Viewer role: call a streamer ---------------

  const callStreamer = useCallback(async (streamerId: string) => {
    const connKey = `${userId}${SEP}${streamerId}`;
    if (connectionsRef.current.has(connKey) || pendingRef.current.has(connKey)) return;
    pendingRef.current.add(connKey);

    try {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const unsubs: (() => void)[] = [];

      // We want to RECEIVE video + audio from the streamer
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // Receive remote stream
      pc.ontrack = (event) => {
        if (event.streams[0]) {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.set(streamerId, event.streams[0]);
            return next;
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          console.warn('[WebRTC] Connection to', streamerId, 'failed');
          destroyConnection(connKey);
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(streamerId);
            return next;
          });
        }
      };

      // ICE candidates → Firebase
      const callerCandRef = ref(rtdb, `boards/${boardId}/webrtcCalls/${connKey}/callerCandidates`);
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          push(callerCandRef, event.candidate.toJSON());
        }
      };

      // Create and write offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const callRef = ref(rtdb, `boards/${boardId}/webrtcCalls/${connKey}`);
      await set(callRef, {
        offer: { type: offer.type, sdp: offer.sdp },
      });
      onDisconnect(callRef).remove();

      // Listen for streamer's answer
      const answerRef = ref(rtdb, `boards/${boardId}/webrtcCalls/${connKey}/answer`);
      const answerUnsub = onValue(answerRef, async (snapshot) => {
        const data = snapshot.val();
        if (!data || pc.signalingState !== 'have-local-offer') return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data));
        } catch (err) {
          console.warn('[WebRTC] setRemoteDescription failed:', err);
        }
      });
      unsubs.push(answerUnsub);

      // Listen for streamer's ICE candidates
      const calleeCandRef = ref(rtdb, `boards/${boardId}/webrtcCalls/${connKey}/calleeCandidates`);
      const candUnsub = onChildAdded(calleeCandRef, (snapshot) => {
        const c = snapshot.val();
        if (c) pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      });
      unsubs.push(candUnsub);

      connectionsRef.current.set(connKey, {
        pc,
        cleanup: () => {
          unsubs.forEach((fn) => fn());
          remove(callRef);
        },
      });
    } catch (err) {
      console.warn('[WebRTC] callStreamer failed:', streamerId, err);
    } finally {
      pendingRef.current.delete(connKey);
    }
  }, [boardId, userId, destroyConnection]);

  // --------------- Streamer role: answer a viewer ---------------

  const answerViewer = useCallback(async (
    callerId: string,
    offer: RTCSessionDescriptionInit,
  ) => {
    const connKey = `${callerId}${SEP}${userId}`;
    destroyConnection(connKey);

    const stream = localStreamRef.current;
    if (!stream) return;

    try {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const unsubs: (() => void)[] = [];

      // Add our real media tracks so the viewer receives our video/audio
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      // ICE candidates → Firebase
      const calleeCandRef = ref(rtdb, `boards/${boardId}/webrtcCalls/${connKey}/calleeCandidates`);
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          push(calleeCandRef, event.candidate.toJSON());
        }
      };

      // Set remote offer and create answer
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Write answer to Firebase
      await set(ref(rtdb, `boards/${boardId}/webrtcCalls/${connKey}/answer`), {
        type: answer.type,
        sdp: answer.sdp,
      });

      // Listen for caller's ICE candidates
      const callerCandRef = ref(rtdb, `boards/${boardId}/webrtcCalls/${connKey}/callerCandidates`);
      const candUnsub = onChildAdded(callerCandRef, (snapshot) => {
        const c = snapshot.val();
        if (c) pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      });
      unsubs.push(candUnsub);

      connectionsRef.current.set(connKey, {
        pc,
        cleanup: () => unsubs.forEach((fn) => fn()),
      });
    } catch (err) {
      console.warn('[WebRTC] answerViewer failed:', callerId, err);
    }
  }, [boardId, userId, destroyConnection]);

  // --------------- Start / Stop streaming ---------------

  const startStreaming = useCallback(async (label: string): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: true,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    setIsStreaming(true);

    // Register in RTDB so other clients discover us
    const entryRef = ref(rtdb, `boards/${boardId}/webcamPeers/${userId}`);
    await set(entryRef, { label });
    onDisconnect(entryRef).remove();

    return stream;
  }, [boardId, userId]);

  const stopStreaming = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    destroyAllConnections();
    setRemoteStreams(new Map());

    const entryRef = ref(rtdb, `boards/${boardId}/webcamPeers/${userId}`);
    remove(entryRef);

    setIsStreaming(false);
  }, [boardId, userId, destroyAllConnections]);

  // --------------- Peer discovery + outgoing calls ---------------

  useEffect(() => {
    const peersRef = ref(rtdb, `boards/${boardId}/webcamPeers`);
    const unsub = onValue(peersRef, (snapshot) => {
      const data = snapshot.val() as Record<string, { label?: string }> | null;
      const peers: WebcamPeer[] = [];
      const remoteIds = new Set<string>();

      if (data) {
        for (const [streamerId, entry] of Object.entries(data)) {
          if (!entry.label) continue;
          peers.push({ streamerId, label: entry.label });

          if (streamerId !== userId) {
            remoteIds.add(streamerId);
            callStreamer(streamerId);
          }
        }
      }

      setActivePeers(peers);

      // Close connections to streamers that left
      for (const connKey of [...connectionsRef.current.keys()]) {
        if (!connKey.startsWith(`${userId}${SEP}`)) continue;
        const streamerId = connKey.slice(userId.length + SEP.length);
        if (!remoteIds.has(streamerId)) {
          destroyConnection(connKey);
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(streamerId);
            return next;
          });
        }
      }
    });

    return unsub;
  }, [boardId, userId, callStreamer, destroyConnection]);

  // --------------- Incoming offers (streamer role) ---------------

  useEffect(() => {
    if (!isStreaming) return;

    const answered = new Set<string>();
    const callsRef = ref(rtdb, `boards/${boardId}/webrtcCalls`);

    const unsub = onValue(callsRef, (snapshot) => {
      const calls = snapshot.val() as Record<
        string,
        { offer?: RTCSessionDescriptionInit; answer?: RTCSessionDescriptionInit }
      > | null;
      if (!calls) return;

      const suffix = `${SEP}${userId}`;
      for (const [connKey, data] of Object.entries(calls)) {
        // Only calls addressed to us
        if (!connKey.endsWith(suffix)) continue;
        // Must have offer, must not already be answered
        if (!data?.offer || data?.answer) continue;
        if (answered.has(connKey)) continue;

        const callerId = connKey.slice(0, -(userId.length + SEP.length));
        answered.add(connKey);
        answerViewer(callerId, data.offer);
      }
    });

    return unsub;
  }, [boardId, userId, isStreaming, answerViewer]);

  // --------------- Cleanup on unmount ---------------

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      for (const [, conn] of connectionsRef.current) {
        conn.cleanup();
        conn.pc.close();
      }
      connectionsRef.current.clear();
      const entryRef = ref(rtdb, `boards/${boardId}/webcamPeers/${userId}`);
      remove(entryRef);
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
