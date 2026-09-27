import { describe, expect, it } from 'vitest';
import { parseConjunction } from './conjunction-client.js';

const party = (norad: string) => ({ norad_id: norad, name: `OBJ ${norad}`, object_type: 'PAYLOAD', element_set_epoch: '2026-09-27T01:00:00+00:00' });
const raw = {
  tca: '2026-09-27T18:00:00+00:00',
  miss_distance_km: 0.698,
  relative_speed_km_s: 11.647,
  maximum_pc: 9.06e-4,
  pc_method: 'closed_form',
  aspect_ratio: 3,
  hard_body_radius_km: 0.02,
  dilution_sigma_km: 0.285,
  valid_2d: true,
  validity_reason: null,
  encounter_duration_s: 0.25,
  method: 'Upper bound over uncertainty ellipses of 3:1 aspect ratio (Alfano 2005).',
  primary: party('24946'),
  secondary: party('22675'),
};

describe('parseConjunction — the trust boundary', () => {
  it('accepts a well-formed item', () => {
    expect(parseConjunction(raw)?.maximumPc).toBe(9.06e-4);
  });

  it('rejects a number where the 2D model does not apply', () => {
    expect(parseConjunction({ ...raw, valid_2d: false, validity_reason: 'too slow' })).toBeUndefined();
  });

  it('rejects an item missing the aspect ratio a maximum is meaningless without', () => {
    const withoutFamily: Record<string, unknown> = { ...raw };
    delete withoutFamily.aspect_ratio;
    expect(parseConjunction(withoutFamily)).toBeUndefined();
  });

  it('rejects an unparseable TCA', () => {
    expect(parseConjunction({ ...raw, tca: 'not a time' })).toBeUndefined();
  });
});
