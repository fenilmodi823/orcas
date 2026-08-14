---
title: UI Research
type: design
updated: 2026-07-27
status: active
---

# UI Research

> ⚠️ **Rewritten 2026-07-27.** Research now targets a full simulation interface: NASA Eyes as the UX reference, Apple Liquid Glass as the visual language.

**Related:** [[Design]] · [[Branding]] · [[PRD]] · [[Architecture]]

---

## 1. NASA Eyes — what to take, what to leave

References: [Eyes on Earth](https://eyes.nasa.gov/apps/earth/#/) · [Eyes on the Solar System](https://eyes.nasa.gov/apps/solar-system/#/home)

### Take

**The scene owns the screen.** Controls occupy the margins and collapse. The 3D view is never boxed into a panel. This is the single most important thing they get right, and most "space dashboards" get wrong.

**Progressive disclosure.** You see a planet. Click, and you get a name. Click again, and you get orbital parameters. The complexity is there but never in the way.

**Time as a first-class control.** A persistent timeline with rate control and jump-to-now. Time is a dimension of the data, not a setting buried in a menu.

**Honest scale handling.** They don't pretend the Solar System is to scale. They make the compromise visible instead of hiding it — which is exactly the [[Architecture#Scale strategy]] problem.

**Focus-and-follow camera.** Selecting an object smoothly reframes and then tracks it. The transition is what makes the scene feel navigable rather than abstract.

**Loading that shows something.** Objects populate visibly rather than waiting behind a spinner.

### Leave

**The visual language.** Flat dark panels, thin borders, NASA blue. Competent and dated. Our identity is Liquid Glass and entirely our own — see [[Design#Liquid Glass]].

**Information density in the side panels.** They present a wall of parameters at once. We reveal progressively.

**Desktop assumption.** Eyes on Earth is uncomfortable on a phone. Mobile is a real target for us.

**Onboarding.** Theirs is thin. Our landing sequence and first-run affordances should be better.

---

## 2. Liquid Glass — the technique

Apple's material system as applied in visionOS and recent macOS/iOS. The full implementation spec lives in [[Design#Liquid Glass]]; this section is the research behind it.

### The five properties, and why each matters

1. **Backdrop blur** separates surface from scene. Without it, a translucent panel is just a tint.
2. **Saturation lift (≈180%)** is the most commonly omitted property and the most noticeable. Blur desaturates; without correction the panel looks grey and dead over a colourful scene.
3. **Specular edge** — a 1px light inset on the top edge, dark on the bottom. This is what implies *thickness*. A flat border implies a cut-out.
4. **Adaptive tint** — the surface picks up the dominant hue behind it. Over Earth's limb the glass warms slightly; over deep space it cools.
5. **Elevation shadow** separates the panel from the scene behind.

### The rule most implementations break

**Glass must have something behind it.** A glass panel over a flat background is a lie the eye detects instantly. ORCAS is the ideal case — there is always a live 3D scene behind every surface.

Where nothing is behind an element, use a solid `--abyss` panel instead. Fake glass is worse than no glass.

### What makes it "liquid"

Behaviour, not appearance:
- Edges brighten on hover
- The specular highlight tracks the cursor across the surface
- Panels expand with a spring, appearing to settle rather than snap
- Content within reflows fluidly rather than popping

### ⚠️ Costs and risks

| Risk | Mitigation |
| --- | --- |
| **Safari `backdrop-filter` inconsistency** | Test on real Safari in Phase 3, not Phase 5. Always ship `-webkit-` prefix. |
| **Blur over a moving canvas is GPU-expensive** | Cap simultaneous glass surfaces. Measure. Provide a reduced tier: higher fill opacity, no blur. |
| **Contrast failure** | Fill opacity is a variable that rises for legibility. Audit against the brightest scene content — Earth's daylit limb. |
| **Everything glass = nothing reads as elevated** | Reserve glass for floating chrome. Docked rails can be more solid. |

---

## 3. Other prior art

### Space and mission-control interfaces

| Reference | Take |
| --- | --- |
| **LeoLabs Visualization** | Debris rendering at genuine scale; restrained class-based colour coding. The closest commercial analogue to ORCAS. |
| **stuffin.space** | Honest, fast, open WebGL orbital tracker. A good baseline for "acceptable performance" with a large catalogue. |
| **Celestrak / Space-Track** | Not visual — but their data presentation conventions are what domain experts expect. Match their terminology. |
| **SpaceX webcast telemetry** | The mono readout. Minimal, high-contrast, unmistakably instrumentation. Direct source of our telemetry component. |
| **Satellite Map / Orbit.ing-now** | Useful counter-examples: fast, but visually flat and hard to explore. |

### Dark technical interfaces
**Linear** — density and keyboard-first navigation. **Grafana** — many numbers without noise. **Observable** — maths and prose side by side. **Figma** — floating panels over an infinite canvas, which is structurally the same problem as floating panels over a 3D scene.

---

## 4. Interaction patterns to adopt

| Pattern | Behaviour |
| --- | --- |
| **Hover to identify, click to select** | Hover shows a minimal tooltip; click opens the full panel and reframes the camera |
| **Escape to deselect** | Always. Closes the panel, releases the camera. |
| **`/` to search** | Keyboard-first, like every tool developers actually like |
| **Scrub, don't set** | Time is a draggable scrubber, not a date input |
| **Layers, not modes** | Heatmap and debris swarm are toggles that compose, not exclusive modes |
| **Interruptible transitions** | Grabbing the scene mid-camera-move takes control immediately |
| **Populate visibly** | Objects appear as they load. Never a blocking spinner over an empty scene. |

---

## 5. Anti-patterns

| ❌ | Why |
| --- | --- |
| Neon glow on everything | Reads as sci-fi cosplay, not instrumentation. Glow marks *live* or *critical* only. |
| Purple-blue "AI startup" gradients | Generic and dates instantly |
| Unskippable intro | A bounce, not a brand moment |
| Scroll-jacking | Fights the user; catastrophic for accessibility |
| Blocking spinner over the scene | Show the scene populating instead |
| Glass over a flat background | The eye detects the fake immediately |
| Low-contrast text on glass | The default failure mode of this entire aesthetic |
| Presenting stale data as live | The one that costs credibility. Always show the epoch. |
| Animating `width` / `top` | Layout thrash. `transform` and `opacity` only. |
| React state updated every frame | The classic R3F performance killer. Use refs and `useFrame`. |

---

## 6. Open design questions

- Does the object panel dock to the right, or float near the selected object? *(Leaning: dock — floating panels over a moving scene are hard to track.)*
- Should orbit paths render for every visible object, or only the selected one? *(Leaning: selected plus hovered. All paths at once is visual noise at 16,000 objects.)*
- How is the debris swarm labelled so it is never mistaken for tracked objects? *(This is an honesty requirement, not just a design one — see [[Rules#Honesty rules]].)*
- Does the timeline show conjunction events as markers?
- What does the first-time user see before touching anything — a guided moment, or immediate control?

---

**Sources:** [NASA Eyes on Earth](https://eyes.nasa.gov/apps/earth/#/) · [NASA Eyes on the Solar System](https://eyes.nasa.gov/apps/solar-system/#/home)
