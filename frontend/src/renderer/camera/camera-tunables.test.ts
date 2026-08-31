import { describe, expect, it } from 'vitest';
import { CAMERA_TUNABLE_DEFAULTS, useCameraTunables } from './camera-tunables.js';
import { LOD_BAND_PX } from '../lod/lod-band.js';

describe('LOD band tunables', () => {
  it('defaults to the brief band, not to invented numbers', () => {
    expect(CAMERA_TUNABLE_DEFAULTS.lodLoPx).toBe(LOD_BAND_PX.loPx);
    expect(CAMERA_TUNABLE_DEFAULTS.lodHiPx).toBe(LOD_BAND_PX.hiPx);
  });

  it('resets back to the brief band', () => {
    useCameraTunables.setState({ lodLoPx: 0.01, lodHiPx: 0.02 });
    useCameraTunables.getState().reset();
    expect(useCameraTunables.getState().lodLoPx).toBe(LOD_BAND_PX.loPx);
    expect(useCameraTunables.getState().lodHiPx).toBe(LOD_BAND_PX.hiPx);
  });
});
