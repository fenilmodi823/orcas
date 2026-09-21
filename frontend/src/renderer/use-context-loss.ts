import { useEffect, useState } from 'react';

export interface ContextLossState {
  /** True between `webglcontextlost` and `webglcontextrestored`. */
  readonly lost: boolean;
  /** True once a loss has happened and not yet been restored past one frame —
   * lets the UI say something honest rather than showing a frozen image. */
  readonly everLost: boolean;
}

/**
 * Keeps the canvas recoverable after the GPU drops its WebGL context.
 *
 * Browsers drop the context on backgrounding, on a GPU driver reset, and under
 * memory pressure. The default behaviour of an unhandled loss is a permanently
 * black canvas that never comes back — calling `preventDefault()` on the
 * `webglcontextlost` event is what tells the browser the page intends to
 * restore itself, and without it `webglcontextrestored` is never fired at all.
 *
 * This is milestone M1.9's context-loss pass (brief §6.5 recommendation 2).
 * Rules.md's error table says a failure must degrade to something honest and
 * never to a black canvas, so the caller renders a message while `lost` is
 * true rather than leaving the viewer looking at nothing.
 */
export function useContextLoss(canvas: HTMLCanvasElement | null): ContextLossState {
  const [state, setState] = useState<ContextLossState>({ lost: false, everLost: false });

  useEffect(() => {
    if (!canvas) return;

    const onLost = (event: Event) => {
      // Without this the browser never attempts restoration.
      event.preventDefault();
      console.warn('[orcas] WebGL context lost — waiting for restore');
      setState({ lost: true, everLost: true });
    };
    const onRestored = () => {
      console.warn('[orcas] WebGL context restored');
      setState((prev) => ({ ...prev, lost: false }));
    };

    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [canvas]);

  return state;
}
