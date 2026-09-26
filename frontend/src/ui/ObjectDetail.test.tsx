import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ObjectDetail } from './ObjectDetail.js';
import type { DetailGroup } from './object-detail-model.js';

const GROUPS: readonly DetailGroup[] = [
  { id: 'identity', title: 'Identity', fields: [{ label: 'NORAD ID', value: '25544' }] },
  { id: 'orbit', title: 'Orbit', fields: [{ label: 'RAAN', value: 247.46, unit: '°', precision: 2 }] },
  {
    id: 'provenance',
    title: 'Provenance',
    fields: [{ label: 'Element-set epoch', value: '2009-02-10 16:56:00 UTC' }],
  },
];

describe('ObjectDetail', () => {
  it('renders each field group as its own titled block (brief §13.4.2)', () => {
    render(<ObjectDetail groups={GROUPS} />);

    for (const title of ['Identity', 'Orbit', 'Provenance']) {
      expect(screen.getByRole('region', { name: title })).toBeTruthy();
    }
    expect(screen.getByText('RAAN')).toBeTruthy();
  });

  it('shows the element-set epoch', () => {
    render(<ObjectDetail groups={GROUPS} />);

    expect(screen.getByText('2009-02-10 16:56:00 UTC')).toBeTruthy();
  });

  it('draws nothing for a group that is not there, rather than blanks', () => {
    render(<ObjectDetail groups={GROUPS} />);

    expect(screen.queryByRole('region', { name: 'Conjunction' })).toBeNull();
    expect(screen.queryByText('P_c')).toBeNull();
  });
});
