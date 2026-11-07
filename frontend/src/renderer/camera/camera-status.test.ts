import { describe, expect, it, vi } from 'vitest';
import { useCameraStatus } from './camera-status.js';

describe('camera status: scene', () => {
  it('starts at the Earth and writes only on change', () => {
    expect(useCameraStatus.getState().scene).toBe('earth');
    const listener = vi.fn();
    const off = useCameraStatus.subscribe(listener);
    useCameraStatus.getState().setScene('earth');
    expect(listener).not.toHaveBeenCalled();
    useCameraStatus.getState().setScene('solar');
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    useCameraStatus.getState().setScene('earth');
  });
});
