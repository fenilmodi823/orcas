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
});
