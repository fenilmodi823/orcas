import { render } from '@testing-library/react';
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

  it('renders the interactive attribute when specified', () => {
    const { container } = render(<GlassSurface variant="modal" interactive />);
    const surface = container.firstElementChild as HTMLElement;

    expect(surface.dataset.interactive).toBe('');
  });

  it('draws no cursor-tracked highlight (Stage B §5.2)', () => {
    const { container } = render(<GlassSurface interactive variant="floating">x</GlassSurface>);
    expect(container.querySelector('.glass-surface__highlight')).toBeNull();
  });
});
