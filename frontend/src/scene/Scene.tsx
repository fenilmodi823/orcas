import { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Earth, Starfield } from '@orcas/scene';

/** Mouse orbit/zoom plus arrow-key pan — Design.md §9: "the scene itself has
 * keyboard camera controls." `listenToKeyEvents` isn't wired by drei itself. */
function CameraControls() {
  const ref = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    // three.js's type declares HTMLElement, but the runtime only needs
    // addEventListener/removeEventListener — window has both, and listening
    // there (not the canvas) means arrow keys work without first clicking
    // the canvas to give it focus.
    ref.current?.listenToKeyEvents(window as unknown as HTMLElement);
  }, []);

  return <OrbitControls ref={ref} makeDefault enableDamping={false} />;
}

/**
 * Everything inside `<Canvas>` (Architecture.md §5). Split out of `App.tsx`
 * so that three.js, R3F, drei and `@orcas/scene` sit behind a lazy boundary
 * instead of in the eagerly `modulepreload`ed entry graph — measured at
 * 232.6 KB gzipped of the 296.4 KB eager payload before this split.
 * The landing sequence stays eager and plays over the gap (Branding.md: it
 * must never block the scene loading behind it).
 */
export function Scene() {
  return (
    <Canvas camera={{ position: [0, 0, 4] }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />
      <Starfield />
      <Earth />
      <CameraControls />
    </Canvas>
  );
}
