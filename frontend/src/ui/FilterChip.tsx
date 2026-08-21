import type { CSSProperties } from 'react';
import type { OrbitClass } from '../state/selection-store.js';
import './FilterChip.css';

const ORBIT_CLASS_VAR: Record<OrbitClass, string> = {
  leo: 'var(--leo)',
  meo: 'var(--meo)',
  geo: 'var(--geo)',
  heo: 'var(--heo)',
  debris: 'var(--debris)',
};

export interface FilterChipProps {
  orbitClass: OrbitClass;
  label: string;
  count: number;
  active?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
}

/** Orbit-class swatch, label, live result count (Design.md §6). */
export function FilterChip({ orbitClass, label, count, active = false, disabled = false, onToggle }: FilterChipProps) {
  const style = { '--filter-chip-colour': ORBIT_CLASS_VAR[orbitClass] } as CSSProperties;

  return (
    <button
      type="button"
      className="filter-chip"
      data-active={active ? '' : undefined}
      disabled={disabled}
      style={style}
      onClick={onToggle}
      aria-pressed={active}
    >
      <span className="filter-chip__swatch" aria-hidden />
      <span className="filter-chip__label">{label}</span>
      <span className="filter-chip__count">{count}</span>
    </button>
  );
}
