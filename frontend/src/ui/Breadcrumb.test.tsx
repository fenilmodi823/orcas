import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Breadcrumb } from './Breadcrumb.js';

describe('Breadcrumb', () => {
  it('makes every crumb but the last a button, and marks the last as where you are', () => {
    const home = vi.fn();
    const earth = vi.fn();
    render(<Breadcrumb crumbs={[{ label: 'Solar System', onSelect: home }, { label: 'Earth', onSelect: earth }, { label: 'Moon' }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Solar System' }));
    fireEvent.click(screen.getByRole('button', { name: 'Earth' }));
    expect(home).toHaveBeenCalledOnce();
    expect(earth).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Moon' })).toBeNull();
    expect(screen.getByText('Moon').getAttribute('aria-current')).toBe('location');
  });

  it('keeps a lone root clickable: it is the way home', () => {
    const home = vi.fn();
    render(<Breadcrumb crumbs={[{ label: 'Solar System', onSelect: home }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Solar System' }));
    expect(home).toHaveBeenCalledOnce();
  });
});
