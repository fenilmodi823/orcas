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
        onCycleRate={vi.fn()}
        onJumpToNow={vi.fn()}
        onToggleExpanded={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Play'));
    expect(onTogglePlay).toHaveBeenCalledOnce();
    // Dated: after scrubbing days away a bare time of day reads as today.
    expect(screen.getByText('2009-02-10 16:56:00Z')).toBeTruthy();
  });

  it('cycles the rate and jumps to now on click', () => {
    const onCycleRate = vi.fn();
    const onJumpToNow = vi.fn();
    render(
      <TimeTransport
        playing
        rate={10}
        currentTime={new Date()}
        expanded
        onTogglePlay={vi.fn()}
        onCycleRate={onCycleRate}
        onJumpToNow={onJumpToNow}
        onToggleExpanded={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('10×'));
    fireEvent.click(screen.getByText('NOW'));

    expect(onCycleRate).toHaveBeenCalledOnce();
    expect(onJumpToNow).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Collapse').getAttribute('aria-expanded')).toBe('true');
  });

  it('offers a direction toggle and signs the rate while reversed', () => {
    const onToggleDirection = vi.fn();
    render(
      <TimeTransport
        playing
        rate={10}
        currentTime={new Date('2009-02-10T16:56:00Z')}
        expanded={false}
        reversed
        onTogglePlay={vi.fn()}
        onCycleRate={vi.fn()}
        onJumpToNow={vi.fn()}
        onToggleExpanded={vi.fn()}
        onToggleDirection={onToggleDirection}
      />,
    );

    expect(screen.getByText('−10×')).toBeTruthy();
    const toggle = screen.getByRole('button', { name: 'Run time forwards' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(onToggleDirection).toHaveBeenCalledOnce();
  });
});

