import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CameraViews } from './CameraViews.js';

describe('CameraViews (S6b)', () => {
  it('shows each view, presses the current one, and asks for one on click', () => {
    const onSelect = vi.fn();
    render(<CameraViews options={[{ id: 'nearby', label: 'Nearby' }, { id: 'system', label: 'System' }]} active="nearby" onSelect={onSelect} />);
    expect(screen.getByRole('group', { name: 'Camera view' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nearby' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'System' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'System' }));
    expect(onSelect).toHaveBeenCalledWith('system');
  });
});
