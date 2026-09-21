import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusPill } from './StatusPill.js';

describe('StatusPill', () => {
  it('renders the UTC epoch with the fresh label by default', () => {
    render(<StatusPill epoch={new Date('2009-02-10T16:56:00Z')} />);

    expect(screen.getByText('epoch')).toBeTruthy();
    expect(screen.getByText('16:56:00Z')).toBeTruthy();
  });

  it('switches to the stale label and drops the live-pulse state when data is old', () => {
    const { container } = render(<StatusPill epoch={new Date('2009-02-10T16:56:00Z')} stale />);

    expect(screen.getByText('stale')).toBeTruthy();
    expect(container.firstElementChild?.hasAttribute('data-stale')).toBe(true);
  });

  it('adds the date when the epoch is not on the same UTC day as now', () => {
    // A bare time of day reads as "today" - for an old epoch that presents
    // stale data as live.
    render(<StatusPill epoch={new Date('2026-09-17T14:50:11Z')} nowMs={Date.parse('2026-09-20T09:00:00Z')} />);

    expect(screen.getByText('2026-09-17 14:50:11Z')).toBeTruthy();
  });

  it('keeps the compact time-only form when the epoch is today', () => {
    render(<StatusPill epoch={new Date('2026-09-20T06:22:00Z')} nowMs={Date.parse('2026-09-20T09:00:00Z')} />);

    expect(screen.getByText('06:22:00Z')).toBeTruthy();
  });
});
