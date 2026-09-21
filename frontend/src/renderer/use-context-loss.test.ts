import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContextLoss } from './use-context-loss.js';

function makeCanvas() {
  return document.createElement('canvas');
}

function dispatchLoss(canvas: HTMLCanvasElement) {
  // cancelable: true is what makes preventDefault() meaningful here.
  const event = new Event('webglcontextlost', { cancelable: true });
  canvas.dispatchEvent(event);
  return event;
}

describe('useContextLoss', () => {
  it('starts clean', () => {
    const { result } = renderHook(() => useContextLoss(makeCanvas()));

    expect(result.current).toEqual({ lost: false, everLost: false });
  });

  it('calls preventDefault on loss, without which the browser never restores', () => {
    const canvas = makeCanvas();
    renderHook(() => useContextLoss(canvas));

    let event!: Event;
    act(() => {
      event = dispatchLoss(canvas);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  it('reports the loss so the UI can say something instead of going black', () => {
    const canvas = makeCanvas();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useContextLoss(canvas));

    act(() => {
      dispatchLoss(canvas);
    });

    expect(result.current.lost).toBe(true);
  });

  it('clears on restore but remembers that a loss happened', () => {
    const canvas = makeCanvas();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useContextLoss(canvas));

    act(() => {
      dispatchLoss(canvas);
    });
    act(() => {
      canvas.dispatchEvent(new Event('webglcontextrestored'));
    });

    expect(result.current).toEqual({ lost: false, everLost: true });
  });

  it('tolerates a null canvas before the ref attaches', () => {
    expect(() => renderHook(() => useContextLoss(null))).not.toThrow();
  });

  it('detaches its listeners on unmount', () => {
    const canvas = makeCanvas();
    const remove = vi.spyOn(canvas, 'removeEventListener');
    const { unmount } = renderHook(() => useContextLoss(canvas));

    unmount();

    expect(remove).toHaveBeenCalledWith('webglcontextlost', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('webglcontextrestored', expect.any(Function));
  });
});
