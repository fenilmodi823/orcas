import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingSequence } from './LandingSequence.js';
import { resetLandingSequenceForTests } from './landing-timeline.js';

function mockReducedMotion(matches: boolean) {
  window.matchMedia = (query: string) =>
    ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

beforeEach(() => {
  resetLandingSequenceForTests();
  mockReducedMotion(false);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LandingSequence', () => {
  it('shows the skip control immediately, unanimated, from the first frame', () => {
    render(<LandingSequence />);

    const skip = screen.getByRole('button', { name: 'Skip intro animation' });
    expect(skip.hasAttribute('data-dismissed')).toBe(false);
  });

  it('skip jumps straight to done and calls onDone', () => {
    const onDone = vi.fn();
    render(<LandingSequence onDone={onDone} />);

    fireEvent.click(screen.getByRole('button', { name: 'Skip intro animation' }));

    expect(onDone).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Skip intro animation' }).hasAttribute('data-dismissed')).toBe(true);
  });

  it('runs the full storyboard to done within 4s and never beyond it', () => {
    const onDone = vi.fn();
    const { container } = render(<LandingSequence onDone={onDone} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.dataset.phase).toBe('point');
    act(() => vi.advanceTimersByTime(2000));
    expect(root.dataset.phase).toBe('hold');
    expect(onDone).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1600)); // total 3600ms
    expect(root.dataset.phase).toBe('done');
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('prefers-reduced-motion renders no backdrop or skip control and finishes in ~300ms', () => {
    mockReducedMotion(true);
    const onDone = vi.fn();
    render(<LandingSequence onDone={onDone} />);

    expect(screen.queryByRole('button', { name: 'Skip intro animation' })).toBeNull();
    expect(onDone).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('does not replay once this session has already played it', () => {
    mockReducedMotion(true);
    const first = vi.fn();
    render(<LandingSequence onDone={first} />);
    act(() => vi.advanceTimersByTime(300));
    expect(first).toHaveBeenCalledOnce();

    const second = vi.fn();
    render(<LandingSequence onDone={second} />);

    expect(screen.queryByRole('button', { name: 'Skip intro animation' })).toBeNull();
    expect(second).toHaveBeenCalledOnce();
  });
});
