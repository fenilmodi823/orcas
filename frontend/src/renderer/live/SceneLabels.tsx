import type { MutableRefObject } from 'react';
import type { NoradId, ObjectMeta } from '../../data/catalog-types.js';
import { pinnedLabelNorad, useSelectionStore } from '../../state/selection-store.js';
import { ObjectLabel, type ObjectLabelHandle } from '../../ui/ObjectLabel.js';
import { LABEL_SLOT_COUNT, PIN_SLOT, SELECTION_SLOT } from '../points/label-slots.js';

interface Props {
  readonly labelRefs: MutableRefObject<(ObjectLabelHandle | null)[]>;
  readonly objects: readonly ObjectMeta[];
  readonly byNorad: Readonly<Record<string, number>>;
  readonly featuredNames: readonly string[];
  readonly featuredNorads: readonly NoradId[];
  readonly selectedName: string;
}

/** The DOM labels `ObjectLabels` positions each frame: featured, the selection, Watch's counterpart. */
export function SceneLabels({ labelRefs, objects, byNorad, featuredNames, featuredNorads, selectedName }: Props) {
  const setSelected = useSelectionStore((s) => s.setSelected);
  const setHover = useSelectionStore((s) => s.setHover);
  const selectedNorad = useSelectionStore((s) => s.selectedNorad);
  const pinnedNorad = useSelectionStore(pinnedLabelNorad);
  const pinnedIndex = pinnedNorad === null ? undefined : byNorad[pinnedNorad];
  const pinnedName = pinnedIndex === undefined ? '' : (objects[pinnedIndex]?.name ?? '');
  return (
    <>
      {Array.from({ length: LABEL_SLOT_COUNT }, (_, k) => {
        const norad = k === SELECTION_SLOT ? selectedNorad : k === PIN_SLOT ? pinnedNorad : (featuredNorads[k] ?? null);
        const name = k === SELECTION_SLOT ? selectedName : k === PIN_SLOT ? pinnedName : (featuredNames[k] ?? '');
        return (
          <ObjectLabel
            key={k}
            ref={(l) => {
              labelRefs.current[k] = l;
            }}
            name={name}
            emphasised={norad !== null && norad === selectedNorad}
            // "Click any label" flies there (Reference - NASA Eyes §4.4);
            // hovering it is hovering the object.
            onSelect={norad === null ? undefined : () => setSelected(norad)}
            onHover={norad === null ? undefined : (hovered) => setHover(hovered ? norad : null)}
          />
        );
      })}
    </>
  );
}
