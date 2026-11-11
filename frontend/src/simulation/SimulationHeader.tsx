import { useRef } from 'react';
import type { CatalogProvenance } from '../data/catalog-provenance.js';
import type { LiveSceneState } from '../renderer/live/use-live-scene.js';
import { bodyById } from '../renderer/solar/bodies.js';
import { useSelectionStore } from '../state/selection-store.js';
import { Breadcrumb, type Crumb } from '../ui/Breadcrumb.js';
import { PanelErrorBoundary } from '../ui/PanelErrorBoundary.js';
import { SceneToggle } from '../ui/SceneToggle.js';
import { useChromeRect } from '../ui/use-chrome-rect.js';
import { SiteNotices } from '../ui/SiteNotices.js';
import { StatusPill } from '../ui/StatusPill.js';
import { useSelectedBody } from './use-selected-body.js';

interface SimulationHeaderProps {
  readonly scene: LiveSceneState;
  readonly provenance: CatalogProvenance;
  readonly stale: boolean;
}

/**
 * The one-line header (Stage B §5.3). Left, after the brand mark the landing
 * sequence keeps: the scene button and NASA Eyes' trail, "Solar System ▸ Jupiter ▸ Io"
 * (the planet crumb flies to the planet; a satellite sits under the Earth, a moon
 * under its planet). Right: the Stage C search slot, then the element-set epoch,
 * which is always on screen.
 */
export function SimulationHeader({ scene, provenance, stale }: SimulationHeaderProps) {
  const meta = scene.selectedObjectMeta;
  const body = useSelectedBody();
  const setSelectedBody = useSelectionStore((s) => s.setSelectedBody);

  const root = useRef<HTMLElement>(null);
  useChromeRect(root, 'header');
  const crumbs: Crumb[] = [];
  const parent = meta ? bodyById('earth') : body?.parent ? bodyById(body.parent) : undefined;
  if (parent) crumbs.push({ label: parent.name, onSelect: () => setSelectedBody(parent.id) });
  if (meta) crumbs.push({ label: meta.name });
  else if (body) crumbs.push({ label: body.name });

  return (
    <header ref={root} className="simulation__header">
      <div className="simulation__trail">
        <SceneToggle />
        {crumbs.length > 0 && <Breadcrumb crumbs={crumbs} />}
      </div>
      <span className="simulation__header-slot" data-slot="search" aria-hidden />
      <PanelErrorBoundary label="Epoch">
        <div className="simulation__epoch">
          <StatusPill epoch={new Date(provenance.medianEpochMs)} stale={stale} nowMs={provenance.nowMs} />
          <SiteNotices nowMs={provenance.nowMs} />
        </div>
      </PanelErrorBoundary>
    </header>
  );
}
