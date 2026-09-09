import { describe, expect, it } from 'vitest';
import { classifyRenderer, detectDeviceTier } from './device-tier.js';

describe('classifyRenderer', () => {
  const cases: ReadonlyArray<readonly [string, 'A' | 'B' | 'C']> = [
    ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3060, D3D11)', 'A'],
    ['ANGLE (NVIDIA GeForce GTX 1660 Ti Direct3D11 vs_5_0 ps_5_0)', 'A'],
    ['ANGLE (AMD, AMD Radeon RX 6600 (0x000073FF), D3D11)', 'A'],
    ['Apple M1 Pro', 'B'],
    ['Apple M2 GPU', 'B'],
    ['ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Max, Unspecified)', 'B'],
    ['ANGLE (AMD, AMD Radeon(TM) 610M (0x00001681), D3D11)', 'C'],
    ['ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49), D3D11)', 'C'],
    ['ANGLE (Intel, Intel(R) UHD Graphics 620, D3D11)', 'C'],
    ['AMD Radeon(TM) Vega 8 Graphics', 'C'],
    ['llvmpipe (LLVM 15.0.7, 256 bits)', 'C'],
    ['', 'C'],
    ['Mali-G78', 'C'],
    ['Adreno (TM) 660', 'C'],
  ];

  it.each(cases)('classifies %j as tier %s', (input, expected) => {
    expect(classifyRenderer(input)).toBe(expected);
  });

  it('matches case-insensitively', () => {
    expect(classifyRenderer('nvidia geforce rtx 4090')).toBe('A');
    expect(classifyRenderer('APPLE M2 GPU')).toBe('B');
  });

  it('lets radeon rx claim Tier A before a bare radeon substring reads as iGPU', () => {
    expect(classifyRenderer('AMD Radeon RX 7900 XTX')).toBe('A');
  });
});

describe('detectDeviceTier', () => {
  it('returns a valid tier without throwing (jsdom has no WebGL2 → C)', () => {
    const tier = detectDeviceTier();
    expect(['A', 'B', 'C']).toContain(tier);
    expect(tier).toBe('C');
  });

  it('is memoised — repeat calls return the same value', () => {
    expect(detectDeviceTier()).toBe(detectDeviceTier());
  });
});
