import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ObjectTether, type ObjectTetherHandle } from './ObjectTether.js';

const meta = (container: HTMLElement) => container.querySelector('.object-tether__meta')?.textContent;

describe('ObjectTether', () => {
  it('renders name, class and altitude', () => {
    const { container } = render(<ObjectTether name="ISS (ZARYA)" orbitClass="leo" altitudeKm={419.0} />);

    expect(screen.getByText('ISS (ZARYA)')).toBeTruthy();
    expect(meta(container)).toBe('LEO · 419.0 km');
  });

  it('positions itself imperatively via the DOM, not a re-render', () => {
    const ref = createRef<ObjectTetherHandle>();
    const { container } = render(<ObjectTether ref={ref} name="Hubble" orbitClass="leo" altitudeKm={540} />);
    const root = container.firstElementChild as HTMLElement;

    ref.current?.setPosition(120, 60);
    ref.current?.setVisible(true);

    expect(root.style.transform).toBe('translate(120px, 60px)');
    expect(root.style.opacity).toBe('1');
  });

  it('updates its altitude imperatively, and a re-render does not undo it', () => {
    const ref = createRef<ObjectTetherHandle>();
    const { container, rerender } = render(<ObjectTether ref={ref} name="Hubble" orbitClass="leo" altitudeKm={540} />);

    ref.current?.setAltitude(512.34);
    expect(meta(container)).toBe('LEO · 512.3 km');

    rerender(<ObjectTether ref={ref} name="Hubble" orbitClass="leo" altitudeKm={540} />);
    expect(meta(container)).toBe('LEO · 512.3 km');
  });
});
