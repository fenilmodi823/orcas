import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchPanel } from './SearchPanel.js';

const ITEMS = [
  { id: '1', name: 'ISS (ZARYA)', noradId: '25544' },
  { id: '2', name: 'Hubble Space Telescope', noradId: '20580' },
  { id: '3', name: 'Iridium 33', noradId: '24946' },
];

describe('SearchPanel', () => {
  it('lists every item until a query narrows it down by fuzzy match', () => {
    render(<SearchPanel items={ITEMS} onSelect={vi.fn()} />);

    expect(screen.getAllByRole('option')).toHaveLength(3);

    fireEvent.change(screen.getByLabelText('Search objects'), { target: { value: 'hst' } });

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByText('Hubble Space Telescope')).toBeTruthy();
  });

  it('selects the active result on Enter', () => {
    const onSelect = vi.fn();
    render(<SearchPanel items={ITEMS} onSelect={onSelect} />);
    const input = screen.getByLabelText('Search objects');

    fireEvent.change(input, { target: { value: 'iridium' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith('3');
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<SearchPanel items={ITEMS} onSelect={vi.fn()} onClose={onClose} />);

    fireEvent.keyDown(screen.getByLabelText('Search objects'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('focuses the input when "/" is pressed anywhere on the page', () => {
    render(<SearchPanel items={ITEMS} onSelect={vi.fn()} />);
    const input = screen.getByLabelText('Search objects') as HTMLInputElement;

    fireEvent.keyDown(window, { key: '/' });

    expect(document.activeElement).toBe(input);
  });
});
