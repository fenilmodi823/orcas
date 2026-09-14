import type { CSSProperties } from 'react';
import type { FilterClass } from '../state/selection-store.js';
import './FilterChip.css';

const FILTER_CLASS_VAR: Record<FilterClass, string> = {
  leo: 'var(--leo)',
  meo: 'var(--meo)',
  geo: 'var(--geo)',
  heo: 'var(--heo)',
  debris: 'var(--debris)',
};

export interface FilterChipProps {
  orbitClass: FilterClass;
  label: string;
  count: number;
  active?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
}

/** Orbit-class swatch, label, live result count (Design.md §6). */
export function FilterChip({ orbitClass, label, count, active = false, disabled = false, onToggle }: FilterChipProps) {
  const style = { '--filter-chip-colour': FILTER_CLASS_VAR[orbitClass] } as CSSProperties;

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
