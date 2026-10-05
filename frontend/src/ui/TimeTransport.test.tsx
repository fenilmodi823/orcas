import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimeTransport } from './TimeTransport.js';

describe('TimeTransport', () => {
  it('shows play when paused and calls onTogglePlay', () => {
    const onTogglePlay = vi.fn();
    render(
      <TimeTransport
        playing={false}
        rate={1}
        currentTime={new Date('2009-02-10T16:56:00Z')}
        expanded={false}
        onTogglePlay={onTogglePlay}
        onStepRate={vi.fn()}
        onSetTime={vi.fn()}
        onJumpToNow={vi.fn()}
        onToggleExpanded={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Play'));
    expect(onTogglePlay).toHaveBeenCalledOnce();
    // Dated (a bare time of day after a jump reads as today) and in UTC,
    // written out (A.11).
    expect(screen.getByText('2009-02-10 16:56:00 UTC')).toBeTruthy();
  });

  it('steps the rate with ◀◀ and ▶▶, labelled as NASA Eyes labels it, and jumps to now', () => {
    const onStepRate = vi.fn();
    const onJumpToNow = vi.fn();
    render(
      <TimeTransport
        playing
        rate={10}
        currentTime={new Date()}
        expanded
        onTogglePlay={vi.fn()}
        onStepRate={onStepRate}
        onSetTime={vi.fn()}
        onJumpToNow={onJumpToNow}
        onToggleExpanded={vi.fn()}
      />,
    );

    expect(screen.getByText('10 SECS/S')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Faster' }));
    fireEvent.click(screen.getByRole('button', { name: 'Slower' }));
    fireEvent.click(screen.getByText('NOW'));

    expect(onStepRate.mock.calls).toEqual([[1], [-1]]);
    expect(onJumpToNow).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Collapse').getAttribute('aria-expanded')).toBe('true');
  });

  it('names real time, and signs a reverse rate', () => {
    const props = {
      playing: true,
      currentTime: new Date('2009-02-10T16:56:00Z'),
      expanded: false,
      onTogglePlay: vi.fn(),
      onStepRate: vi.fn(),
      onSetTime: vi.fn(),
      onJumpToNow: vi.fn(),
      onToggleExpanded: vi.fn(),
    };
    const { rerender } = render(<TimeTransport {...props} rate={1} />);
    expect(screen.getByText('REAL RATE')).toBeTruthy();
    rerender(<TimeTransport {...props} rate={-21_600} />);
    expect(screen.getByText('−6 HRS/S')).toBeTruthy();
  });
});
