import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { AdditiveBlending, Color, PerspectiveCamera, ShaderMaterial, type Points } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { ObjectMeta } from '../../data/catalog-types.js';
import type { FrameState } from '../../simulation/frame-state.js';
import { createPointsGeometry } from './points-geometry.js';

const VERTEX_SHADER = /* glsl */ `
attribute float aEntityId;
attribute float aRegime;
attribute float aRadius;
attribute float aFlags;

uniform float uPixelsPerRadian;
uniform float uMinPointPx;
uniform float uDpr;
uniform float uBaseBrightness;
uniform float uFloorBrightness;
uniform float uDimFactor;
uniform float uFocusActive;

varying float vBrightness;

void main() {
  if (aFlags < 0.5) {
    // Filtered-out objects are moved off clip space in the shader, not
    // culled on the CPU (brief §B.3) — no object exists in M1.3, this
    // branch exists for M1.4 to actually use.
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vBrightness = 0.0;
    return;
  }

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float dist = max(length(mvPosition.xyz), 1e-6);

  // 1. apparent size, with a floor that does NOT flatten brightness.
  float truePx = aRadius * uPixelsPerRadian / dist;
  float drawPx = max(truePx, uMinPointPx);
  gl_PointSize = drawPx * uDpr;

  // 2. compensate: an object drawn larger than reality is dimmed by the
  //    area ratio, so distant debris stays visible but recedes.
  float brightness = uBaseBrightness * min(1.0, (truePx * truePx) / (drawPx * drawPx));
  brightness = max(brightness, uFloorBrightness);

  // 3. D6 focus dim — uFocusActive is fixed at 0.0 in M1.3 (no selection
  //    system exists yet, that's M1.5/M1.6); this line is a no-op today.
  brightness *= mix(1.0, uDimFactor, uFocusActive);

  vBrightness = brightness;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision mediump float;

varying float vBrightness;
uniform vec3 uColor;

void main() {
  // Soft radial falloff on gl_PointCoord: a Gaussian-ish core plus a
  // faint halo (brief §B.3). The 4.0 / 0.12 constants below are chosen
  // empirically for this task and tuned live in Task 7 — not spec values.
  vec2 fromCenter = gl_PointCoord - vec2(0.5);
  float d = length(fromCenter) * 2.0; // 0 at center, 1 at edge
  float core = exp(-d * d * 4.0);
  float halo = smoothstep(1.0, 0.0, d) * 0.12;
  float alpha = clamp(core + halo, 0.0, 1.0) * vBrightness;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

interface TierZeroPointsProps {
  readonly objects: readonly ObjectMeta[];
  readonly frameStateRef: MutableRefObject<FrameState>;
}

/** Reads --orca-cyan from tokens.css rather than hardcoding the hex —
 * Rules.md bans colour literals outside tokens.css; a GLSL uniform can't
 * reference a CSS variable directly, so this is the one-time bridge. */
function readCyanToken(): Color {
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--orca-cyan').trim();
  return new Color(hex || '#00E5FF');
}

/**
 * Tier 0 GPU point renderer (brief §B.3): one `THREE.Points`, one draw
 * call, every object in the catalogue. Positions come from M1.2's
 * `FrameState` — the SAME buffer every frame, flagged `needsUpdate`
 * rather than replaced, so this component allocates nothing per frame.
 *
 * Geometry and material are built once inside a mount effect, never in
 * `useMemo` — reading `frameStateRef.current` (needed to wrap the live
 * position buffer) is only safe outside render, and assigning the result
 * straight onto the ref-held `THREE.Points` instance is the same
 * imperative-mutation-via-ref pattern `Satellites.tsx` and
 * `use-simulation-loop.ts` already use elsewhere in this codebase.
 */
export function TierZeroPoints({ objects, frameStateRef }: TierZeroPointsProps) {
  const pointsRef = useRef<Points>(null);
  const { size, camera } = useThree();

  useEffect(() => {
    const points = pointsRef.current;
    if (!points) return;

    const geometry = createPointsGeometry(objects, frameStateRef.current.positions);
    const material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uPixelsPerRadian: { value: 0 },
        uMinPointPx: { value: 1.5 }, // chosen empirically, tune in Task 7
        uDpr: { value: Math.min(window.devicePixelRatio, 2) }, // Rules.md perf ceiling: dpr capped at 2
        uBaseBrightness: { value: 1.0 },
        // 0.6, not 0.05: with PLACEHOLDER_RADIUS_KM this small, truePx is
        // always many orders of magnitude below uMinPointPx for every
        // object at any real-world distance, so the area-ratio
        // compensation always crushes brightness to this floor — verified
        // live in Task 7 (a 0.05 floor rendered as an invisible ~2px,
        // 5%-alpha additive dot, indistinguishable from the background).
        // Once real per-object sizes exist, most objects will draw well
        // above the floor and this value matters far less.
        uFloorBrightness: { value: 0.6 },
        uDimFactor: { value: 0.3 }, // D6, Design.md §3 — not invented here
        uFocusActive: { value: 0.0 }, // no selection system until M1.5
        uColor: { value: readCyanToken() },
      },
    });

    points.geometry = geometry;
    points.material = material;

    return () => {
      geometry.dispose();
      material.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- objects/frameStateRef are stable for the route's lifetime, same precedent as use-simulation-loop.ts
  }, []);

  useFrame(() => {
    const points = pointsRef.current;
    if (!points) return;

    // The mount effect above assigns the real geometry imperatively, and
    // it can lose the race against this callback's very first rAF tick
    // (React's passive-effect scheduling isn't guaranteed to land before
    // R3F's next frame) — until it does, `points.geometry` is still
    // THREE.Points's own default empty BufferGeometry, which has no
    // 'position' attribute at all. Bail for that one frame; every frame
    // after the effect lands finds it and proceeds normally.
    const positionAttribute = points.geometry.getAttribute('position');
    if (!positionAttribute) return;

    // Zero-allocation per-frame work: flag the SAME position buffer for
    // re-upload (M1.2 already wrote this frame's values into it), and
    // update the two camera-dependent uniforms with cheap arithmetic.
    positionAttribute.needsUpdate = true;

    const material = points.material as ShaderMaterial;
    if (camera instanceof PerspectiveCamera) {
      const verticalFovRad = (camera.fov * Math.PI) / 180;
      material.uniforms.uPixelsPerRadian.value = size.height / verticalFovRad;
    }
  });

  // frustumCulled disabled: three.js would need to recompute the geometry's
  // bounding sphere from `position` every time it changes to cull correctly,
  // which is exactly the per-frame CPU cost this component exists to avoid.
  return <points ref={pointsRef} frustumCulled={false} />;
}
