import { useEffect, useRef } from 'react';
import { GlassSurface } from '../../ui/GlassSurface.js';
import { ObjectTether, type ObjectTetherHandle } from '../../ui/ObjectTether.js';

/**
 * ObjectTether (Design.md §6) — position is driven imperatively every
 * frame, exactly as it will be from a real projected 3D point in the
 * scene. This loop stands in for that projection.
 */
export function TetherSection() {
  const tetherRef = useRef<ObjectTetherHandle>(null);

  useEffect(() => {
    let raf: number;
    const start = performance.now();
    tetherRef.current?.setVisible(true);

    function tick(now: number) {
      const t = (now - start) / 1000;
      const x = 120 + Math.cos(t * 0.6) * 90;
      const y = 90 + Math.sin(t * 0.6) * 40;
      tetherRef.current?.setPosition(x, y);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section className="design-section" aria-labelledby="tether-heading">
      <h2 id="tether-heading">Tether</h2>
      <GlassSurface variant="floating" elevation={2} className="design-card design-card--tether">
        <h3>ObjectTether</h3>
        <p className="design-note">Position updates via a ref every frame — never React state.</p>
        <div className="design-tether-stage">
          <ObjectTether ref={tetherRef} name="ISS (ZARYA)" orbitClass="leo" altitudeKm={419.0} />
        </div>
      </GlassSurface>
    </section>
  );
}
