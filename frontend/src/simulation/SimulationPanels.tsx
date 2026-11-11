import { AnimatePresence, motion } from 'framer-motion';
import type { CatalogProvenance } from '../data/catalog-provenance.js';
import type { LiveSceneState } from '../renderer/live/use-live-scene.js';
import { PanelErrorBoundary } from '../ui/PanelErrorBoundary.js';
import { useReducedMotion } from '../state/use-reduced-motion.js';
import { SimulationObjectPanel } from './SimulationObjectPanel.js';
import { SimulationBodyPanel } from './SimulationBodyPanel.js';
import { useSelectedBody } from './use-selected-body.js';

/** Design.md §5: panels spring, stiffness 220 / damping 26. */
const PANEL_SPRING = { type: 'spring', stiffness: 220, damping: 26 } as const;

/**
 * The left panel, for a satellite or a body (B.15, S5a). The trail above it lives in the header (Stage B §5.3).
 */
export function SimulationPanels({ scene, provenance }: { readonly scene: LiveSceneState; readonly provenance: CatalogProvenance }) {
  const reducedMotion = useReducedMotion();
  const meta = scene.selectedObjectMeta;
  const body = useSelectedBody();
  // Reduced motion fades the panel in place rather than sliding it (P4.D21).
  const panelOffset = reducedMotion ? { opacity: 0 } : { opacity: 0, x: -16 };

  return (
    <>
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
                body && <SimulationBodyPanel scene={scene} body={body} />
              )}
            </PanelErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
