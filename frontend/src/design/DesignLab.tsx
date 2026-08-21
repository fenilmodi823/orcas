import { useMemo, useState, type CSSProperties } from 'react';
import { Canvas } from '@react-three/fiber';
import { DesignLabBackdrop } from './DesignLabBackdrop.js';
import { ControlStrip } from './ControlStrip.js';
import { DEFAULT_GLASS_OVERRIDE, type GlassOverride } from './glass-override.js';
import { readGlassFillRgb } from './css-token-utils.js';
import { AtomsSection } from './sections/AtomsSection.js';
import { SearchSection } from './sections/SearchSection.js';
import { TetherSection } from './sections/TetherSection.js';
import { TimeDockSection } from './sections/TimeDockSection.js';
import './DesignLab.css';

/**
 * The component inventory (Design.md §6, decision D10). Every component
 * renders over a LIVE rotating Earth with moving objects — the only
 * condition they ever exist in — not a screenshot or a flat background.
 */
export function DesignLab() {
  const [nightSide, setNightSide] = useState(false);
  const [glass, setGlass] = useState<GlassOverride>(DEFAULT_GLASS_OVERRIDE);
  const [fillR, fillG, fillB] = useMemo(() => readGlassFillRgb(), []);

  const overrideStyle = {
    '--glass-fill': `rgba(${fillR}, ${fillG}, ${fillB}, ${glass.fillAlpha / 100})`,
    '--glass-blur': `${glass.blurPx}px`,
    '--glass-saturate': `${glass.saturatePercent}%`,
  } as CSSProperties;

  return (
    <div className="design-lab" data-night={nightSide ? '' : undefined} style={overrideStyle}>
      <Canvas className="design-lab__canvas" camera={{ position: [0, 0, 4] }} dpr={[1, 2]}>
        <DesignLabBackdrop nightSide={nightSide} />
      </Canvas>

      <ControlStrip value={glass} onChange={setGlass} />

      <button type="button" className="design-lab__lighting-toggle" onClick={() => setNightSide((v) => !v)}>
        Backdrop: {nightSide ? 'night side' : 'daylit limb'} — toggle
      </button>

      <main className="design-lab__content">
        <header className="design-lab__header">
          <h1>ORCAS — component inventory</h1>
          <p className="design-note">
            Phase 3.2 · Design.md §6 · every component below is live, over the real scene primitives, never a
            screenshot.
          </p>
        </header>
        <AtomsSection />
        <TimeDockSection />
        <SearchSection />
        <TetherSection />
      </main>
    </div>
  );
}
