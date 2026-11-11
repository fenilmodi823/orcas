import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ObjectLabel, type ObjectLabelHandle } from './ObjectLabel.js';
import { setChromeRect } from '../state/chrome-rects.js';

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

  it('marks a spacecraft with its hexagon marker', () => {
    render(<ObjectLabel name="Voyager 1" marker="spacecraft" />);
    expect(rootOf('Voyager 1').dataset.marker).toBe('spacecraft');
  });
});

const rect = (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h, toJSON: () => ({}) }) as DOMRectReadOnly;

it('hides itself under the chrome and comes back when clear (Review Focus 3)', () => {
  const ref = createRef<ObjectLabelHandle>();
  const { container } = render(<ObjectLabel ref={ref} name="HST" onSelect={() => {}} />);
  setChromeRect('t', rect(0, 0, 200, 200));
  ref.current?.setPosition(50, 50);
  expect(container.querySelector('.object-label')?.hasAttribute('data-under-chrome')).toBe(true);
  ref.current?.setPosition(500, 500);
  expect(container.querySelector('.object-label')?.hasAttribute('data-under-chrome')).toBe(false);
  setChromeRect('t', null);
});
