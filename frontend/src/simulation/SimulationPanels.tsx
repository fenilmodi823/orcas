import { AnimatePresence, motion } from 'framer-motion';
import type { CatalogProvenance } from '../data/catalog-provenance.js';
import type { LiveSceneState } from '../renderer/live/use-live-scene.js';
import { useCameraStatus } from '../renderer/camera/camera-status.js';
import { Breadcrumb, type Crumb } from '../ui/Breadcrumb.js';
import { PanelErrorBoundary } from '../ui/PanelErrorBoundary.js';
import { bodyById } from '../renderer/solar/bodies.js';
import { useSelectionStore } from '../state/selection-store.js';
import { useReducedMotion } from '../state/use-reduced-motion.js';
import { SimulationObjectPanel } from './SimulationObjectPanel.js';
import { SimulationBodyPanel } from './SimulationBodyPanel.js';
import { useSelectedBody } from './use-selected-body.js';

/** Design.md §5: panels spring, stiffness 220 / damping 26. */
const PANEL_SPRING = { type: 'spring', stiffness: 220, damping: 26 } as const;

/**
 * The left panel, for a satellite or a body (B.15, S5a), and NASA Eyes' breadcrumb above it:
 * "Solar System › Jupiter › Io". The root is the home view; the planet crumb flies to the planet.
 */
export function SimulationPanels({ scene, provenance }: { readonly scene: LiveSceneState; readonly provenance: CatalogProvenance }) {
  const reducedMotion = useReducedMotion();
  const meta = scene.selectedObjectMeta;
  const body = useSelectedBody();
  const setSelectedBody = useSelectionStore((s) => s.setSelectedBody);
  const requestHome = useCameraStatus((s) => s.requestHome);
  // Reduced motion fades the panel in place rather than sliding it (P4.D21).
  const panelOffset = reducedMotion ? { opacity: 0 } : { opacity: 0, x: -16 };

  const crumbs: Crumb[] = [{ label: 'Solar System', onSelect: requestHome }];
  // A satellite sits under the Earth, a moon under its planet (S6b): NASA's "Jupiter › Moons › Io", without the Moons step.
  const parent = meta ? bodyById('earth') : body?.parent ? bodyById(body.parent) : undefined;
  if (parent) crumbs.push({ label: parent.name, onSelect: () => setSelectedBody(parent.id) });
  if (meta) crumbs.push({ label: meta.name });
  else if (body) crumbs.push({ label: body.name });

  return (
    <>
      <div className="simulation__breadcrumb">
        <Breadcrumb crumbs={crumbs} />
      </div>
      <AnimatePresence>
        {(meta || body) && (
          <motion.div
            key="object-panel"
            className="simulation__panel"
            initial={panelOffset}
            animate={{ opacity: 1, x: 0 }}
            exit={panelOffset}
            transition={PANEL_SPRING}
          >
            <PanelErrorBoundary label="Object panel">
              {meta ? (
                <SimulationObjectPanel scene={scene} meta={meta} provenance={provenance} />
              ) : (
                body && <SimulationBodyPanel scene={scene} body={body} provenance={provenance} />
              )}
            </PanelErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
