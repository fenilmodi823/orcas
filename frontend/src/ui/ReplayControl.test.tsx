import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReplayControl, type ReplayHandle } from './ReplayControl.js';

const handle = (atMs: number | null): ReplayHandle => ({
  atMs, error: null, start: () => Promise.resolve(true), end: () => undefined,
});

afterEach(() => vi.unstubAllEnvs());

describe('ReplayControl on the static site', () => {
  it('replaces the form with the local-only line and a repository link', () => {
    vi.stubEnv('VITE_DATA_MODE', 'static');
    render(<ReplayControl replay={handle(null)} />);

    expect(screen.queryByRole('button', { name: 'Replay' })).toBeNull();
    expect(screen.getByText(/Replays of other days run in the local version/)).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('https://github.com/fenilmodi823/orcas');
  });

  it('while replaying offers Back to the present', () => {
    vi.stubEnv('VITE_DATA_MODE', 'static');
    render(<ReplayControl replay={handle(Date.parse('2026-10-20T00:00:00Z'))} />);

    expect(screen.getByRole('button', { name: 'Back to the present' })).toBeTruthy();
  });
});

describe('ReplayControl locally', () => {
  it('keeps the Replay form', () => {
    render(<ReplayControl replay={handle(null)} />);
    expect(screen.getByRole('button', { name: 'Replay' })).toBeTruthy();
  });

  it('keeps Back to live while replaying', () => {
    render(<ReplayControl replay={handle(Date.parse('2026-10-20T00:00:00Z'))} />);
    expect(screen.getByRole('button', { name: 'Back to live' })).toBeTruthy();
  });
});
