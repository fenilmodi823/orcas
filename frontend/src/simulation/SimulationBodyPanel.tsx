import { X } from 'lucide-react';
import type { CatalogProvenance } from '../data/catalog-provenance.js';
import { useHorizonsManifest } from '../data/use-horizons-manifest.js';
import { useMoonSystemsVersion } from '../data/use-moon-systems.js';
import { usePlanetEphemerisState } from '../data/use-planet-ephemeris.js';
import { useCameraStatus } from '../renderer/camera/camera-status.js';
import type { LiveSceneState } from '../renderer/live/use-live-scene.js';
import { bodySubtitle, type Body } from '../renderer/solar/bodies.js';
import { planetCentreFromHorizons } from '../renderer/solar/system-centres.js';
import { CameraViews } from '../ui/CameraViews.js';
import { GlassSurface } from '../ui/GlassSurface.js';
import { TelemetryReadout } from '../ui/TelemetryReadout.js';
import { ObjectDetail } from '../ui/ObjectDetail.js';
import { useSelectionStore } from '../state/selection-store.js';
import { useSimulationClock } from './use-simulation-clock.js';
import { bodyDetailGroups, bodyReadouts, cameraViewOptions } from './body-detail.js';
import { moonPendingNote } from './moon-detail.js';
import '../ui/ObjectPanel.css';

interface SimulationBodyPanelProps {
  readonly scene: LiveSceneState;
  readonly body: Body;
  readonly provenance: CatalogProvenance;
}

/**
 * The left panel for the Sun, a planet or the Moon (S5a), in the satellite panel's layout (B.15). It ticks on its
 * own slow clock, as that panel does, so its re-renders stay inside it. Esc and the close button clear the
 * selection, and the camera flies back to the Earth.
 */
export function SimulationBodyPanel({ scene, body, provenance }: SimulationBodyPanelProps) {
  const currentTime = useSimulationClock(scene.loop.frameStateRef, provenance.nowMs);
  const ephemeris = usePlanetEphemerisState();
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  useMoonSystemsVersion(); // one re-render when a moon system lands or fails
  const manifest = useHorizonsManifest(body.horizons !== undefined);
  const view = useCameraStatus((s) => s.view);
  const requestView = useCameraStatus((s) => s.requestView);
  const epochMs = currentTime.getTime();
  const readouts = bodyReadouts(body, epochMs, ephemeris);
  // A moon wears its planet's hue, as its trail does (NASA: children inherit the parent's); the Moon keeps --moon.
  const token = body.horizons ? (body.parent ?? body.id) : body.id;
  const badge = body.kind === 'star' ? 'var(--text-hi)' : `var(--${token})`;
  const facts = { ephemerisLoaded: ephemeris !== null, centreFromHorizons: planetCentreFromHorizons(body.poleNaifId, epochMs), manifest };

  return (
    <GlassSurface variant="floating" elevation={3} className="object-panel">
      <header className="object-panel__header">
        <span className="object-panel__badge" style={{ background: badge }} aria-hidden />
        <div className="object-panel__identity">
          <h2 className="object-panel__name">{body.name}</h2>
          <span className="object-panel__class">{bodySubtitle(body).toUpperCase()}</span>
        </div>
        <button type="button" className="object-panel__close" onClick={clearSelection} aria-label="Close panel (Esc)">
          <X aria-hidden size={16} />
        </button>
      </header>
      <CameraViews options={cameraViewOptions(body)} active={view} onSelect={requestView} />
      <div className="object-panel__body" role="region" aria-live="polite" aria-label={`Selected body: ${body.name}`}>
        {readouts ? (
          <div className="object-panel__summary">
            {readouts.map((r) => (
              <TelemetryReadout key={r.label} label={r.label} value={r.value} unit={r.unit} precision={r.precision} />
            ))}
          </div>
        ) : (
          <p className="object-panel__pending">{moonPendingNote(body, ephemeris !== null)}</p>
        )}
        <ObjectDetail groups={bodyDetailGroups(body, facts)} />
      </div>
    </GlassSurface>
  );
}
