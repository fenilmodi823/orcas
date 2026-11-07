import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OrbitClassLegend } from './OrbitClassLegend.js';

describe('OrbitClassLegend', () => {
  it('says the markers are not to scale', () => {
    render(<OrbitClassLegend />);
    expect(screen.getByText('Markers are not to scale.')).toBeTruthy();
  });
});
