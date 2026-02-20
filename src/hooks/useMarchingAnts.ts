import { useEffect, useRef } from 'react';
import Konva from 'konva';

/**
 * Animates a Konva shape's dashOffset to create a "marching ants" selection effect.
 * Pass the ref to the dashed Rect and whether it should be active.
 */
export function useMarchingAnts(nodeRef: React.RefObject<Konva.Rect | null>, active: boolean) {
  const animRef = useRef<Konva.Animation | null>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!active || !node) {
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }
      return;
    }

    const anim = new Konva.Animation((frame) => {
      if (!frame) return;
      // 24px per second march speed
      node.dashOffset(-(frame.time / 1000) * 24);
    }, node.getLayer());

    anim.start();
    animRef.current = anim;

    return () => {
      anim.stop();
      animRef.current = null;
    };
  }, [active, nodeRef]);
}
