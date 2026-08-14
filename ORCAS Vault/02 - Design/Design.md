---
title: Design
type: design
updated: 2026-07-27
status: active
---

# Design

> ⚠️ **Rewritten 2026-07-27.** Design language moves to Apple **Liquid Glass**, applied to a full simulation UI rather than a desktop metaphor. NASA Eyes is the UX reference; the visual identity is entirely original.

**Related:** [[UI-Research]] · [[Branding]] · [[PRD]] · [[Architecture]]

---

## 1. Principle

**The simulation is the interface. Everything else floats above it and gets out of the way.**

NASA Eyes gets this right: the 3D scene owns the screen; controls are peripheral, translucent and recede until needed. We take that behaviour and give it an entirely different skin — Liquid Glass, not NASA's flat panels.

Three rules that follow:
1. **Chrome is minimal and dismissible.** Any panel that can be collapsed, can be.
2. **Glass sits over motion.** Every surface has a live 3D scene behind it, which is exactly the condition Liquid Glass is designed for.
3. **Data is legible before it is beautiful.** If a readout is hard to read against the scene, the surface gets more opaque. Never the reverse.

---

## 2. Liquid Glass

Apple's material is not "transparent with a blur". Five properties do the work, and omitting any one produces the cheap version.

| Property | Purpose | Implementation |
| --- | --- | --- |
| **Backdrop blur** | Separates the surface from the scene | `backdrop-filter: blur(24px)` |
| **Saturation lift** | Colour behind stays vivid, not muddy | `backdrop-filter: saturate(180%)` |
| **Specular edge** | Implies physical thickness | `inset 0 1px 0 rgba(255,255,255,.12)` top; darker inset bottom |
| **Adaptive tint** | Surface picks up the scene's dominant hue | Subtle overlay, low opacity |
| **Elevation shadow** | Depth | `0 8px 32px rgba(0,0,0,.5)` |

```css
.glass {
  background: var(--glass-fill);
  backdrop-filter: blur(var(--glass-blur)) saturate(180%);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(180%);
  border: 1px solid var(--glass-edge);
  border-radius: var(--radius-lg);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 -1px 0 rgba(0, 0, 0, 0.25);
}
```

### The liquid part
What makes it *liquid* rather than merely frosted is behaviour: surfaces respond to interaction. Edges brighten on hover, the specular highlight tracks the cursor, panels expand with a spring rather than a linear ease, and the material appears to settle rather than snap.

### ⚠️ Two hard constraints
1. **Safari's `backdrop-filter` is the usual casualty.** Test on real Safari early, not at the end. Always ship the `-webkit-` prefix.
2. **Blur over a moving 3D canvas is expensive.** Budget it. Limit the number of simultaneously visible glass surfaces, and consider a cheaper fallback tier on low-end devices — see [[Rules#Performance ceilings]].

---

## 3. Colour

Dark, always. The subject is space.

```css
:root {
  /* Depths */
  --void:        #04070F;   /* deepest background, behind the scene */
  --abyss:       #080D18;   /* panel base */
  --deep:        #0E1626;   /* raised surface */

  /* Accent — bioluminescent cyan, the orca signature */
  --orca-cyan:   #00E5FF;
  --orca-glow:   #5CF2FF;   /* hover / active */
  --abyss-teal:  #00FFCC;   /* secondary, telemetry-positive */

  /* Semantic */
  --critical:    #FF3B30;   /* conjunction alert ONLY */
  --caution:     #FFB020;
  --nominal:     #30D158;

  /* Orbit classes — must be distinguishable to colour-blind users */
  --leo:         #00E5FF;
  --meo:         #A78BFA;
  --geo:         #FFB020;
  --heo:         #FF7AB6;
  --debris:      #8A93A6;

  /* Text */
  --text-hi:     #EAF0FA;
  --text-mid:    #A6B2C6;
  --text-lo:     #6B7789;

  /* Glass */
  --glass-fill:  rgba(12, 20, 34, 0.55);
  --glass-edge:  rgba(255, 255, 255, 0.10);
  --glass-blur:  24px;
}
```

### Rules
- **Every colour lives in `styles/tokens.css`.** No literal anywhere else — enforced by [[Rules#Hard bans]].
- `--critical` red means one thing: a conjunction above the P_c threshold. Never a delete button, never a form error.
- Orbit-class colours must survive deuteranopia. **Always pair colour with a label or icon.**
- Glass fill opacity is a *variable*, not a constant — it rises where text legibility demands it.

---

## 4. Typography

| Role | Font | Notes |
| --- | --- | --- |
| UI and display | **Plus Jakarta Sans** | Geometric, slightly warmer than Inter |
| Measurements and code | **JetBrains Mono** | Every number that is a measurement |

Self-hosted via the build. No external font request — it is a render-blocking dependency and a privacy leak.

### Scale

| Level | Size / line | Weight | Tracking |
| --- | --- | --- | --- |
| Display | 48 / 52 | 700 | −0.03em |
| H1 | 32 / 38 | 700 | −0.02em |
| H2 | 24 / 30 | 600 | −0.01em |
| H3 | 18 / 24 | 600 | 0 |
| Body | 15 / 24 | 400 | 0 |
| Small | 13 / 20 | 400 | 0 |
| Caption | 11 / 16 | 500 | 0.01em |
| **Telemetry label** | 10 / 14 | 700 | **0.14em**, uppercase, mono |
| **Telemetry value** | 20 / 24 | 700 | 0, mono, tabular figures |

### The rule that does most of the work

> **Every number representing a measurement renders in JetBrains Mono with `font-variant-numeric: tabular-nums`.**

Altitude, velocity, latitude, longitude, inclination, eccentricity, period, P_c, Mahalanobis distance, object counts, epochs. All mono, all tabular.

Tabular figures matter more here than anywhere else: these values update every frame, and proportional digits make the whole readout jitter. Tabular numerals hold their position.

**Prose is sans. Data is mono.** That contrast alone does most of the "aerospace instrument" work.

### Detail rules
- Units always present, always in `--text-lo`: `788.6` **km**
- Scientific notation rendered properly: `4.2 × 10⁻³`, never `4.2e-3`
- Body copy max 68 characters per line
- **Every value that derives from an element set displays its epoch.** Non-negotiable ([[PRD#4.2]]).

---

## 5. Motion

Motion communicates physical state. Anything decorative is a candidate for deletion.

| Token | Duration | Easing | Use |
| --- | --- | --- | --- |
| `--motion-instant` | 100 ms | `ease-out` | Hover, focus ring |
| `--motion-quick` | 180 ms | `cubic-bezier(.2,.8,.2,1)` | Button, toggle |
| `--motion-panel` | 320 ms | spring (stiffness 220, damping 26) | Panel open/close |
| `--motion-camera` | 900 ms | `cubic-bezier(.65,0,.35,1)` | Camera focus transition |
| `--motion-scale` | 1600 ms | custom | Earth ↔ Solar scale change |

### Rules
- **Springs for surfaces, curves for cameras.** Panels should feel physical; camera moves should feel controlled.
- Never animate `width`, `height`, `top` or `left`. `transform` and `opacity` only.
- Camera transitions are interruptible — a user grabbing the scene mid-transition takes control immediately.
- **`prefers-reduced-motion` removes:** the landing sequence (fade only), parallax, cursor-tracking highlights, panel springs (instant), camera easing (cut). It does **not** remove satellite motion — that is the data, not decoration.

---

## 6. Components

| Component | Behaviour |
| --- | --- |
| `GlassPanel` | Base surface. Variants: floating, docked, modal. Opacity adapts to content legibility. |
| `TelemetryReadout` | Mono label above mono tabular value with unit. The atomic data component. |
| `ObjectInfoPanel` | Opens on selection. Fills progressively — identity instantly from the snapshot, richer metadata as the API answers. Never a spinner over an empty panel. |
| `TimeControls` | Play/pause, rate stepper, scrubber, jump-to-now. Always visible. |
| `SearchPanel` | Fuzzy search over name and catalog ID. Keyboard-first, `/` to focus. |
| `FilterPanel` | Orbit class, country, operator, object type. Shows result count live. |
| `LayerToggles` | Orbit shells, heatmap, debris swarm, ground tracks. |
| `StatusPill` | Data epoch and freshness. **Always visible somewhere** — honesty requirement. |
| `AlertBadge` | Conjunction alert. Red **plus** icon **plus** text. Never colour alone. |
| `Tooltip` | Hover identity on an object. Minimal — name and class only. |

---

## 7. Layout

```
┌────────────────────────────────────────────────────┐
│  logo            search                  epoch pill │  ← top bar, glass, thin
├──────────┬─────────────────────────────┬───────────┤
│          │                             │           │
│  filters │        3D SCENE             │  object   │
│  layers  │        (owns the screen)    │  info     │
│ collapse │                             │ on select │
│          │                             │           │
├──────────┴─────────────────────────────┴───────────┤
│              time controls  ·  glass                │  ← bottom, always visible
└────────────────────────────────────────────────────┘
```

- Side panels collapse to icon rails. The scene is never less than ~60% of the viewport.
- The object panel only exists when something is selected.
- On mobile: panels become bottom sheets; the scene stays full-bleed.

---

## 8. Responsive

| Breakpoint | Behaviour |
| --- | --- |
| ≥ 1280px | Full layout, both side panels available |
| 768–1279px | Side panels become overlays |
| < 768px | Bottom sheets, simplified HUD, reduced object count, lower `dpr` cap |

**Mobile still gets the real simulation** — this is not a "view the desktop site" situation. It gets fewer rendered objects, tighter LOD, capped device pixel ratio, and glass blur reduced or replaced with higher-opacity fill.

---

## 9. Accessibility

Glassmorphism fails accessibility by default. Counter it deliberately.

- Body text on glass must clear **4.5:1**. Where blur reduces contrast, **raise fill opacity** — never lower text weight or size.
- Focus rings: 2px `--orca-cyan`, always visible. Never `outline: none`.
- Every control keyboard-reachable; the scene has keyboard camera controls.
- Selected object announced to screen readers with its full telemetry.
- Never encode meaning in colour alone.
- Full `prefers-reduced-motion` support per §5.
- **Target: Lighthouse accessibility 100.**

---

## 10. Landing sequence

Full storyboard in [[Branding#Logo animation]]. Design constraints:

| Constraint | Value |
| --- | --- |
| Total duration | ≤ 4 s |
| Skip control | Visible **from frame one** |
| Blocks data loading | ❌ Never — scene loads behind it |
| Reduced motion | Simple fade, no sequence |
| Frequency | Once per session |

> An intro that cannot be skipped is a bounce, not a brand moment.
