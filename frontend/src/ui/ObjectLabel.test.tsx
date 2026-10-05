import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ObjectLabel, type ObjectLabelHandle } from './ObjectLabel.js';

function rootOf(name: string): HTMLElement {
  return screen.getByText(name).closest('.object-label') as HTMLElement;
}

describe('ObjectLabel', () => {
  it('fades out slower than it fades in, as NASA Eyes does (0.75 s against 0.25 s)', () => {
    const ref = createRef<ObjectLabelHandle>();
    render(<ObjectLabel ref={ref} name="HST" />);

    ref.current!.setOpacity(1);
    expect(rootOf('HST').dataset.fadingOut).toBeUndefined();
    ref.current!.setOpacity(0);
    expect(rootOf('HST').dataset.fadingOut).toBe('');
    ref.current!.setOpacity(0.5);
    expect(rootOf('HST').dataset.fadingOut).toBeUndefined();
  });

  it('selects its object on click, without the click reaching the scene behind it', () => {
    const onSelect = vi.fn();
    const onScenePointerDown = vi.fn();
    const onScenePointerMove = vi.fn();
    const ref = createRef<ObjectLabelHandle>();
    render(
      <div onPointerDown={onScenePointerDown} onPointerMove={onScenePointerMove}>
        <ObjectLabel ref={ref} name="HST" onSelect={onSelect} />
      </div>,
    );
    ref.current!.setOpacity(1);

    const button = screen.getByRole('button', { name: 'Select HST' });
    fireEvent.pointerMove(button);
    fireEvent.pointerDown(button);
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onScenePointerDown).not.toHaveBeenCalled();
    // The scene's hover-picking would otherwise overwrite the label's hover.
    expect(onScenePointerMove).not.toHaveBeenCalled();
  });

  it('cannot be clicked while it is faded out', () => {
    const ref = createRef<ObjectLabelHandle>();
    render(<ObjectLabel ref={ref} name="HST" onSelect={vi.fn()} />);

    ref.current!.setOpacity(0);
    expect(rootOf('HST').dataset.hidden).toBe('');
    // ...and a screen reader does not announce a label nobody can see.
    expect(rootOf('HST').getAttribute('aria-hidden')).toBe('true');
    ref.current!.setOpacity(1);
    expect(rootOf('HST').dataset.hidden).toBeUndefined();
    expect(rootOf('HST').getAttribute('aria-hidden')).toBeNull();
  });

  it('reports hover so the object can be highlighted', () => {
    const onHover = vi.fn();
    const ref = createRef<ObjectLabelHandle>();
    render(<ObjectLabel ref={ref} name="HST" onSelect={vi.fn()} onHover={onHover} />);
    ref.current!.setOpacity(1); // a label is hoverable once the scene shows it

    const button = screen.getByRole('button', { name: 'Select HST' });
    fireEvent.pointerEnter(button);
    fireEvent.pointerLeave(button);
    expect(onHover.mock.calls).toEqual([[true], [false]]);
  });

  it('marks its tier and emphasis for styling', () => {
    render(
      <>
        <ObjectLabel name="Sun" tier="primary" />
        <ObjectLabel name="ISS (ZARYA)" emphasised />
      </>,
    );
    expect(rootOf('Sun').dataset.tier).toBe('primary');
    expect(rootOf('ISS (ZARYA)').dataset.tier).toBe('secondary');
    expect(rootOf('ISS (ZARYA)').dataset.emphasised).toBe('');
  });

  it('marks a computed point with its stability marker (RA5.D8)', () => {
    render(
      <>
        <ObjectLabel name="Sun–Earth L2" marker="saddle" />
        <ObjectLabel name="Earth–Moon L4" marker="stable" />
        <ObjectLabel name="HST" />
      </>,
    );
    expect(rootOf('Sun–Earth L2').dataset.marker).toBe('saddle');
    expect(rootOf('Earth–Moon L4').dataset.marker).toBe('stable');
    expect(rootOf('HST').dataset.marker).toBeUndefined();
  });
});
