import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PanelErrorBoundary } from './PanelErrorBoundary.js';

function Bomb(): never {
  throw new Error('boom');
}

describe('PanelErrorBoundary', () => {
  beforeEach(() => {
    // React logs the caught error to console.error itself (in addition to
    // componentDidCatch) — expected noise for this test, not something to
    // assert on.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    render(
      <PanelErrorBoundary label="Test panel">
        <p>fine</p>
      </PanelErrorBoundary>,
    );

    expect(screen.getByText('fine')).toBeTruthy();
  });

  it('renders a fallback instead of crashing when a child throws', () => {
    render(
      <PanelErrorBoundary label="Camera panel">
        <Bomb />
      </PanelErrorBoundary>,
    );

    expect(screen.getByText('Camera panel hit an error.')).toBeTruthy();
    expect(screen.queryByText('fine')).toBeNull();
  });
});
