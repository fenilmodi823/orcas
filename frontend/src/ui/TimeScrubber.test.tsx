import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimeScrubber } from './TimeScrubber.js';

describe('TimeScrubber', () => {
  it('positions the handle proportionally within the time range', () => {
    render(
      <TimeScrubber
        currentTime={new Date('2009-02-10T12:00:00Z')}
        rangeStart={new Date('2009-02-10T00:00:00Z')}
        rangeEnd={new Date('2009-02-11T00:00:00Z')}
        onScrub={vi.fn()}
      />,
    );

    const track = screen.getByLabelText('Scrub simulation time') as HTMLInputElement;
    expect(track.value).toBe('500');
  });

  it('renders one marker per conjunction event, positioned by percent', () => {
    const { container } = render(
      <TimeScrubber
        currentTime={new Date('2009-02-10T00:00:00Z')}
        rangeStart={new Date('2009-02-10T00:00:00Z')}
        rangeEnd={new Date('2009-02-11T00:00:00Z')}
        conjunctionMarkers={[new Date('2009-02-10T16:56:00Z')]}
        onScrub={vi.fn()}
      />,
    );

    const markers = container.querySelectorAll('.time-scrubber__marker');
    expect(markers).toHaveLength(1);
    expect((markers[0] as HTMLElement).style.left).toBe(`${(16 * 60 + 56) / (24 * 60) * 100}%`);
  });

  it('reports the scrubbed time on change', () => {
    const onScrub = vi.fn();
    render(
      <TimeScrubber
        currentTime={new Date('2009-02-10T00:00:00Z')}
        rangeStart={new Date('2009-02-10T00:00:00Z')}
        rangeEnd={new Date('2009-02-11T00:00:00Z')}
        onScrub={onScrub}
      />,
    );

    fireEvent.change(screen.getByLabelText('Scrub simulation time'), { target: { value: '250' } });

    expect(onScrub).toHaveBeenCalledWith(new Date('2009-02-10T06:00:00Z'));
  });
});
