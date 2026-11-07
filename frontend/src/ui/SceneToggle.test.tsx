import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useCameraStatus } from '../renderer/camera/camera-status.js';
import { SceneToggle } from './SceneToggle.js';

afterEach(() => useCameraStatus.getState().setScene('earth'));

describe('SceneToggle (Q44)', () => {
  it('offers the Solar System at the Earth, and asks for it', () => {
    render(<SceneToggle />);
    const before = useCameraStatus.getState().homeRequests;
    fireEvent.click(screen.getByRole('button', { name: 'Solar System' }));
    expect(useCameraStatus.getState().homeRequests).toBe(before + 1);
  });
  it('offers the Earth out there, and asks for it', () => {
    useCameraStatus.getState().setScene('solar');
    render(<SceneToggle />);
    const before = useCameraStatus.getState().earthRequests;
    fireEvent.click(screen.getByRole('button', { name: 'Earth' }));
    expect(useCameraStatus.getState().earthRequests).toBe(before + 1);
  });
});
