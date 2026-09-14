import { Circle, Diamond, Square, Triangle, X } from 'lucide-react';
import { GlassSurface } from './GlassSurface.js';
import { useViewStore } from '../state/view-store.js';
import './OrbitClassLegend.css';

const ROWS: readonly { readonly key: string; readonly label: string; readonly Icon: typeof Circle; readonly colorVar: string }[] = [
  { key: 'leo', label: 'LEO', Icon: Circle, colorVar: 'var(--leo)' },
  { key: 'meo', label: 'MEO', Icon: Diamond, colorVar: 'var(--meo)' },
  { key: 'geo', label: 'GEO', Icon: Square, colorVar: 'var(--geo)' },
  { key: 'heo', label: 'HEO', Icon: Triangle, colorVar: 'var(--heo)' },
  { key: 'debris', label: 'Debris', Icon: X, colorVar: 'var(--debris)' },
];

/**
 * The one persistent surface explaining the scene's object colours
 * (P4.D24, [[Reference - NASA Eyes and LeoLabs#2.3]]) — a shape *and* a
 * colour per orbit class, never colour alone, so it survives deuteranopia
 * (Design.md §9's own audit already covers these five hues).
 *
 * Static: no per-frame updates, colour comes straight from the CSS
 * tokens the scene itself reads (`path-orbit-class-tint.ts`), so the legend
 * can never drift from the live palette.
 *
 * The debris row previews the colour only — there is no live toggle to
 * carry yet (P4.D25 is blocked on the SATCAT ingest, `memory.md` Next
 * actions #2); it lands here once that toggle exists.
 */
export function OrbitClassLegend() {
  const dismissed = useViewStore((state) => state.orbitClassLegendDismissed);
  const toggle = useViewStore((state) => state.toggleOrbitClassLegend);

  if (dismissed) {
    return (
      <button type="button" className="orbit-class-legend-reopen" onClick={toggle} aria-label="Show orbit class legend">
        ▸
      </button>
    );
  }

  return (
    <GlassSurface variant="floating" elevation={2} className="orbit-class-legend">
      <button type="button" className="orbit-class-legend__dismiss" onClick={toggle} aria-label="Hide orbit class legend">
        ✕
      </button>
      <ul className="orbit-class-legend__list">
        {ROWS.map(({ key, label, Icon, colorVar }) => (
          <li key={key} className="orbit-class-legend__row">
            <Icon className="orbit-class-legend__icon" style={{ color: colorVar }} size={14} aria-hidden />
            <span className="orbit-class-legend__label">{label}</span>
          </li>
        ))}
      </ul>
    </GlassSurface>
  );
}
