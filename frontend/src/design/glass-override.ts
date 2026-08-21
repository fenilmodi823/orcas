export interface GlassOverride {
  fillAlpha: number;
  blurPx: number;
  saturatePercent: number;
}

export const DEFAULT_GLASS_OVERRIDE: GlassOverride = { fillAlpha: 45, blurPx: 30, saturatePercent: 200 };
