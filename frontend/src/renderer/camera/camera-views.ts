import { Vector3, type PerspectiveCamera } from 'three';
import type { PlanetEphemeris } from '../../data/planet-ephemeris.js';
import { whenMoonSystemSettles } from '../../data/moon-systems.js';
import { useSelectionStore } from '../../state/selection-store.js';
import { bodyById, type Body } from '../solar/bodies.js';
import { bodyTarget, ECLIPTIC_NORTH_J2000, HOME_DISTANCE_KM, homeOffsetKm } from '../solar/body-target.js';
import { moonSystemOf } from '../solar/moons.js';
import { systemMembers, systemPlaneNormal } from '../solar/system-members.js';
import type { CameraSystem } from './camera-system.js';
import { useCameraStatus, type CameraView } from './camera-status.js';
import { OUTER_SYSTEM_DISTANCE_KM, SYSTEM_MIN_DISTANCE_KM, systemViewOffsetKm } from './system-view.js';

/** NASA's `_goToSystem` moves in two legs of 1 s, and never spins after (`cinematic: false`). */
const SYSTEM_FLIGHT = { aimSec: 1, travelSec: 1, spin: false } as const;

export interface CameraViewDeps {
  readonly sys: Pick<CameraSystem, 'flyToBody'>;
  readonly camera: PerspectiveCamera;
  readonly epochMs: () => number;
  readonly ephemerisRef: { readonly current: PlanetEphemeris | null };
  /** Nearby: the controller's own flight to a body, which waits for its position. */
  readonly followBody: (id: string) => void;
  /** Home clears the selection without the flight back to the Earth that clearing usually starts. */
  readonly clearSelectionQuietly: () => void;
  /** Drops the controller's Nearby follow still waiting for a position: outside a moon's spans it never ends. */
  readonly clearPending: () => void;
}

/** The body whose system "System" frames: a moon's planet (the Moon's Earth), else the body; the Sun has none. */
export function systemBodyOf(body: Body): Body | null {
  if (body.kind === 'star') return null;
  return body.kind === 'moon' && body.parent ? (bodyById(body.parent) ?? null) : body;
}

/**
 * NASA Eyes' camera views (S6b), wired to the camera-status store: Nearby flies to the selected body (S5a);
 * System frames its system (`system-view.ts`), waiting for the moons' file; the Sun's Inner (home) and Outer
 * look down on the Solar System. The breadcrumb's home moved here from the controller and now flies NASA's
 * two legs, as `goToSystem("inner_solar_system")` does. A new selection starts at Nearby. Returns an unsubscribe.
 */
export function subscribeCameraViews(deps: CameraViewDeps): () => void {
  const { sys, camera, epochMs, ephemerisRef } = deps;
  let cancelWait: (() => void) | null = null;

  // Each returns false when it cannot fly yet (no epoch, or DE421 still loading).
  const flySun = (distanceKm: number, key: string): boolean => {
    const sun = bodyById('sun');
    const at = epochMs();
    if (!sun || at <= 0) return false;
    const target = { ...bodyTarget(sun, ephemerisRef), key };
    const sunKm = target.positionKm(at, new Vector3());
    if (!sunKm) return false;
    const arrivalOffsetKm = homeOffsetKm(camera.position, sunKm, new Vector3(), distanceKm);
    sys.flyToBody(target, { arrivalOffsetKm, refUp: ECLIPTIC_NORTH_J2000.clone(), ...SYSTEM_FLIGHT }).catch(() => undefined);
    return true;
  };

  const flySystem = (body: Body): boolean => {
    const at = epochMs();
    const target = { ...bodyTarget(body, ephemerisRef), key: `${body.id}-system` };
    const centre = at > 0 ? target.positionKm(at, new Vector3()) : null;
    if (!centre) return false;
    const planeNormal = systemPlaneNormal(body, at, new Vector3());
    const arrivalOffsetKm = systemViewOffsetKm(
      {
        cameraOffsetKm: camera.position.clone().sub(centre),
        planeNormal,
        members: systemMembers(body, at, ephemerisRef.current, centre),
        fovVerticalDeg: camera.fov,
        aspect: camera.aspect,
        minDistanceKm: SYSTEM_MIN_DISTANCE_KM[body.id] ?? 0,
      },
      new Vector3(),
    );
    sys.flyToBody(target, { arrivalOffsetKm, refUp: planeNormal.clone(), ...SYSTEM_FLIGHT }).catch(() => undefined);
    return true;
  };

  // A pill must not read pressed while the camera stays put.
  const flewOrNearby = (flew: boolean) => {
    if (!flew) useCameraStatus.getState().setView('nearby');
  };

  const show = (view: CameraView) => {
    cancelWait?.();
    cancelWait = null;
    if (view !== 'nearby') deps.clearPending(); // or the Nearby follow undoes this view once its body has a position
    if (view === 'inner') return flewOrNearby(flySun(HOME_DISTANCE_KM, 'inner'));
    if (view === 'outer') return flewOrNearby(flySun(OUTER_SYSTEM_DISTANCE_KM, 'outer'));
    const id = useSelectionStore.getState().selectedBody;
    const body = id === null ? undefined : bodyById(id);
    if (!body) return;
    if (view === 'nearby') return deps.followBody(body.id);
    const system = systemBodyOf(body);
    if (!system) return;
    const moons = moonSystemOf(system.id);
    if (!moons) return flewOrNearby(flySystem(system));
    // Frame every moon, so wait for them; a failed file frames the planet alone, at NASA's minimum.
    cancelWait = whenMoonSystemSettles(moons, () => flewOrNearby(flySystem(system)));
  };

  const offViews = useCameraStatus.subscribe((state, prev) => {
    if (state.viewRequests !== prev.viewRequests) show(state.view);
  });
  const offHome = useCameraStatus.subscribe((state, prev) => {
    if (state.homeRequests === prev.homeRequests || epochMs() <= 0) return;
    cancelWait?.();
    cancelWait = null;
    deps.clearSelectionQuietly();
    flySun(HOME_DISTANCE_KM, 'home');
  });
  const offSelection = useSelectionStore.subscribe((state, prev) => {
    if (state.selectedBody !== prev.selectedBody || state.selectedNorad !== prev.selectedNorad) {
      cancelWait?.(); // a System view still waiting for its moons is stale now
      cancelWait = null;
      useCameraStatus.getState().setView('nearby');
    }
  });
  return () => {
    cancelWait?.();
    offViews();
    offHome();
    offSelection();
  };
}
