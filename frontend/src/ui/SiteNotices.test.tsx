import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetSiteMode, setDataAsOf } from '../data/site-mode.js';
import { SiteNotices } from './SiteNotices.js';

const AS_OF = Date.parse('2026-10-27T06:29:07Z');
const DAY = 86_400_000;

const KEY = 'orcas.desktop-notice-dismissed';
const NOTE = 'Best experienced on a desktop browser';

function stubWidth(small: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: small, media: query }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  vi.unstubAllEnvs();
  resetSiteMode();
});

describe('SiteNotices', () => {
  it('renders nothing locally', () => {
    setDataAsOf(AS_OF);
    const { container } = render(<SiteNotices nowMs={AS_OF + 9 * DAY} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing on the static site inside the window', () => {
    vi.stubEnv('VITE_DATA_MODE', 'static');
    setDataAsOf(AS_OF);
    const { container } = render(<SiteNotices nowMs={AS_OF + DAY} />);
    expect(container.firstChild).toBeNull();
  });

  it('says what it shows once the window has passed', () => {
    vi.stubEnv('VITE_DATA_MODE', 'static');
    setDataAsOf(AS_OF);
    render(<SiteNotices nowMs={AS_OF + 9 * DAY} />);
    const note = screen.getByRole('status');
    expect(note.textContent).toBe(
      'Showing 2026-11-01 06:29:07 UTC — the latest moment this site’s orbit data covers (data as of 2026-10-27 06:29:07 UTC).',
    );
  });
});

describe('DesktopNotice', () => {
  it.each([['locally', ''], ['on the static site', 'static']])('shows on a small screen %s and dismisses', (_n, mode) => {
    if (mode) vi.stubEnv('VITE_DATA_MODE', mode);
    stubWidth(true);
    render(<SiteNotices nowMs={AS_OF} />);
    expect(screen.getByText(new RegExp(NOTE))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(new RegExp(NOTE))).toBeNull();
    expect(localStorage.getItem(KEY)).toBe('1');
  });

  it('never shows once dismissed', () => {
    stubWidth(true);
    localStorage.setItem(KEY, '1');
    render(<SiteNotices nowMs={AS_OF} />);
    expect(screen.queryByText(new RegExp(NOTE))).toBeNull();
  });

  it('still shows and dismisses for the session when storage throws', () => {
    stubWidth(true);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<SiteNotices nowMs={AS_OF} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(new RegExp(NOTE))).toBeNull();
  });

  it('never shows at desktop width', () => {
    stubWidth(false);
    render(<SiteNotices nowMs={AS_OF} />);
    expect(screen.queryByText(new RegExp(NOTE))).toBeNull();
  });
});
