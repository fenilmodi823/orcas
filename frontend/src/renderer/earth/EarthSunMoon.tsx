import { useEffect, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import { sunPositionJ2000Km } from '@orcas/physics';
import type { FrameState } from '../../simulation/frame-state.js';
import { usePlanetEphemeris } from '../../data/use-planet-ephemeris.js';
import { createEarthSunMoon } from './earth-sun-moon-system.js';
import type { BodyScreenPosition } from './body-screen.js';
import type { BodyLabelRefs } from './BodyLabels.js';
import type { ObjectLabelHandle } from '../../ui/ObjectLabel.js';
import { createPlanetBodies } from '../solar/planet-bodies.js';
import { createSceneLabelWriter } from '../solar/scene-labels.js';
import { clampNearToBodies } from '../solar/near-clamp.js';
import { layerFade, SATELLITE_LAYER_RADIUS_KM } from '../scale-fade.js';
import { PLANETS } from '../solar/planets.js';
import { useSelectionStore } from '../../state/selection-store.js';

const DEFAULT_FOV_DEG = 35;

function place(label: ObjectLabelHandle | null, at: BodyScreenPosition, opacity = 1): void {
  if (!label) return;
  label.setOpacity(at.visible ? opacity : 0);
  if (at.visible) label.setPosition(at.xPx, at.yPx);
}

interface Props {
  readonly frameStateRef: MutableRefObject<FrameState>;
  readonly labelsRef: MutableRefObject<BodyLabelRefs>;
}

/**
 * The Earth, Sun and Moon (M1.10 / M1.11) and the planets (S4), driven by the
 * simulation clock. Mount after the camera controller: the atmosphere reads
 * the final camera position each frame, and the near plane is pulled in here
 * for any body nearer than the Earth.
 */
export function EarthSunMoon({ frameStateRef, labelsRef }: Props) {
  const { gl } = useThree();
  const system = useMemo(() => createEarthSunMoon(), []);
  const planets = useMemo(() => createPlanetBodies(Math.min(8, gl.capabilities.getMaxAnisotropy())), [gl]);
  const labelWriter = useMemo(() => createSceneLabelWriter(planets), [planets]);
  const analyticSunKm = useMemo(() => new Vector3(), []);
  const ephemerisRef = usePlanetEphemeris();

  useEffect(() => {
    system.loadTextures(Math.min(8, gl.capabilities.getMaxAnisotropy()));
    return () => {
      system.dispose();
      planets.dispose();
    };
  }, [gl, system, planets]);

  useFrame(({ camera, size }) => {
    const epochMs = frameStateRef.current.epochMs;
    if (epochMs <= 0) return; // the simulation clock has not ticked yet
    const at = new Date(epochMs);
    const fov = camera instanceof PerspectiveCamera ? camera.fov : DEFAULT_FOV_DEG;
    const viewport = { cssWidth: size.width, cssHeight: size.height, dpr: gl.getPixelRatio() };

    const { hoveredBody, selectedBody } = useSelectionStore.getState(); // read per frame, never re-rendered on
    const indexOf = (id: string | null) => PLANETS.findIndex((p) => p.name.toLowerCase() === id);
    planets.update(epochMs, ephemerisRef.current, camera, viewport, indexOf(hoveredBody), indexOf(selectedBody));
    // DE421's Sun once the bake has loaded, so the Sun sits where the planets'
    // orbits say; the analytic M1.11 Sun (~0.01°) until then.
    let sunKm = planets.sunKm;
    if (!planets.placed) {
      const s = sunPositionJ2000Km(at);
      sunKm = analyticSunKm.set(s.x, s.y, s.z);
    }
    system.update(epochMs, camera, fov, viewport, sunKm);
    labelWriter.write(at, camera, size.width, size.height, sunKm, system.moonKm);
    if (camera instanceof PerspectiveCamera) clampNearToBodies(camera, labelWriter.occluders, planets.ringDistanceKm);

    const refs = labelsRef.current;
    const labels = labelWriter.labels;
    place(refs.sun, labels.sun);
    place(refs.moon, labels.moon);
    labels.planets.forEach((p, i) => place(refs.planets[i] ?? null, p));
    // The Lagrange labels belong to the Earth-scale layers, which fade out past ~2 × 10⁶ km (B.21).
    const fade = layerFade(SATELLITE_LAYER_RADIUS_KM, camera.position.length());
    labels.lagrange.forEach((p, i) => place(refs.lagrange[i] ?? null, p, fade));
  });

  return (
    <>
      <primitive object={system.group} />
      <primitive object={planets.group} />
    </>
  );
}
