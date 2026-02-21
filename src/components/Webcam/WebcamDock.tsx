import { WebcamPanel } from './WebcamPanel';
import type { WebcamPeer } from '../../hooks/useWebcam';

interface WebcamDockProps {
  activePeers: WebcamPeer[];
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  userId: string;
  onStopStreaming: () => void;
}

export function WebcamDock({
  activePeers,
  localStream,
  remoteStreams,
  userId,
  onStopStreaming,
}: WebcamDockProps) {
  if (activePeers.length === 0) return null;

  return (
    <div
      className="fixed right-3 flex flex-col gap-2 overflow-y-auto pointer-events-auto"
      style={{
        top: 140,
        bottom: 100,
        zIndex: 1050,
        maxHeight: 'calc(100vh - 240px)',
      }}
    >
      {activePeers.map((peer) => {
        const isMine = peer.streamerId === userId;
        const stream = isMine ? localStream : remoteStreams.get(peer.streamerId) ?? null;
        return (
          <WebcamPanel
            key={peer.streamerId}
            label={peer.label}
            stream={stream}
            isMine={isMine}
            onClose={isMine ? onStopStreaming : undefined}
          />
        );
      })}
    </div>
  );
}
