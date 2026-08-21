import { useState } from 'react';
import { GlassSurface } from '../../ui/GlassSurface.js';
import { SearchPanel } from '../../ui/SearchPanel.js';

const ITEMS = [
  { id: '25544', name: 'ISS (ZARYA)', noradId: '25544' },
  { id: '20580', name: 'Hubble Space Telescope', noradId: '20580' },
  { id: '24946', name: 'Iridium 33', noradId: '24946' },
  { id: '22675', name: 'Cosmos 2251', noradId: '22675' },
];

/** SearchPanel (Design.md §6) — press "/" anywhere on the page to focus it. */
export function SearchSection() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <section className="design-section" aria-labelledby="search-heading">
      <h2 id="search-heading">Search</h2>
      <GlassSurface variant="floating" elevation={2} className="design-card">
        <h3>SearchPanel</h3>
        <SearchPanel items={ITEMS} onSelect={setSelected} />
        {selected && <p className="design-note">Selected: {selected}</p>}
      </GlassSurface>
    </section>
  );
}
