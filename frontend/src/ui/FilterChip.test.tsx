import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterChip } from './FilterChip.js';

describe('FilterChip', () => {
  it('renders the label and live count, and toggles on click', () => {
    const onToggle = vi.fn();
    render(<FilterChip orbitClass="leo" label="LEO" count={612} onToggle={onToggle} />);

    expect(screen.getByText('LEO')).toBeTruthy();
    expect(screen.getByText('612')).toBeTruthy();

    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('reflects the active state via aria-pressed', () => {
    render(<FilterChip orbitClass="geo" label="GEO" count={4} active />);

    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  });
});
