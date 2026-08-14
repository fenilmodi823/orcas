---
title: Presentation Prep — ICSSIT 2026
type: research
updated: 2026-07-27
---

# Presentation Prep — ICSSIT 2026

> **Tue 28 July 2026 · 02:40–03:00 PM IST · Parallel Session 5**
> <https://meet.google.com/ksa-jnqh-xjc>
> 20-minute slot → aim for **~13–14 min speaking, 6 min Q&A**

Read this tonight. Skim §1, §4 and §6 tomorrow morning. See [[Conference - ICSSIT 2026]] for logistics, [[ORCAS Research Paper]] for the source, [[Glossary]] for definitions.

> [!info] Deck in use: **`Paper ID-1849.pptx`**
> Same 12 slides, round-tripped through Google Slides. Layout, equations, figures, table and all 12 speaker notes verified intact. The §5 script below maps 1:1 to it.
> ⚠️ Fonts used are **Calibri** and **Consolas**. Consolas is not a Google font — if you present from Google Slides rather than PowerPoint, **check slide 7 first**, as the equations may substitute to a different face.

---

## 1. If you remember nothing else

Memorise this paragraph. It is your abstract, your answer to "so what is your paper about", and your fallback if you lose your thread mid-talk.

> **On 10 February 2009, standard conjunction screening predicted that Iridium 33 and Cosmos 2251 would miss each other by more than 500 metres. They collided at 11.7 km/s. The screening wasn't broken — the question was wrong. Distance alone ignores the fact that every predicted position carries uncertainty. Our system carries that uncertainty — the covariance matrix — through the entire pipeline and computes an actual probability of collision instead of a distance. Re-run on the 2009 data, it returns P_c = 4.2 × 10⁻³, forty-two times above the operational alert threshold. It flags as critical the event that legacy screening called safe. And it does this at 60 frames per second in a browser.**

**The one-sentence version:** *We replaced a distance threshold with a probability, and it catches a collision that the distance threshold missed.*

---

## 2. Why this research exists — the story arc

You built this in a specific logical order. Re-walking it is the fastest way to get the whole thing back.

### Step 1 — The problem is physical

LEO is filling up. Mega-constellations plus decades of fragmentation debris. Kessler's 1978 prediction: past a certain density, collisions generate debris that causes more collisions — a self-sustaining cascade that could make entire orbital shells unusable for generations.

### Step 2 — The tooling is inadequate

Standard Conjunction Assessment propagates two objects to their Time of Closest Approach, measures the Euclidean distance between the predicted points, and alerts if it's below a hardcoded threshold (often ~1 km).

**The flaw:** those predicted points aren't points. They're probability clouds. Radar has noise. Atmospheric drag varies with solar activity. Solar radiation pressure is imperfectly modelled. A TLE gives you a best estimate and *says nothing whatsoever about how confident it is*.

### Step 3 — The proof that this matters
   1. Deterministic algorithms said **>500 m — safe**. The satellites hit at 11.7 km/s. First accidental hypervelocity collision between two intact satellites. Thousands of trackable fragments, still in orbit today.

That is not a sensor failure. It is a **mathematics** failure. The systems were confidently answering the wrong question.

### Step 4 — The fix

Stop asking *"how far apart?"* Start asking *"what's the probability they occupy the same space?"*

That means carrying the covariance matrix — the uncertainty ellipsoid — through the whole pipeline: propagation, coordinate transformation, projection, and finally integration into a probability.

### Step 5 — Why it wasn't already done everywhere

Because it's expensive. Full probabilistic assessment on every pair is O(N²) with a costly per-pair calculation. Nobody does it live in a browser at 60 FPS.

**Your two engineering contributions make it tractable:**

- **Broad-phase spatial hashing** (`scipy.spatial.cKDTree`) reduces the pair count from O(N²) to ~O(N log N). Only survivors get the expensive treatment.
- **Asymptotic approximation** of the P_c integral, because the exact double integral cannot be solved 60 times a second.

### Step 6 — The validation

Don't claim it works. *Prove* it against ground truth. Decouple the propagator from the system clock, feed it declassified February 2009 TLEs, and watch it flag the event that the world's actual screening systems missed.

> **This is why the historical reconstruction is the heart of the paper, not a demo.** It is the same physics engine running on real historical data — not a replay animation.

---

## 3. The mathematics, rebuilt from scratch

You need to be able to explain each step in one sentence without notes. Here they are with the intuition attached.

### The chain

```
SGP4 → C_ECI → C_ECEF → C_c → C_B → D_M → P_c → classify
```

### 3.1 `C_c = C_p + C_s` — combine the uncertainties

**Says:** add the primary satellite's 3×3 covariance to the secondary's.
**Why you can add them:** the two objects are tracked independently, so their position errors are uncorrelated. For independent random variables, variances add.
**Intuition:** instead of two fuzzy clouds approaching each other, treat it as one point approaching one combined cloud. Mathematically equivalent, much easier to compute.

### 3.2 `C_ECEF = J · C_ECI · Jᵀ` — rotate the uncertainty with the Earth

**Says:** transform the covariance from the inertial frame to the Earth-fixed frame using the Jacobian `J` of that transformation, driven by GMST.
**Why:** SGP4 outputs covariance in ECI (fixed relative to the stars). To relate it to ground positions you need ECEF (rotates with Earth). A covariance matrix doesn't transform like a vector — under a linear map it transforms as `J C Jᵀ`. This is the standard first-order propagation of uncertainty.
**Intuition:** if you rotate the coordinate frame, the uncertainty ellipsoid must rotate with it. Skip this and your uncertainty volume points the wrong way — it would be distorted before you ever assess the conjunction.

> **If asked "why the transpose?"** — For `y = Jx`, `Cov(y) = E[Jx(Jx)ᵀ] = J E[xxᵀ] Jᵀ = J C Jᵀ`. It's the multivariate generalisation of `Var(ax) = a²Var(x)`.

### 3.3 `C_B = P · C_c · Pᵀ` — project onto the B-plane

**Says:** `P` is a 2×3 orthographic projection matrix onto the plane perpendicular to the relative velocity vector at TCA. Same `J C Jᵀ` structure, now reducing 3D → 2D.
**Why:** during a hypervelocity encounter the relative motion is essentially a straight line through the encounter region — it's over in milliseconds. So the along-track direction carries no information about whether they hit; only the cross-section perpendicular to that motion matters.
**Intuition:** you're firing a bullet at a target. The only thing that matters is where it crosses the target plane, not how fast it got there. Collapsing 3D to 2D turns an intractable volume integral into a tractable area integral.

### 3.4 `D_M = √(rᵀ C_B⁻¹ r)` — Mahalanobis distance

**Says:** measure separation in units of standard deviation rather than kilometres.
**Why:** 500 metres means nothing on its own. 500 m with tight tracking is comfortable. 500 m with sloppy tracking is terrifying. Dividing by the covariance (`C⁻¹`) normalises distance by how confident you are.
**Intuition:** it's a z-score in multiple dimensions with correlated axes. `D_M = 3` means "3 sigma apart".
**In 2009: D_M = 1.84.** Under two sigma. Very close in the only units that matter.

### 3.5 `P_c = 1/(2π√|C_B|) ∬_A exp(−½ rᵀ C_B⁻¹ r) dx dy`

**Says:** integrate the 2D Gaussian probability density over the collision cross-section `A`.
**What `A` is:** the two spacecraft modelled as spheres; `A` is a circle whose radius is the sum of their two hardbody radii. If the miss vector lands inside that circle, they touch.
**What the pieces are:** the exponential is the 2D Gaussian; `1/(2π√|C_B|)` is the normalising constant so it integrates to 1 over the whole plane.
**Intuition:** pour the probability distribution over the B-plane like sand, then measure how much sand lands inside the target circle. That fraction is your probability of collision.
**Why approximated:** no closed form, and you cannot run numerical quadrature 60 times a second on every candidate pair. Hence the asymptotic approximation.

### 3.6 The threshold: `P_c > 1.0 × 10⁻⁴`

Not arbitrary — 1 in 10,000 is the commonly used operational decision threshold in conjunction assessment practice. Above it, operators consider an avoidance manoeuvre.

**2009 scored 4.2 × 10⁻³ — forty-two times the threshold.**

---

## 4. The numbers you must know cold

Someone will ask. Have these instantly.

### The 2009 event at T₀ (2009-02-10, 16:56:00 UTC)

| | Iridium 33 | Cosmos 2251 |
| --- | --- | --- |
| Altitude | 788.6 km | 788.6 km |
| Lat / Lon | 72.51 N / 97.90 E | 72.51 N / 97.90 E |
| Velocity | 7.46 km/s | 7.42 km/s |
| det(C) | 2.4 × 10⁴ km² | 4.1 × 10⁴ km² |
| **D_M** | — | **1.84** |
| **P_c** | — | **4.2 × 10⁻³** |
| Verdict | — | **CRITICAL ALERT** |

- Relative velocity **11.7 km/s** · deterministic prediction **>500 m miss** · alert threshold **1.0 × 10⁻⁴**

### Machine learning

- **ROC AUC 0.94** (Random Forest) vs **0.70** (deterministic thresholds)
- Feature importance (Gini): scalar velocity **0.40** · eccentricity **0.25** · altitude **0.20** · inclination **0.15**
- Classification matrix: **745 / 45 / 25 / 185**

### System

- **10,000+** debris fragments via `THREE.InstancedMesh` — **one draw call**
- **60 FPS** sustained · **O(N²) → ~O(N log N)** via broad-phase spatial hashing
- ~151-object curated live payload (ISS + 40 GNSS + 40 GEO + 70 LEO)

### 🎓 Three consistency checks that show mastery

Verified — use one of these if a reviewer probes whether you understand your own numbers:

1. **Circular orbital velocity at 788.6 km altitude = 7.46 km/s.** That is exactly Iridium 33's stated velocity. Iridium was in a near-circular orbit, so this is a clean physical cross-check. Cosmos 2251 at 7.42 km/s is very slightly elliptical.
2. **The implied angle between the two velocity vectors is 103.7°.** From the law of cosines: 7.46² + 7.42² − 2(7.46)(7.42)cos θ = 11.7². Consistent with two near-perpendicular orbital planes crossing — Iridium was near-polar (~86° inclination), Cosmos ~74°. The near-perpendicular geometry is exactly why the relative velocity (11.7) is *higher* than either individual velocity.
3. **Orbital period at that altitude ≈ 100.6 minutes.** Consistent with LEO, and with the 90-minute forward projection window used in the CSV export.

> If someone asks *"why is the relative velocity higher than either satellite's speed?"* — because they were crossing at roughly a right angle, so the velocities largely oppose rather than align. This is a very likely question and a very easy win.

---

## 5. Slide-by-slide cues

> [!tip] **Full word-for-word version: [[Presentation Script]]**
> Rehearse from that; present from the cues below.


Target 13–14 minutes. Timings are cumulative.

| # | Slide | Time | Say |
| --- | --- | --- | --- |
| 1 | Title | 0:30 | Name, affiliation, title. "I'll show you why distance-based collision screening fails, and what to replace it with." |
| 2 | Outline | 0:20 | Ten seconds. Don't read it aloud. |
| 3 | Abstract | 0:40 | One line per bullet. Resist elaborating — everything here recurs later. |
| 4 | **Introduction** | **2:00** | ⭐ **Your hook. Slow down here.** Tell the 2009 story as a story: date, the >500 m prediction, 11.7 km/s, "the screening wasn't broken, the question was wrong." |
| 5 | Objectives | 0:45 | Don't read five bullets aloud. Say: "five objectives — two are the research contribution, three are the engineering that makes it usable in real time." |
| 6 | Architecture | 1:30 | Emphasise the constraint: 60 FPS. Broad-phase filtering is what buys the budget. |
| 7 | **Mathematics** | **3:00** | ⭐ **The core.** Walk the five boxes in order with the *intuition*, not the algebra. §3 above is your script. |
| 8 | Visualisation | 1:00 | Two points only: 10,000 fragments in one draw call; the replay is the real propagator on 2009 data, not a video. |
| 9 | **Results I** | **2:00** | ⭐ Table I. Land on D_M = 1.84 and P_c = 4.2 × 10⁻³. Say "forty-two times the threshold." |
| 10 | **Results II** | **2:00** | ⭐ AUC 0.94 vs 0.70. Then Fig. 4: "the centres say miss; the 3σ ellipses overlap. The collision lives in that overlap." |
| 11 | Conclusion | 1:00 | Contribution + the two future-work items. |
| 12 | Thanks | 0:15 | "Happy to take questions." |

### Three sentences to deliver word-for-word

**Slide 4 — the hook:**
> "On the tenth of February 2009, standard screening predicted these two satellites would miss by more than five hundred metres. They collided at eleven point seven kilometres per second. The screening wasn't broken — it was confidently answering the wrong question."

**Slide 7 — the pivot:**
> "The shift is from asking *how far apart are they* to asking *what is the probability they occupy the same space*. That means carrying uncertainty — the covariance — through every stage, instead of discarding it at the first step."

**Slide 10 — the payoff:**
> "If you look only at the centres of these two ellipses, it's a miss. But the three-sigma boundaries overlap substantially. The collision lives inside that overlap. That is the entire case for probabilistic conjunction assessment."

### Delivery notes

- **Slow down on slides 4, 7, 9, 10.** Speed through 2, 3, 5, 12. Uniform pace is what makes technical talks hard to follow.
- Say **"P sub c"** or "probability of collision", not "P C".
- Say **"Mahalanobis"** — *mah-ha-LA-no-bis*.
- **Do not read bullets aloud.** The audience reads faster than you speak.
- If you lose your place: return to the §1 paragraph. It gets you back on the rails from anywhere.

---

## 6. Q&A preparation

### 🔴 Tier 1 — near-certain

**"Where do the covariance matrices come from? TLEs don't publish them."**
> ⚠️ **The most likely hard question. Answer it honestly.**
> "They don't, and that's the main limitation of this work. Public TLE data carries no covariance, so for the reconstruction the covariance is modelled — parameterised from the orbital regime and the age of the element set. That's precisely why the first item of future work is integrating live phased-array radar feeds, which would let us update covariance dynamically instead of relying on static TLE epochs."
>
> **Do not bluff this one.** Naming the limitation clearly is a strength; a reviewer who catches you evading it will discount everything else.

**"Isn't this just visualising a known event? You knew the answer."**
> "The reconstruction is time-decoupled — the same SGP4 propagator runs on declassified February 2009 element sets, with the clock detached from the system time. We aren't replaying a recording; we're re-deriving the outcome from the inputs available *before* the event. That's what makes it validation rather than demonstration."

**"AUC 0.94 versus 0.70 — on what test set? How was the split done?"**
> Give the honest description of your dataset and split. If you're unsure of the exact split ratio, say what you do know and offer to follow up. **Never invent a number.**

**"How does the Random Forest actually improve on the physics? Isn't P_c already the answer?"**
> "P_c is the physics. The Random Forest handles severity classification, where the relationship between velocity, altitude and positional uncertainty is non-linear and a rigid threshold produces excessive false positives. The physics tells you the probability; the classifier decides what's actionable."

### 🟡 Tier 2 — likely

**"Why is the relative velocity 11.7 km/s when each satellite is only doing ~7.4?"**
> "They were crossing at roughly 104 degrees — near-perpendicular orbital planes. Iridium was near-polar, Cosmos around 74 degrees inclination. When velocity vectors oppose rather than align, the relative velocity exceeds either individual speed." *(Easy win — see §4.)*

**"What asymptotic approximation do you use for the P_c integral?"**
> Describe it, and be plain that the exact double integral is not tractable at 60 FPS. If you can't recall the specific form, say so and offer to follow up — far better than guessing.

**"Does 60 FPS hold on ordinary hardware?"**
> "It was validated on RTX 5060 / Ryzen 9 class hardware. There's a performance-monitoring path that degrades swarm density on weaker GPUs. We haven't benchmarked integrated graphics systematically — that's fair to flag."

**"Why SGP4 and not a numerical propagator?"**
> "SGP4 is what the public TLE format is designed for — the element sets are fitted to that model, so using anything else introduces inconsistency. It's also fast enough to run client-side at 60 FPS. A numerical propagator would be more accurate but needs full state vectors and covariance, which is the radar-integration path in future work."

**"What's the false positive rate? Over-alerting has an operational cost."**
> Refer to the ROC curve and the classification matrix (745/45/25/185). Acknowledge that minimising false positives is precisely why the Random Forest sits on top of a raw threshold.

### 🟠 Tier 3 — harder / more hostile

**"Covariance-based conjunction assessment isn't new. Alfano 2007, Chan 2008 — what's actually novel here?"**
> ⚠️ Legitimate, and you should welcome it.
> "Correct — the mathematics is established, and Alfano and Chan are both cited. The contribution isn't the formulation. It's making full covariance-based assessment run in real time in a browser at 60 FPS through broad-phase spatial filtering and an asymptotic approximation, combined with a validated ML severity classifier and an accessible visualisation layer. The novelty is the tractable real-time pipeline, not the underlying probability theory."

**"One event isn't a benchmark. Where's the statistical validation?"**
> "Agreed — a single reconstruction is an existence proof, not a statistical result. It shows the method catches an event that deterministic screening demonstrably missed. Broader validation against a labelled conjunction database is a natural next step."

**"Your covariance is modelled, so isn't the result somewhat circular? Tune the covariance and you get any P_c you like."**
> ⚠️ The sharpest possible question. Meet it head-on.
> "That's a fair challenge. The covariance magnitudes come from published tracking-accuracy characteristics for that orbital regime rather than being fitted to produce an alert. But you're right that sensitivity to the covariance assumption is the key vulnerability, and a sensitivity analysis across a range of covariance magnitudes would strengthen the result considerably."

**"Six authors — what was your specific contribution?"**
> ✅ **Answered 2026-08-13** — approved wording in [[Open-Questions#Decided]] (Q3). Short spoken version:
> "I designed and implemented the system — the SGP4 propagation engine, the covariance-intersection pipeline, the B-plane projection and P_c computation, the Random Forest classifier, and the WebGL visualisation layer — and built the time-decoupled 2009 reconstruction that validates it."
>
> Specific beats broad. Naming five components you can point to in the paper is a stronger claim than any general statement, and it never contradicts the six-name byline.

### If you genuinely don't know

Use this, then move on:
> "I don't have that figure to hand — I don't want to give you a number I'm not certain of. Can I follow up with you after the session?"

That answer costs you nothing. A confident wrong number costs you the room.

---

## 7. Things NOT to say

| ❌ Don't | ✅ Do |
| --- | --- |
| "We solved the Kessler Syndrome" | "This is a step toward tractable real-time conjunction assessment" |
| "Our system is better than NASA's" | "This complements operational systems by making probabilistic assessment interactive" |
| Inventing a number under pressure | "I don't have that to hand — can I follow up?" |
| "It's published in IEEE" | "Accepted at ICSSIT 2026, technically sponsored by IEEE SMC Society" |
| Apologising for limitations unprompted | State them plainly when asked |
| "Basically", "just", "kind of" as hedges | Say the thing directly |

---

## 8. Tonight and tomorrow

### Tonight

- [ ] Read §1, §2, §3 slowly. Say §3 out loud — explaining aloud is what makes it stick.
- [ ] Open the deck in **actual PowerPoint** and check the equation slide (slide 7) renders — it uses Consolas and Unicode maths glyphs
- [ ] Full run-through out loud with a timer. **Once.** Aim 13–14 min.
- [ ] Re-check <https://icssit.com/presentation-schedule.html> in case the slot moved
- [ ] Sleep. Genuinely more valuable than a fourth rehearsal.

### Tomorrow morning

- [ ] Re-read §1 and §4 only
- [ ] One more timed run-through
- [ ] Open the paper PDF in a second window for Q&A
- [ ] Test mic, camera and screen share
- [ ] Charge laptop; mobile hotspot ready

### 2:30 PM

- [ ] Join **<https://meet.google.com/ksa-jnqh-xjc>** (the talk before yours ends 02:40)
- [ ] Deck open in presenter view, notes visible to you only
- [ ] Water within reach
- [ ] Close Slack, email, notifications

### After

- [ ] Certificate + publishing copy: <https://icssit.com/cert-download.html> — key `3LTQVJWEN2`
- [ ] Note any question you couldn't answer → straight into [[Open-Questions]]

---

## 9. One last thing

You are presenting a paper that was peer-reviewed, revised, accepted, and is technically sponsored by the IEEE SMC Society. You are the first author. The reviewers who pushed back in June found it convincing after revision.

The work is sound. You don't have to defend it — you get to explain it.

And you have a genuinely great story: a real collision, a real failure of the standard method, and a method that catches it. Most conference talks don't have that. Lead with it.

---

**Related:** [[Conference - ICSSIT 2026]] · [[ORCAS Research Paper]] · [[Glossary]] · [[memory]]
