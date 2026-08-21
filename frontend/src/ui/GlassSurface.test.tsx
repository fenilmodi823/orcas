import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GlassSurface } from './GlassSurface.js';

describe('GlassSurface', () => {
  it('renders its variant and elevation as data attributes', () => {
    const { container } = render(<GlassSurface variant="floating" elevation={3} />);
    const surface = container.firstElementChild as HTMLElement;

    expect(surface.dataset.variant).toBe('floating');
    expect(surface.dataset.elevation).toBe('3');
  });

  it('omits the specular highlight when not interactive', () => {
    const { container } = render(<GlassSurface variant="docked" />);

    expect(container.querySelector('.glass-surface__highlight')).toBeNull();
  });

  it('tracks the pointer via a DOM custom property, not React state, when interactive', () => {
    const { container } = render(<GlassSurface variant="modal" interactive />);
    const surface = container.firstElementChild as HTMLElement;
    surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;

    fireEvent.pointerMove(surface, { clientX: 100, clientY: 25 });

    expect(surface.style.getPropertyValue('--mx')).toBe('50%');
    expect(surface.style.getPropertyValue('--my')).toBe('25%');
    expect(container.querySelector('.glass-surface__highlight')).not.toBeNull();
  });
});
