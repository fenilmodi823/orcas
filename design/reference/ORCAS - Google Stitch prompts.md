# ORCAS — Google Stitch prompt set

Purpose: get a fast visual preview of the Phase 3 interface before Claude Code
builds it. Five screens, one prompt each.

---

## Before you start

**1. Load the design system, don't paste it.**
Stitch 2.0 imports an open-source `DESIGN.md` format:
**Settings → Design System → Import DESIGN.md**, then select `ORCAS-DESIGN.md`
or paste its contents. Stitch will show you a summary — colour swatches, the type
scale, the spacing scale — confirming it took. Every prompt below assumes this is
loaded, which is why none of them repeat hex codes. If you edit the file later,
re-import it; Stitch does not watch the file.

**2. Set the canvas to web, 1440 × 900.** ORCAS is a desktop-first app. Stitch
defaults toward mobile layouts and will give you a phone screen if you let it.

**3. Give it a picture of the 3D backdrop.** Open `design/reference/orcas-glass-lab.html`,
press F11 for fullscreen, and screenshot four states: at rest, hovering an object,
an object selected, and the dock expanded. Upload those as image references —
Stitch 2.0 accepts images, and this is worth more than any amount of description
for getting the composition right.

**4. Work in Standard mode.** It is the faster model and carries the larger
monthly quota — the exact numbers move, so check what your account shows rather
than trusting any figure written down. Save Experimental for a screen Standard
keeps getting wrong. Note that each prompt spends one generation whether it makes
a screen or just tweaks a corner radius, so batch your thinking, not your prompts.

**5. One screen and one or two changes per prompt.** This is Stitch's own stated
guidance, and long prompts are reported to make it start dropping components —
past roughly 5,000 characters it gets unreliable. Every prompt below is well
under that; the longest is about 1,300.

---

## Prompt 0 — set the vibe

Run this first, on a new project, before any screen.

```text
I am designing ORCAS, a desktop web app that tracks every satellite in Earth
orbit in a live 3D simulation. Think NASA's Eyes on the Earth, but with an
entirely different visual language.

The whole app is one full-bleed 3D scene of Earth with thousands of moving
satellites. Every piece of interface is a translucent frosted-glass panel
floating above that scene — heavy backdrop blur, boosted saturation behind the
glass, a bright 1px highlight along the top edge of each panel to give it
thickness, and a soft deep shadow underneath.

The mood is a precision instrument, not a sci-fi movie. Calm, dark, confident,
almost empty. Restrained. It sits next to a peer-reviewed paper, so it has to
look credible rather than flashy.

Dark only. Never a light theme.

Canvas: web, 1440 x 900.

Don't generate a screen yet. Just confirm you have the design system loaded and
tell me the palette and type scale you're working with.
```

---

## Prompt 1 — Screen A · at rest

This is the default state and the most important screen. Get it right before
moving on.

```text
Screen A, "Live scene, nothing selected".

Full-bleed background: Earth seen from space, roughly centred, filling about
two-thirds of the frame height, with a thin blue atmospheric rim. Deep black
space and faint stars around it. Hundreds of tiny pale cyan dots scattered above
the surface are satellites. Four or five thin curved orbit lines arc around the
globe. This background reaches every edge — it is never inside a card or a
border.

Only three pieces of interface float over it:

Top left: a small cyan orca logo mark, 26px tall, with the wordmark ORCAS beside
it in bold, letter-spaced wide.

Top right: a glass pill containing a small pulsing cyan dot, the word "epoch" in
tiny letter-spaced uppercase, then a timestamp in monospace: 2026-08-15 06:22:41Z.

Bottom centre: a glass bar, 880px wide, 24px above the bottom edge, radius 18.
Left to right inside it: a round solid cyan play/pause button, then rate options
1x 60x 600x 3600x in small monospace with 1x active, then a wide horizontal
scrubber track with a cyan handle about 60% along and one small red tick mark
further right, then the current time in monospace, then a "Now" button with a
thin outline, then a small upward chevron.

Nothing else. No sidebars, no toolbar, no header bar, no cards, no legend.
The screen should feel almost empty.
```

---

## Prompt 2 — Screen B · an object is selected

```text
Screen B, "Object focused".

Same app, but the camera has flown in close to one satellite. Now the background
shows a detailed 3D satellite model — a metallic box body with two long dark
blue solar panels and a small dish — floating in the upper half of the frame,
with Earth's curved horizon glowing behind and below it, and stars above.

The bottom glass dock is now taller and wider, about 940px, and shows the
object instead of just time:

Top row of the dock: the object name "ISS (ZARYA)" in 18px semibold, with a small
outlined cyan badge reading LEO next to it. Underneath, in tiny letter-spaced
uppercase grey: "NORAD 25544 · CATALOGUED". Far right of that row, a small
outlined button reading "Esc · back to Earth".

Below that: a row of six telemetry cells, evenly spaced, each a subtly lighter
rounded rectangle. Each cell has a tiny letter-spaced uppercase grey label above
a large monospace value with a small grey unit after it:
ALTITUDE 419.0 km · VELOCITY 7.66 km/s · INCLINATION 51.60° ·
PERIOD 92.8 min · APOGEE 421 km · PERIGEE 417 km.

Below that, a full-width centred text button "More information" with a small
down chevron, separated by a hairline divider.

The time controls from Screen A stay at the bottom of the same dock, unchanged.

Still no side panels. The object's information lives in this bottom dock.
```

---

## Prompt 3 — Screen C · dock expanded

```text
Screen C, "Dock expanded".

Same as Screen A, but the bottom dock has grown upward to about 200px tall after
the chevron was clicked. The time row stays at the bottom of the dock, unchanged.
Above it, separated by a hairline divider, two labelled rows:

Row one, labelled "FILTER" in tiny letter-spaced uppercase grey on the left:
five small rounded chips in a row. Each chip has an 8px square colour swatch, a
label, and a small monospace count. LEO cyan 563, MEO violet 47, GEO amber 59,
HEO pink 26, DEB grey 260. All five are active.

Row two, labelled "LAYERS" the same way: four chips with no swatch —
"Orbit shells" active, then "Ground tracks", "Density heatmap", "Debris swarm"
dimmed to about 40% opacity.

Also add small red tick marks on the scrubber track at two points, marking
predicted conjunction events.

Keep everything else identical to Screen A.
```

---

## Prompt 4 — Screen D · search

```text
Screen D, "Search open".

Same as Screen A, but a glass search panel has appeared at the top centre of the
screen, 520px wide, radius 18, floating below the top edge with the logo and
epoch pill still visible.

At the top of the panel, a text field with generous padding and no visible border
or background, placeholder "Search by name or catalog ID…", with a text cursor.

Below a hairline divider, five result rows. Each row: a small round colour dot on
the left, the object name in the middle at 13px, and on the right the orbit class
and catalog number in tiny letter-spaced uppercase grey. Rows:
ISS (ZARYA) LEO 25544 · HUBBLE SPACE TELESCOPE LEO 20580 ·
SENTINEL-2A LEO 40697 · GPS BIIF-12 MEO 41328 · GOES-18 GEO 51850.
The first row is highlighted with a very subtle lighter background.

The 3D scene behind is slightly darker so the panel reads clearly.
```

---

## Prompt 5 — Screen E · the intro

```text
Screen E, "Cold open".

A single centred composition on pure black, no interface at all.

In the middle: a cyan orca silhouette, diving downward to the right, its body
formed from thin intersecting elliptical orbital track lines. Three concentric
cyan arc rings fan outward from its nose like radar or sonar, fading as they go.
Beneath the mark, the wordmark ORCAS in bold, widely letter-spaced, and below
that in tiny letter-spaced uppercase grey: "ORBITAL RISK & CONJUNCTION
ASSESSMENT".

Bottom right corner: a small outlined button reading "SKIP INTRO" in tiny
letter-spaced uppercase.

Everything is cyan or grey on black. No gradients. No glow bloom.
```

---

## Refinement prompts

One change at a time. Stitch handles a single adjustment well and forgets things
when you stack several.

```text
Make the bottom dock's glass more opaque — the small monospace labels are
hard to read against the bright part of Earth behind it.
```

```text
Remove the cyan from the telemetry labels and dividers. Cyan is only for things
that are interactive or live. Everything else should be on the grey ramp.
```

```text
The panel corners are too round. Chips and buttons should be 8px, telemetry
cells 10px, and only the outer dock should be 18px.
```

```text
Tighten the vertical rhythm — panel padding 16, 8 between telemetry cells,
16 between control groups.
```

```text
Every measurement should be monospace with tabular figures, and the unit after
it should be smaller and grey. Labels above values, uppercase, letter-spaced wide.
```

```text
Make the scene fill the entire frame edge to edge. It should never sit inside
a card, a border, or a rounded container.
```

```text
Too much is on screen. Remove everything except the logo, the epoch pill and the
bottom dock. The default state should feel almost empty.
```

---

## What Stitch will get wrong, and what to do about it

**It cannot show you the actual glass.** Stitch outputs a flat mockup. Real
`backdrop-filter` blur over a moving WebGL canvas is the one thing that decides
whether this design works, and no static image can answer it. Use Stitch for
composition, hierarchy, spacing and type. Use `orcas-glass-lab.html` for the
material — that is what it exists for.

**Contrast is its known weak spot.** Reviews consistently flag weak contrast,
small hit areas and unreliable focus states in Stitch output. That happens to be
exactly ORCAS's biggest risk, since 10px mono labels on 45%-opaque glass over a
sunlit Earth is close to a worst case. Never treat a Stitch screen as evidence
that contrast passes. The Phase 3 audit still has to be run for real.

**It will drift toward a generic dashboard.** Its output shares a lot of
structural DNA across projects — dashboards come out looking like dashboards. If
you see a sidebar, a top navigation bar, or the 3D view boxed inside a card,
that is the drift, and it needs a correction prompt, not tolerance.

**It won't do motion.** The landing sequence, the camera flight and the panel
springs all have to be judged in the glass lab or in code.

**Treat the output as a reference, not a spec.** Anything Stitch produces that
you like should be fed back as an adjustment to `ORCAS-DESIGN.md` and to
`Prompt - Phase 3 Design System.md` — those two remain the source of truth that
Claude Code builds from. If a Stitch screen and the vault disagree, the vault
wins, or you change the vault deliberately.
