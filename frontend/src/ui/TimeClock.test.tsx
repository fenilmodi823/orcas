import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimeClock } from './TimeClock.js';

const NOW = new Date(Date.UTC(2026, 9, 3, 13, 11, 46));

describe('TimeClock', () => {
  it('shows the simulated time with its zone spelled out (A.11)', () => {
    render(<TimeClock time={NOW} onSetTime={vi.fn()} />);
    expect(screen.getByRole('button', { name: /2026-10-03 13:11:46 UTC/ })).toBeTruthy();
  });

  it('opens a UTC field on click and jumps to a typed time on Enter', () => {
    const onSetTime = vi.fn();
    render(<TimeClock time={NOW} onSetTime={onSetTime} />);

    fireEvent.click(screen.getByRole('button', { name: /2026-10-03 13:11:46 UTC/ }));
    const input = screen.getByLabelText('Go to time (UTC)') as HTMLInputElement;
    expect(input.value).toBe('2026-10-03 13:11:46');

    fireEvent.change(input, { target: { value: '2026-10-05 00:00' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSetTime).toHaveBeenCalledWith(Date.UTC(2026, 9, 5));
    expect(screen.queryByLabelText('Go to time (UTC)')).toBeNull();
  });

  it('explains the format instead of guessing at what it cannot read', () => {
    const onSetTime = vi.fn();
    render(<TimeClock time={NOW} onSetTime={onSetTime} />);

    fireEvent.click(screen.getByRole('button', { name: /UTC/ }));
    const input = screen.getByLabelText('Go to time (UTC)');
    fireEvent.change(input, { target: { value: 'next tuesday' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSetTime).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/YYYY-MM-DD HH:MM:SS/);
  });

  it('cancels on Escape', () => {
    const onSetTime = vi.fn();
    render(<TimeClock time={NOW} onSetTime={onSetTime} />);

    fireEvent.click(screen.getByRole('button', { name: /UTC/ }));
    fireEvent.keyDown(screen.getByLabelText('Go to time (UTC)'), { key: 'Escape' });
    expect(screen.queryByLabelText('Go to time (UTC)')).toBeNull();
    expect(onSetTime).not.toHaveBeenCalled();
  });
});
