import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ObjectTether, type ObjectTetherHandle } from './ObjectTether.js';

describe('ObjectTether', () => {
  it('renders name, class and altitude', () => {
    render(<ObjectTether name="ISS (ZARYA)" orbitClass="leo" altitudeKm={419.0} />);

    expect(screen.getByText('ISS (ZARYA)')).toBeTruthy();
    expect(screen.getByText('LEO · 419.0 km')).toBeTruthy();
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
});
