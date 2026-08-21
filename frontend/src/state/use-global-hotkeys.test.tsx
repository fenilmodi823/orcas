import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGlobalHotkeys } from './use-global-hotkeys.js';
import { useSelectionStore } from './selection-store.js';
import { useSimulationStore } from './simulation-store.js';

function HotkeyProbe() {
  useGlobalHotkeys();
  return null;
}

const ISS = {
  id: '25544',
  name: 'ISS (ZARYA)',
  noradId: '25544',
  orbitClass: 'leo' as const,
  altitudeKm: 419,
  velocityKmS: 7.66,
  inclinationDeg: 51.6,
};

describe('useGlobalHotkeys', () => {
  it('Escape clears the current selection', () => {
    useSelectionStore.getState().select(ISS);
    render(<HotkeyProbe />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(useSelectionStore.getState().selected).toBeNull();
  });

  it('Space toggles playback', () => {
    useSimulationStore.getState().pause();
    render(<HotkeyProbe />);

    fireEvent.keyDown(window, { key: ' ' });
    expect(useSimulationStore.getState().playing).toBe(true);

    fireEvent.keyDown(window, { key: ' ' });
    expect(useSimulationStore.getState().playing).toBe(false);
  });

  it('does not toggle playback while typing in a field', () => {
    useSimulationStore.getState().pause();
    const { container } = render(
      <>
        <input aria-label="search" />
        <HotkeyProbe />
      </>,
    );
    const input = container.querySelector('input') as HTMLInputElement;
    input.focus();

    fireEvent.keyDown(input, { key: ' ' });

    expect(useSimulationStore.getState().playing).toBe(false);
  });
});
