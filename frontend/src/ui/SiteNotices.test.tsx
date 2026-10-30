import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetSiteMode, setDataAsOf } from '../data/site-mode.js';
import { SiteNotices } from './SiteNotices.js';

const AS_OF = Date.parse('2026-10-27T06:29:07Z');
const DAY = 86_400_000;

afterEach(() => {
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
