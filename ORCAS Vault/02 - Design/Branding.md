---
title: Branding
type: design
updated: 2026-07-27
status: active
---

# Branding

> ⚠️ **Rewritten 2026-07-27.** Logo is now a Phase 3 deliverable with an animation requirement, not a someday idea.

**Related:** [[Design]] · [[UI-Research]] · [[PRD]] · [[Phases]]

---

## The metaphor

**ORCAS** — Orbital Risk and Conjunction Assessment System. Also the orca.

That collision of names is the strongest branding asset the project has. Three parallels, all defensible if anyone asks:

**Echolocation.** An orca maps a dark ocean by emitting sound and reading what returns. ORCAS maps dark orbital space by ingesting orbital data and radar telemetry. Both build a picture of an environment they cannot see.

**Guardian of an ecosystem.** Orcas are apex predators that keep an ocean in balance. ORCAS exists to help prevent the Kessler Syndrome. Both are custodians rather than exploiters.

**The pod.** Orcas hunt collectively with high intelligence. ORCAS runs on a pod of cooperating parts — SGP4 physics, the Random Forest classifier, covariance intersection, the WebGL renderer. No single one solves the problem.

---

## Logo — the mark

### Direction: "The Radar Wireframe"

An abstract orca silhouette, diving, its body composed entirely of thin intersecting orbital tracks and a data grid. Concentric radar rings fade outward from the nose, dissolving into a point cloud — the debris field.

**Why this one:**
- It survives at 24px in a browser tab, which is the real constraint
- It reads correctly in a single colour
- It signals **data and instrumentation**, not nature documentary
- It sits naturally on a dark glass surface
- **It animates.** The orbital tracks that form the body are literally drawable — which makes the logo animation a natural consequence of the mark rather than an effect bolted onto it.

### Rejected alternatives
- **"The Orbital Breach"** — orca breaching, back tracing Earth's horizon. Cleaner, more corporate; but generic at small sizes and harder to animate meaningfully.
- **"Celestial Constellation"** — orca as a star constellation with neural-network connecting lines. Elegant on a title slide, illegible as a favicon.

### Requirements
- [ ] Single-colour version, `--orca-cyan` on `--void` and inverted
- [ ] **Legible at 24px** — test this before committing to anything
- [ ] Hand-optimised SVG, inline-able, path-animatable
- [ ] Monogram variant (radar rings / eye-patch node alone) for compact contexts
- [ ] Favicon set, Apple touch icon, OG lockup
- [ ] **No gradients in the primary mark** — they die at small sizes
- [ ] Wordmark: ORCAS in Plus Jakarta Sans, tracking +0.08em, weight 700

---

## Logo animation

The mark's construction *is* the animation. Nothing needs inventing.

```
0.0s   Black. A single point of light.
0.4s   Point expands into concentric radar rings, cyan, fading outward.
0.8s   Orbital track lines begin drawing — SVG path draw-on,
       staggered, each one an arc.
1.6s   The arcs resolve: the intersecting tracks form the orca silhouette.
2.0s   Silhouette holds. Specular sweep passes across it.
2.4s   Wordmark fades in beneath.
3.0s   Whole lockup scales down and settles into the top-left
       — becoming the actual site logo, in place.
3.6s   Scene revealed behind. Glass UI settles in.
```

**Constraints:**
- Total ≤ 4 s
- **Skip control visible from frame one**
- Runs on the GPU — `transform` and `opacity`, plus SVG `stroke-dashoffset`. Never layout properties.
- Loads nothing. The logo is inline SVG in the HTML.
- **Never blocks the scene loading behind it**
- `prefers-reduced-motion` → static logo, 300 ms fade, straight to the scene
- Once per session

> The transition at 3.0s is the whole idea: the intro logo *becomes* the site logo. That continuity is what makes it feel designed rather than decorative.

---

## Landing sequence

The logo animation is the second beat of a three-beat opening.

**Beat 1 — Cold open (0–1.0s).** Black. Starfield fades in. A faint horizon curve suggests Earth below frame.

**Beat 2 — Logo (1.0–3.6s).** As above.

**Beat 3 — Reveal (3.6–4.0s).** Camera pulls back to reveal Earth and the live satellite field already populated and moving. Glass panels settle in with a stagger.

The user should feel they arrived somewhere, not that they waited for something.

**Rule:** the scene data loads during beats 1 and 2. If it loads early, the sequence can shorten. **It must never lengthen to wait for data** — if data is slow, reveal the scene and let objects populate visibly. Watching satellites appear is more interesting than watching a spinner.

---

## Voice

**Precise, not promotional.** The subject is genuinely serious — real debris, real risk, a real collision. Overselling undercuts it.

| Write | Don't write |
| --- | --- |
| "Deterministic screening predicted a 500 m miss. They collided." | "Revolutionising space safety! 🚀" |
| "P_c = 4.2 × 10⁻³, forty-two times the alert threshold." | "Incredibly accurate predictions" |
| "16,200 active satellites, propagated live in your browser." | "Blazing fast performance" |
| "Accepted at ICSSIT 2026, technically sponsored by IEEE SMC Society." | "Published in IEEE" |
| "Element set epoch: 2026-07-27 06:22 UTC" | Presenting stale data as live |

Let the numbers carry it. They are strong enough alone.

**No emoji on the site. No exclamation marks.** Both are fine in this vault.

### Naming discipline
- **ORCAS** — the platform and the simulation
- **The portfolio** — the separate personal site
- ❌ **"ORCAS OS"** — retired. Don't reintroduce it.

---

## Asset checklist

- [ ] Logo: primary, mono, monogram — SVG
- [ ] Animated logo — inline SVG + CSS/Framer
- [ ] Favicon set + Apple touch icon
- [ ] OG / social card for both sites
- [ ] Professional headshot (portfolio)
- [ ] Consistent avatar across GitHub, LinkedIn, ORCID
- [ ] **Licence recorded for every 3D model shipped** ([[Data-Strategy#3D asset pipeline]])
