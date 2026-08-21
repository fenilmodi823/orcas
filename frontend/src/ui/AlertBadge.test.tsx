import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AlertBadge } from './AlertBadge.js';

describe('AlertBadge', () => {
  it('renders an icon alongside the message text, not colour alone', () => {
    const { container } = render(<AlertBadge message="Conjunction predicted in 6h" />);

    expect(screen.getByText('Conjunction predicted in 6h')).toBeTruthy();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('announces itself to assistive tech via role="alert"', () => {
    render(<AlertBadge message="Critical P_c" />);

    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
