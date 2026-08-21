# ORCAS Design System

Orbital Risk and Conjunction Assessment System — a live 3D satellite-tracking
simulation. The 3D scene owns the screen; every surface is translucent glass
floating above it. Dark only. Precise, not promotional.

## Principles

- The simulation is the interface. Chrome floats above it and gets out of the way.
- Glass always has a live 3D scene behind it. Never glass over a flat background.
- Data is legible before it is beautiful. If a readout is hard to read, the surface
  gets more opaque — never the text smaller, lighter or thinner.
- Prose is sans. Every measurement is mono.

## Colors

### Depths

| Token | Hex | Use |
| --- | --- | --- |
| `void` | `#04070F` | Deepest background, behind the 3D scene |
| `abyss` | `#080D18` | Solid panel base where no scene is behind it |
| `deep` | `#0E1626` | Raised solid surface |

### Accent

| Token | Hex | Use |
| --- | --- | --- |
| `orca-cyan` | `#00E5FF` | **Interactive or live only.** Selection, focus ring, live indicator, primary control. |
| `orca-glow` | `#5CF2FF` | Hover and active state of the above |
| `abyss-teal` | `#00FFCC` | Secondary, telemetry-positive. Rare. |

### Semantic

| Token | Hex | Use |
| --- | --- | --- |
| `critical` | `#FF3B30` | Conjunction alert ONLY. Never a delete button, never a form error. |
| `caution` | `#FFB020` | Warning, degraded state |
| `nominal` | `#30D158` | Healthy state |

### Orbit classes

| Token | Hex | Use |
| --- | --- | --- |
| `leo` | `#00E5FF` | Low Earth orbit |
| `meo` | `#A78BFA` | Medium Earth orbit |
| `geo` | `#FFB020` | Geostationary |
| `heo` | `#FF7AB6` | Highly elliptical |
| `debris` | `#8A93A6` | Debris |

Orbit-class colour appears only in the legend, the filter chips, and the selected
object. Unselected objects in the scene render neutral pale grey-blue.

### Text

| Token | Hex | Use |
| --- | --- | --- |
| `text-hi` | `#EAF0FA` | Primary text, values, headings |
| `text-mid` | `#A6B2C6` | Secondary text, body prose |
| `text-lo` | `#6B7789` | Labels, units, captions, dividers |

### Glass

| Token | Value | Use |
| --- | --- | --- |
| `glass-fill` | `rgba(12, 20, 34, 0.45)` | Standard floating surface |
| `glass-fill-raised` | `rgba(12, 20, 34, 0.62)` | Where legibility demands more opacity |
| `glass-fill-solid` | `rgba(8, 13, 24, 0.94)` | Fallback when backdrop-filter is unavailable |
| `glass-edge` | `rgba(255, 255, 255, 0.18)` | 1px border |
| `glass-specular` | `rgba(255, 255, 255, 0.22)` | Inset highlight, top edge only |
| `glass-underline` | `rgba(0, 0, 0, 0.28)` | Inset shadow, bottom edge only |

## Typography

Two families, self-hosted. **Plus Jakarta Sans** for all interface text and prose.
**JetBrains Mono** for every number that is a measurement.

| Level | Family | Size / line | Weight | Tracking | Case |
| --- | --- | --- | --- | --- | --- |
| Display | Plus Jakarta Sans | 48 / 52 | 700 | −0.03em | — |
| H1 | Plus Jakarta Sans | 32 / 38 | 700 | −0.02em | — |
| H2 | Plus Jakarta Sans | 24 / 30 | 600 | −0.01em | — |
| H3 | Plus Jakarta Sans | 18 / 24 | 600 | 0 | — |
| Body | Plus Jakarta Sans | 15 / 24 | 400 | 0 | — |
| Small | Plus Jakarta Sans | 13 / 20 | 400 | 0 | — |
| Caption | Plus Jakarta Sans | 11 / 16 | 500 | 0.01em | — |
| Telemetry label | JetBrains Mono | 10 / 14 | 700 | 0.14em | UPPERCASE |
| Telemetry value | JetBrains Mono | 20 / 24 | 700 | 0 | tabular figures |

**The rule that does most of the work:** every number representing a measurement —
altitude, velocity, inclination, period, probability, epoch, catalog ID, object
count — renders in JetBrains Mono with tabular figures. Units always follow the
value, always in `text-lo`, always smaller.

Body copy is capped at 68 characters per line.

## Spacing

4px base scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

Panel padding 16. Gap between telemetry cells 8. Gap between control groups 16.
Screen margin 24.

## Radii

| Token | Value | Applies to |
| --- | --- | --- |
| `radius-xs` | 6px | Swatch, tag |
| `radius-sm` | 8px | Chip, button |
| `radius-md` | 10px | Telemetry cell |
| `radius-lg` | 12px | Docked rail, icon button |
| `radius-xl` | 18px | Floating panel, the bottom dock |
| `radius-2xl` | 20px | Modal |
| `radius-pill` | 999px | Toggle, transport control, epoch pill |

Small radii on data chrome, larger on floating panels. Never one uniform radius
everywhere — the mix is deliberate.

## Elevation

| Token | Value |
| --- | --- |
| `elev-1` | `0 2px 8px rgba(0,0,0,.35)` |
| `elev-2` | `0 8px 32px rgba(0,0,0,.45)` |
| `elev-3` | `0 12px 48px rgba(0,0,0,.5)` |
| `elev-4` | `0 24px 64px rgba(0,0,0,.6)` |
| `focus-ring` | `0 0 0 2px #00E5FF` |

## Motion

| Token | Duration | Easing | Use |
| --- | --- | --- | --- |
| `motion-instant` | 100ms | ease-out | Hover, focus ring |
| `motion-quick` | 180ms | `cubic-bezier(.2,.8,.2,1)` | Button, toggle, chip |
| `motion-panel` | 320ms | spring, stiffness 220 damping 26 | Panel open and close |
| `motion-camera` | 900ms | `cubic-bezier(.65,0,.35,1)` | Camera focus transition |

Springs for surfaces, curves for cameras. Surfaces settle rather than snap.
Animate transform and opacity only — never width, height, top or left.

## Components

### Glass panel

`background rgba(12,20,34,.45)` · `backdrop-blur 30px` · `backdrop-saturate 200%` ·
`border 1px rgba(255,255,255,.18)` · `radius-xl 18px` · `elev-3` ·
inset highlight `0 1px 0 rgba(255,255,255,.22)` top ·
inset shadow `0 -1px 0 rgba(0,0,0,.28)` bottom.

Five properties, all required. Blur alone is a tint, not glass. The saturation lift
is the most commonly omitted and the most noticeable — blur desaturates, and without
correction the panel looks grey and dead over a colourful scene. The 1px inset
highlight on the top edge is what implies thickness; a flat border implies a cut-out.

### Telemetry cell

`radius-md 10px` · `padding 10px 12px` · `background rgba(255,255,255,.035)` ·
`border 1px rgba(255,255,255,.06)`. Mono uppercase label in `text-lo` above a mono
tabular value in `text-hi`, with the unit trailing in `text-lo` at 11px.

### Bottom dock

The primary interface surface. Glass panel, `radius-xl 18px`, centred, `max-width
880px`, sitting 24px from the bottom edge. Two modes:

- **time** — play/pause button, rate stepper, scrubber track, NOW button, mono UTC
  clock, expand chevron. Single row, about 60px tall.
- **object** — selected object identity, orbit-class badge, a row of telemetry
  cells, a "More information" disclosure, and the time row beneath it.

Expands upward into orbit-class filter chips, layer toggles, and conjunction
markers drawn on the scrubber track.

### Chip

`radius-sm 8px` · `padding 6px 11px` · `border 1px rgba(255,255,255,.10)` ·
`background rgba(255,255,255,.03)` · caption text in `text-mid` · optional 8px
square colour swatch · optional count in mono 10px `text-lo`. Unselected chips drop
to 42% opacity.

### Icon button

38×38 · `radius-lg 12px` · glass · 17px stroked icon at 1.6px weight in `text-mid`,
brightening to `text-hi` on hover.

### Epoch pill

`radius-pill` · `padding 8px 14px` · glass · a 7px cyan dot with a slow pulse, the
word "epoch" in telemetry-label style, then the timestamp in mono. Always visible.

### Tether chip

A small glass chip pinned beside a hovered object with a 18px horizontal leader
line. `radius-sm 8px`, name at 13px semibold, class and altitude in telemetry-label
style. Minimal — identity only.

## Constraints

### Do

- Keep the screen close to empty at rest: logo top-left, epoch pill top-right,
  bottom dock. Nothing else until it is asked for.
- Let the 3D scene occupy the full viewport, edge to edge, behind everything.
- Use cyan only for what is interactive or live.
- Pair every colour with a label or an icon. Orbit class is swatch plus text.
- Show the data epoch somewhere, always. It is an honesty requirement.
- Give every number its unit, in `text-lo`, smaller than the value.
- Keep focus rings visible: 2px `#00E5FF`, never removed.

### Don't

- No left sidebar. No right sidebar. No right-hand detail panel. Selection puts
  information in the **bottom dock**, not in a side panel.
- No neon glow on everything. Glow marks live or critical only.
- No purple-blue "AI startup" gradients.
- No gradients in the logo mark.
- No light theme. No white or light-grey panels.
- No low-contrast text on glass — this is the default failure mode of the whole
  aesthetic and the single thing most likely to go wrong.
- No boxing the 3D view inside a card or a bordered container.
- No emoji. No exclamation marks. Precise, not promotional.
- No spinner over an empty scene — objects populate visibly instead.
