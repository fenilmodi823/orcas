import { describe, expect, it } from 'vitest';
import { encodeViewState, parseViewState } from './view-url.js';

const T = Date.UTC(2026, 9, 5, 0, 0, 0);

describe('encodeViewState (S1: time, rate and selection in the URL, as NASA Eyes does)', () => {
  it('writes a readable UTC time, the signed rate and the selected object', () => {
    const search = encodeViewState(new URLSearchParams(), { epochMs: T, rate: -3600, playing: true, selected: '25544' });
    expect(search.get('t')).toBe('2026-10-05T00:00:00Z');
    expect(search.get('rate')).toBe('-3600');
    expect(search.get('object')).toBe('25544');
  });

  it('writes rate 0 while paused, as NASA Eyes does', () => {
    expect(encodeViewState(new URLSearchParams(), { epochMs: T, rate: 3, playing: false, selected: null }).get('rate')).toBe('0');
  });

  it('leaves time and rate out when live, so the link opens the present', () => {
    const search = encodeViewState(new URLSearchParams('t=x&rate=9'), { epochMs: null, rate: 1, playing: true, selected: null });
    expect(search.has('t')).toBe(false);
    expect(search.has('rate')).toBe(false);
    expect(search.has('object')).toBe(false);
  });

  it('keeps unrelated parameters', () => {
    expect(encodeViewState(new URLSearchParams('perf=1'), { epochMs: null, rate: 1, playing: true, selected: null }).get('perf')).toBe('1');
  });
});

describe('parseViewState', () => {
  it('reads back what encodeViewState writes', () => {
    const view = parseViewState(new URLSearchParams('t=2026-10-05T00:00:00Z&rate=-3600&object=25544'));
    expect(view).toEqual({ epochMs: T, rate: -3600, paused: false, selected: '25544' });
  });

  it('reads rate 0 as paused', () => {
    expect(parseViewState(new URLSearchParams('rate=0')).paused).toBe(true);
  });

  it('ignores what it cannot trust instead of guessing', () => {
    const view = parseViewState(new URLSearchParams('t=yesterday&rate=7&object=..%2F'));
    expect(view).toEqual({ epochMs: null, rate: null, paused: false, selected: null });
  });

  it('reads a body, as NASA Eyes’ #/jupiter, and nothing that merely looks like one (S5a)', () => {
    expect(parseViewState(new URLSearchParams('object=jupiter')).selected).toBe('jupiter');
    expect(parseViewState(new URLSearchParams('object=pluto')).selected).toBeNull();
    expect(parseViewState(new URLSearchParams('object=Jupiter')).selected).toBeNull();
  });
});
