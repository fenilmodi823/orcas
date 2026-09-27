import { useEffect, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from 'three';
import type { FrameState } from '../../simulation/frame-state.js';
import type { ObjectLabelHandle } from '../../ui/ObjectLabel.js';
import { createEarthSunMoon } from './earth-sun-moon-system.js';
import type { BodyScreenPosition } from './body-screen.js';

const DEFAULT_FOV_DEG = 35;

function place(label: ObjectLabelHandle | null, at: BodyScreenPosition): void {
  if (!label) return;
  label.setOpacity(at.visible ? 1 : 0);
  if (at.visible) label.setPosition(at.xPx, at.yPx);
}

interface Props {
  readonly frameStateRef: MutableRefObject<FrameState>;
  readonly sunLabelRef: MutableRefObject<ObjectLabelHandle | null>;
  readonly moonLabelRef: MutableRefObject<ObjectLabelHandle | null>;
}

/**
 * The Earth, Sun and Moon (M1.10 / M1.11), driven by the simulation clock.
 * Mount after the camera controller: the atmosphere reads the final camera
 * position each frame.
 */
export function EarthSunMoon({ frameStateRef, sunLabelRef, moonLabelRef }: Props) {
  const { gl } = useThree();
  const system = useMemo(() => createEarthSunMoon(), []);

  useEffect(() => {
    system.loadTextures(Math.min(8, gl.capabilities.getMaxAnisotropy()));
    return () => system.dispose();
  }, [gl, system]);

  useFrame(({ camera, size }) => {
    const epochMs = frameStateRef.current.epochMs;
    if (epochMs <= 0) return; // the simulation clock has not ticked yet
    const fov = camera instanceof PerspectiveCamera ? camera.fov : DEFAULT_FOV_DEG;
    system.update(epochMs, camera, fov, { cssWidth: size.width, cssHeight: size.height, dpr: gl.getPixelRatio() });
    place(sunLabelRef.current, system.labels.sun);
    place(moonLabelRef.current, system.labels.moon);
  });

  return <primitive object={system.group} />;
}
