---
title: Presentation Script — ICSSIT 2026
type: research
updated: 2026-07-28
status: active
---

# Presentation Script — ICSSIT 2026

> **Tue 28 July 2026 · 02:40–03:00 PM IST · Parallel Session 5**
> Deck: `Paper ID-1849.pptx` · 12 slides · 20-minute slot

**Word-for-word script.** Rehearse from it, then present from the bullet cues in [[Presentation Prep#5. Slide-by-slide script]]. Reading verbatim on the day sounds flat — but knowing exactly what you *would* say means you never stall.

**Related:** [[Presentation Prep]] · [[Conference - ICSSIT 2026]] · [[ORCAS Research Paper]] · [[Glossary]]

---

## Timing — measured, not estimated

| # | Slide | Words | @132 wpm | Cumulative |
| --- | --- | --- | --- | --- |
| 1 | Title | 80 | 0:36 | 0:36 |
| 2 | Outline | 50 | 0:23 | 1:00 |
| 3 | Abstract | 91 | 0:41 | 1:41 |
| 4 | **Introduction** ⭐ | 324 | **2:27** | 4:08 |
| 5 | Objectives | 141 | 1:04 | 5:12 |
| 6 | Architecture | 193 | 1:28 | 6:40 |
| 7 | **Mathematics** ⭐ | 484 | **3:40** | 10:20 |
| 8 | Visualisation | 122 | 0:55 | 11:15 |
| 9 | **Results I** ⭐ | 229 | **1:44** | 12:59 |
| 10 | **Results II** ⭐ | 184 | **1:24** | 14:23 |
| 11 | Conclusion | 158 | 1:12 | 15:35 |
| 12 | Thanks | 40 | 0:18 | **15:53** |

> [!warning] **The full script runs ~16 minutes, not 14.**
> **2,096 words**, measured. At a realistic 132 wpm that's **15:53**, leaving only ~4 minutes for Q&A in a 20-minute slot. Session chairs at parallel sessions do cut people off.
>
> **Pick one of these before you present:**
>
> | Option | Result |
> | --- | --- |
> | **A — Trim to ~14:00** ⭐ recommended | Apply the priority cuts below (~250 words). Leaves ~6 min Q&A. |
> | B — Speak at ~145 wpm | Lands ~14:30. Risky: the maths slide needs air, and rushing it is worse than cutting it. |
> | C — Deliver in full | ~16:00 and hope Q&A is short. Not advisable. |

### Priority cuts for Option A — apply these in order

| Cut | Where | Saves |
| --- | --- | --- |
| 1. All `[CUT]`-marked sentences | throughout | ~35s |
| 2. Slide 7 step 2 — drop the "note the form" explanation, keep only the sentence about the Earth rotating | Mathematics | ~30s |
| 3. Slide 5 — read only objectives 3 and 4, then *"the other three are the supporting engineering"* | Objectives | ~35s |
| 4. Slide 6 — compress C and D into one sentence | Architecture | ~30s |
| 5. Slide 4 — drop the "confident, precise and completely wrong" sentence *(reluctantly — it's a good line)* | Introduction | ~15s |

**Total saving ≈ 2:25 → lands at ~13:30.** Comfortable.

**Never cut:** the 500-metre line on slide 4 · steps 4 and 5 on slide 7 · the two numbers on slide 9 · the ellipse-overlap argument on slide 10. Those four are the talk.

Legend: **[PAUSE]** stop for a beat · **[POINT]** gesture at the slide · **[CUT]** drop if behind · **[ADVANCE]** next slide

---

## Slide 1 — Title

> Good afternoon, everyone. My name is Fenil Modi, from the Department of Computer Engineering at Silver Oak University, Ahmedabad.
>
> The paper I'm presenting is *Probabilistic Space Debris Conjunction Assessment Using Machine Learning and Covariance Intersection Analysis* — paper ID eighteen forty-nine. This is joint work with five colleagues, listed here.
>
> **[PAUSE]**
>
> Over the next thirteen or fourteen minutes I want to show you why the standard method for predicting satellite collisions fails — and what we propose to replace it with.
>
> **[ADVANCE]**

---

## Slide 2 — Outline

> Briefly, here's where we're going.
>
> I'll start with the problem and why it matters, then our objectives. Then the technical approach — the architecture, the mathematics, and the visualisation — which is where most of the time will go. Then our results, and I'll close with conclusions and future work.
>
> **[ADVANCE]**

---

## Slide 3 — Abstract

> Let me summarise the whole paper in four sentences.
>
> Low Earth Orbit is filling up with satellites and micro-debris, which raises the risk of the Kessler Syndrome. Standard physics models mispredict collisions because they ignore the uncertainty in their own input data.
>
> We built a real-time system that bridges high-fidelity orbital mechanics with machine learning, and evaluates an actual probability of collision rather than a distance.
>
> We validated it by reconstructing the 2009 Iridium–Cosmos collision from historical data. And the whole thing runs in a browser at sixty frames per second.
>
> **[ADVANCE]**

---

## Slide 4 — Introduction ⭐

> Let me start with the problem, because it's the reason this work exists.
>
> Today, if you want to know whether two satellites are going to collide, the standard approach is this. You take both objects, propagate their orbits forward to the moment of closest approach, measure the straight-line distance between the two predicted positions, and if that distance falls below a fixed threshold — often around one kilometre — you raise an alert.
>
> That sounds entirely reasonable. And it has a fatal flaw.
>
> **[PAUSE]**
>
> Those two predicted positions are not points. They are estimates, and every estimate carries uncertainty. Radar measurements contain noise. Atmospheric drag varies with solar activity. Solar radiation pressure is imperfectly modelled.
>
> So what you actually have is not two points in space. You have two probability clouds. And when you discard that uncertainty and keep only the distance between the centres, you can get an answer that is confident, precise, and completely wrong.
>
> **[PAUSE] [POINT at the third bullet]**
>
> Here is what that costs.
>
> On the tenth of February 2009, the active Iridium 33 communications satellite and the derelict Cosmos 2251 spacecraft approached each other over Siberia. Standard deterministic screening predicted they would miss by more than five hundred metres.
>
> They collided. At eleven point seven kilometres per second.
>
> **[PAUSE]**
>
> It was the first accidental hypervelocity collision between two intact satellites, and it produced thousands of trackable fragments that are still in orbit today. `[CUT this sentence if behind]`
>
> I want to be precise about what failed. That was not a sensor failure — the tracking data was fine. It was a *mathematics* failure. The system was confidently answering the wrong question.
>
> **[POINT at GOAL]**
>
> So our goal is to change the question. Instead of asking *how far apart are they*, we ask *what is the probability that they occupy the same space*. That means carrying the uncertainty — the covariance matrix — through the entire pipeline instead of throwing it away at the first step. And it has to run in real time.
>
> **[ADVANCE]**

---

## Slide 5 — Objectives

> That goal breaks into five objectives. I won't read them all — let me give you the shape.
>
> **First**, ingest live orbital data from CelesTrak through a non-blocking asynchronous pipeline, and pre-sort objects by orbital regime.
>
> **Second**, propagate the orbits on the client using SGP4, synchronised to sidereal time on every frame.
>
> **Third** — and this is the core contribution — replace distance screening with covariance intersection: compute the Mahalanobis distance and an actionable probability of collision.
>
> **Fourth**, classify conjunction severity with a Random Forest ensemble, and raise a critical alert above a probability of one in ten thousand.
>
> **And fifth**, validate all of it against the 2009 event, and export the kinematic data so others can check it.
>
> Objectives three and four are the research. One, two and five are the engineering that makes them usable.
>
> **[ADVANCE]**

---

## Slide 6 — Technical Flow: System Architecture

> Architecturally the system is deliberately decoupled, and the whole design is driven by one number: sixty frames per second.
>
> **[POINT A]** On the server side, a Python FastAPI backend ingests orbital element data from CelesTrak. It doesn't simply forward text files to the browser — it validates the data and sorts objects into Low, Medium and Geosynchronous Earth orbit by mean motion and orbital period, before the client sees anything.
>
> **[POINT B]** The critical piece is this second one. Collision screening between every pair of objects is an order-N-squared problem. With thousands of objects that's a combinatorial explosion, and the browser simply dies.
>
> So we use broad-phase spatial hashing — a k-d tree — to cheaply eliminate the pairs that cannot possibly collide. That reduces it to roughly order-N-log-N. Only the surviving candidates go into the expensive probabilistic stage. That is what buys us the frame budget.
>
> **[POINT C and D]** On the client, React and React-Three-Fiber issue draw calls directly to the GPU. And SGP4 runs natively in the browser, so positions are computed locally every frame rather than polled from the server. There is no network round-trip in the interaction loop — which is what makes genuine real-time possible.
>
> **[ADVANCE]**

---

## Slide 7 — Technical Flow: Mathematical Framework ⭐⭐

> This is the heart of the paper. Five steps, taking us from raw uncertainty to an actionable probability. I'll give you the intuition for each rather than the algebra.
>
> **[POINT box 1]**
> **Step one.** Each object has a three-by-three positional covariance matrix — geometrically, an uncertainty ellipsoid around its predicted position. Because the two objects are tracked independently, their errors are uncorrelated, so we can simply add the two matrices.
>
> That gives one combined covariance. Instead of two fuzzy clouds approaching each other, we now have a single point approaching a single cloud. Mathematically equivalent, and much easier to work with.
>
> **[POINT box 2]**
> **Step two.** SGP4 gives us that covariance in the Earth-Centered Inertial frame, which is fixed relative to the stars. But the Earth rotates underneath it. To relate the uncertainty to positions on the ground we transform it using the Jacobian of that rotation, driven by Greenwich Mean Sidereal Time.
>
> Note the form — J, C, J-transpose. A covariance matrix does not transform the way a vector does; under a linear map it transforms like this. `[CUT: If you skip this step, the uncertainty ellipsoid ends up oriented incorrectly before you have even assessed the conjunction.]`
>
> **[POINT box 3]**
> **Step three.** We project down into two dimensions, onto what's called the B-plane — the plane perpendicular to the relative velocity vector at closest approach.
>
> The justification is that a hypervelocity encounter is over in milliseconds, so the relative motion through the encounter region is essentially a straight line. The along-track direction therefore tells you nothing about whether they hit. Only the cross-section perpendicular to that motion matters.
>
> Think of firing a bullet at a target: what matters is where it crosses the target plane. This turns an intractable volume integral into a tractable area integral.
>
> **[POINT box 4]**
> **Step four.** The Mahalanobis distance. This is the key metric, and it's the one I'd like you to take away.
>
> Instead of measuring separation in kilometres, we measure it in units of the uncertainty itself. Five hundred metres means nothing on its own. Five hundred metres with tight tracking is comfortable. Five hundred metres with poor tracking is dangerous. Dividing by the covariance normalises the distance by how confident we actually are. It is effectively a z-score in multiple dimensions.
>
> **[PAUSE] [POINT box 5]**
> **And step five.** We integrate the two-dimensional Gaussian probability density over the collision cross-section.
>
> That cross-section is a circle whose radius is the combined hardbody radii of the two spacecraft — if the miss vector lands inside it, they touch.
>
> Conceptually: pour the probability distribution over the B-plane like sand, and measure how much of it lands inside the target circle. That fraction is the probability of collision.
>
> **[POINT the red line]**
> This integral has no closed form, and we cannot run numerical quadrature sixty times a second on every candidate pair. So the machine learning pipeline uses an asymptotic approximation of it.
>
> If the resulting probability exceeds one times ten to the minus four — one in ten thousand, the standard operational decision threshold — the system overrides the normal tracking loop and raises a critical conjunction alert.
>
> **[ADVANCE]**

---

## Slide 8 — Technical Flow: Visualisation and Simulation

> Two engineering points on the visualisation layer.
>
> **First**, the debris swarm. Rendering ten thousand individual meshes in a browser would collapse the frame rate. Instead we use a single instanced mesh — one geometry, one material, and an array of transformation matrices — which the GPU draws in a single call. Ten thousand fragments, essentially free.
>
> **Second**, and more important: the historical replay. By default SGP4 propagates from the system clock. We decoupled the engine from that clock so it can ingest historical epochs.
>
> So when we replay the 2009 event, we are not playing back a recording. The same propagator is running on declassified element sets from February 2009. That distinction is what makes this validation rather than demonstration.
>
> `[CUT: We also expose a live telemetry readout with a time-to-closest-approach countdown, and export the ninety-minute forward projection to CSV for independent analysis.]`
>
> **[ADVANCE]**

---

## Slide 9 — Results: Physics Engine Validation ⭐

> Now the results. This table is the core validation of the paper.
>
> We reset the simulation to the 2009 event. Time zero is the tenth of February, sixteen fifty-six UTC.
>
> **[POINT the table]**
> Both objects at seven hundred and eighty-eight point six kilometres altitude, at seventy-two and a half degrees north and ninety-eight degrees east — over Siberia. Iridium at seven point four six kilometres per second; Cosmos at seven point four two.
>
> Notice the covariance determinants differ. Two point four times ten to the fourth square kilometres for Iridium; four point one for Cosmos. Cosmos 2251 was a derelict object, tracked less precisely, so its uncertainty volume is larger. That asymmetry matters to the result.
>
> **[PAUSE]**
>
> Now the two numbers that count.
>
> The Mahalanobis distance is **one point eight four**. These two objects were less than two standard deviations apart in uncertainty space — while their geometric centres suggested a comfortable miss.
>
> And the resulting probability of collision is **four point two times ten to the minus three**. Against a threshold of one times ten to the minus four, that is forty-two times over. The system classifies it as a critical alert.
>
> **[POINT figure 2]**
> On the right, figure two shows the reconstructed Euclidean distance through the encounter. Note the sharp cusp at closest approach — that is the signature of a genuine hypervelocity conjunction, and it confirms the propagation is behaving correctly. `[CUT: The exported data also confirms the expected inverse relationship between altitude and velocity, which is simply conservation of orbital energy.]`
>
> **[ADVANCE]**

---

## Slide 10 — Results: Machine Learning Performance ⭐⭐

> Two figures here, making one argument.
>
> **[POINT figure 3]**
> On the left, the ROC curve. We compared our Random Forest classifier against traditional deterministic thresholding on the same data.
>
> The Random Forest achieves an area under the curve of zero point nine four. Deterministic thresholding achieves zero point seven zero. The ensemble handles the non-linear relationship between velocity, altitude and positional uncertainty far better than any fixed threshold can.
>
> The feature weights are informative too — scalar velocity contributes forty percent, eccentricity twenty-five, altitude twenty, and inclination fifteen. `[CUT this sentence if behind]`
>
> **[PAUSE] [POINT figure 4]**
>
> And on the right is the single most important figure in the paper. Please look at it carefully.
>
> Those are the one-sigma and three-sigma covariance ellipses for both objects, projected onto the B-plane at time zero.
>
> Look at the centres. They are separated. By the deterministic measure, this is a miss — which is precisely what the screening systems of 2009 concluded.
>
> **[PAUSE]**
>
> Now look at the three-sigma boundaries. They overlap. Substantially.
>
> The collision lives inside that overlap.
>
> This one picture is the entire argument for why conjunction assessment has to move from scalar distance metrics to probabilistic tensor analysis.
>
> **[ADVANCE]**

---

## Slide 11 — Conclusion and Future Work

> To conclude.
>
> As Low Earth Orbit approaches critical congestion, rigid deterministic screening is no longer mathematically defensible or operationally safe.
>
> Our contribution is not a new propagator, and it is not a new classifier. It is the demonstration that you can carry full covariance through a real-time pipeline — using broad-phase spatial filtering to keep it tractable — and still hold sixty frames per second in a browser. And that when you do, you catch events that distance-based screening misses.
>
> That was validated against the 2009 Iridium–Cosmos event, where legacy algorithms predicted a safe margin and our pipeline correctly identified a critical conjunction.
>
> **[POINT FUTURE WORK]**
>
> Two directions from here. First, integrating live phased-array radar feeds so that covariance can be updated dynamically rather than relying on static element-set epochs — and I should say plainly, that is the main limitation of the present work. Second, simulating post-collision fragmentation clouds, to predict how debris disperses in the moments after an impact.
>
> **[ADVANCE]**

---

## Slide 12 — References and Thank You

> Those are the key references the work builds on.
>
> Thank you for your attention. I'm happy to take questions — particularly on the covariance modelling, the Random Forest feature set, or how the broad-phase filter interacts with the render loop.

**Then stop talking.** Let the chair open questions. Don't fill silence.

---

## Live pacing checkpoints

Glance at the clock at these three moments. If you're past the time shown, apply the next unused cut from the priority list.

| After slide | Should be at (trimmed) | Should be at (full) |
| --- | --- | --- |
| 4 — Introduction | **3:30** | 4:08 |
| 7 — Mathematics | **8:30** | 10:20 |
| 10 — Results II | **12:00** | 14:23 |

Slide 7 is the checkpoint that matters. If you reach the end of the maths past **9:00**, cut something in slides 8 and 11 rather than rushing the results — the results are the payoff and they need their air.

## If you're running ahead

- Slide 7, step 2 — add: *"For a linear map y equals J x, the covariance of y is J C J-transpose. It's the multivariate generalisation of variance of a-x equals a-squared variance of x."*
- Slide 9 — add the physical cross-check: *"Circular orbital velocity at that altitude works out to exactly seven point four six kilometres per second, which matches Iridium's measured value — a useful confirmation that the propagation is sound."*
- Slide 10 — add: *"The classification matrix was seven forty-five, forty-five, twenty-five and one eighty-five across orbital debris and active payloads."*

---

## Delivery notes

- **Vary your pace.** Slow on slides 4, 7, 9, 10. Brisk through 2, 3, 5, 12. Uniform pace is what makes technical talks hard to follow.
- **Say numbers as words.** "Four point two times ten to the minus three", not "four point two e minus three".
- **Pronounce it** *mah-ha-LA-no-bis*.
- **Never read a bullet aloud.** The audience reads faster than you speak. Say something *about* the bullet.
- **The three pauses that matter:** after "completely wrong" (slide 4), after "They collided" (slide 4), and before "Now look at the three-sigma boundaries" (slide 10). Silence does the work there.
- **If you lose your place**, go to [[Presentation Prep#1. If you remember nothing else]] — that paragraph gets you back on the rails from anywhere.
- **Online delivery:** look at the camera, not the slides, on the three pause moments. Everywhere else, watching your own slides is fine and natural.

---

## Q&A drill — precise answers, expanded set

> This builds on [[Presentation Prep#6. Q&A preparation]]. That file has the three risk tiers and the near-certain questions; everything below is either **new** (not asked there) or the **same question answered more precisely**. Every number here traces to [[ORCAS Research Paper]] or [[Glossary]] — where it doesn't, that's flagged explicitly rather than filled in.

### New questions

**Q1 — "Your title says 'Covariance Intersection.' But `C_c = C_p + C_s` is just addition. Is that actually the Covariance Intersection algorithm?"**

> ⚠️ The sharpest naming question you can get. Answer precisely, don't dodge.
> "Strictly, no — the classical Covariance Intersection algorithm, from Julier and Uhlmann, is a specific convex-combination fusion rule, `C = (ω C_p⁻¹ + (1−ω) C_s⁻¹)⁻¹` optimised over `ω`, designed for the case where the *correlation* between two estimates is unknown. That matters when two estimates share a common information source. Here, Iridium 33 and Cosmos 2251 are tracked completely independently — different sensors, different histories — so their errors are uncorrelated by construction, and simple addition of covariances is the exact, correct combination in that case, not an approximation. The paper's title uses 'covariance intersection' in the broader sense common in the conjunction-assessment literature — combining two objects' uncertainty ellipsoids to reason about overlap — rather than invoking the specific Julier–Uhlmann algorithm by name. Worth being upfront about that distinction if pressed."

**Q2 — "Why a 3×3 position-only covariance? Why not a 6×6 state covariance including velocity uncertainty?"**

> "That's a real simplification, and a fair one to name. Velocity uncertainty does contribute to how the encounter geometry evolves, and a full 6×6 state covariance — position plus velocity, with their cross-correlations — is what operational systems like NASA CARA actually propagate. This paper works with positional covariance at the moment of closest approach, which is standard in the B-plane formulation because by definition TCA is where the relative velocity is (locally) perpendicular to the miss vector, so it's the positional uncertainty in that instant that determines whether they touch. Carrying full 6×6 state covariance through the whole pipeline is a reasonable direction for future work, and it would tighten the covariance transport step rather than change the underlying method."

**Q3 — "Does it matter which satellite you call 'primary' and which 'secondary'? Would swapping them change P_c?"**

> "No — and that's a good consistency property to check. `C_c = C_p + C_s` is symmetric in the two objects. The B-plane is defined relative to the relative velocity vector, whose direction flips sign under swap but whose perpendicular plane doesn't change. The miss-distance vector's magnitude is unchanged. So `P_c` is invariant under which object you label primary. If it weren't, that would be a bug, not a design choice."

**Q4 — "What happens if `C_B` is singular or badly conditioned — can you even invert it for `D_M`?"**

> "In practice this doesn't come up for physically real tracked objects — a singular covariance would mean zero uncertainty along some direction, which isn't physically realistic for anything derived from noisy tracking. Real covariance matrices from orbital determination are close to diagonal-dominant and well-conditioned, just anisotropic — much larger along-track than cross-track, typically. If you want the honest caveat: numerical robustness for edge-case inputs is an implementation-hardening question for the rebuilt backend, not something the paper's formulation needed to solve, and I'd rather say that than invent a regularisation scheme I haven't verified is in the code."

**Q5 — "Why Random Forest and not a neural network for severity classification?"**

> "Three reasons, in order of weight. First, the dataset behind the confusion matrix sums to 1,000 samples — that's a tabular, moderate-size dataset, exactly the regime where tree ensembles typically outperform or match neural networks without needing thousands more labelled examples. Second, Random Forest gives you feature importance for free — the Gini weights, velocity 0.40, eccentricity 0.25, altitude 0.20, inclination 0.15 — which a neural network would need a separate post-hoc method like SHAP to approximate. Third, tabular features with mixed physical scales don't need the representation learning a neural network is built for; there's no image or sequence structure to exploit here."

**Q6 — "The confusion matrix 745 / 45 / 25 / 185 is labelled 'orbital debris vs active payload.' Is that the same model as the ROC AUC 0.94 conjunction-severity classifier?"**

> ⚠️ **Precision matters here — don't conflate two different models under pressure.**
> "No — these are two different classification tasks. The AUC 0.94-vs-0.70 comparison is the conjunction-severity classifier: given a candidate pair, is this conjunction dangerous or not. The confusion matrix you're quoting is explicitly labelled debris-versus-payload — that's the *object* classifier, deciding what kind of thing an orbital object is, which feeds into the physics separately (a derelict payload like Cosmos 2251 gets a different, generally larger, tracked-uncertainty profile than an actively maintained satellite like Iridium 33 — which is exactly why their `det(C)` values differ, 2.4×10⁴ versus 4.1×10⁴ km²). If someone asks you to reconcile the two numbers as if they describe the same model, correct that assumption before answering."

**Q7 — "Where does the `P_c > 1.0 × 10⁻⁴` threshold come from? Is that in a written standard?"**

> "It's the operational decision threshold widely used in the conjunction-assessment field as the point where an active analysis or manoeuvre discussion is warranted — it appears repeatedly across the CA literature this paper builds on. I'd stop short of naming a specific agency policy document from memory rather than risk misattributing it — if pressed for the exact source, that's a 'let me confirm and follow up' rather than a guess."

**Q8 — "For the 2009 reconstruction, what exactly did you feed the model — real historical numbers, or something synthetic?"**

> "Split it precisely. The *orbital states* — position, velocity, altitude, latitude/longitude — come from real declassified element sets for both objects at that epoch; that part is entirely historical and is what makes the propagation itself a genuine reconstruction. The *covariance matrices* are the modelled part — TLEs carry no uncertainty information at all, so the positional uncertainty has to be parameterised from the orbital regime and how old the element set was. That's the one place synthetic input enters, and it's precisely the paper's stated limitation and the motivation for the radar-integration future work."

---

## Math self-test

> Try each one yourself before expanding the answer — that's the point of doing this the night before. Click the callout to reveal. Everything below either derives directly from [[ORCAS Research Paper#Method chain]] or computes a real number from the Table I values — nothing here is invented.

> [!question]- 1. Show that `D_M = √(rᵀ C_B⁻¹ r)` is dimensionless.
> `r` is a position vector in km. `C_B` is a covariance matrix with entries in km² (variance), so `C_B⁻¹` has entries in km⁻². Then `rᵀ C_B⁻¹ r` has units `km · km⁻² · km = km⁰` — dimensionless. The square root of a dimensionless quantity is dimensionless. That's why `D_M` is expressed "in sigma," not in any distance unit — it's a pure ratio of separation to uncertainty.

> [!question]- 2. Why is the B-plane projection matrix `P` sized 2×3, and not 3×2?
> `P` has to take a 3-dimensional covariance down to a 2-dimensional one. In `C_B = P · C_c · Pᵀ`, `C_c` is 3×3. For `P · C_c` to be valid matrix multiplication, `P` needs 3 columns — so `P` is `(something)×3`. For the final result `C_B` to be the 2×2 covariance on the B-plane, `P` needs 2 rows. So `P` is 2×3, and `Pᵀ` (3×2) closes the multiplication: `(2×3)(3×3)(3×2) → 2×2`. A 3×2 `P` would produce a 3×3 output — it wouldn't reduce the dimension at all.

> [!question]- 3. Derive `Cov(y) = J·Cov(x)·Jᵀ` for a linear map `y = Jx`.
> By definition, `Cov(y) = E[(y − E[y])(y − E[y])ᵀ]`. Since `y = Jx`, `E[y] = J·E[x]`, so `y − E[y] = J(x − E[x])`. Substituting: `Cov(y) = E[J(x−E[x])(x−E[x])ᵀJᵀ] = J·E[(x−E[x])(x−E[x])ᵀ]·Jᵀ = J·Cov(x)·Jᵀ`, pulling the constant matrices `J` and `Jᵀ` out of the expectation. This is exactly the multivariate generalisation of the scalar identity `Var(aX) = a²Var(X)` — here the "a²" splits into `J` on the left and `Jᵀ` on the right because `Cov` is a matrix, not a scalar.

> [!question]- 4. Why is `J` in `C_ECEF = J·C_ECI·Jᵀ` just a rotation matrix, computed in closed form, rather than a numerically-estimated Jacobian?
> A Jacobian only needs numerical estimation when the underlying map is nonlinear — you'd linearise it locally. The ECI→ECEF transform is a *pure rotation* about Earth's polar axis by the GMST angle `θ(t)`: `x_ECEF = R_z(θ) x_ECI`. That map is already linear, so its own Jacobian is just itself: `J = R_z(θ)`, a standard 3×3 rotation matrix built directly from `sin θ` and `cos θ` — no differentiation required, no approximation, exact at every instant.

> [!question]- 5. Compute `exp(−D_M²/2)` for `D_M = 1.84`, and explain what that number means physically.
> `D_M² = 1.84² = 3.3856`. `exp(−3.3856/2) = exp(−1.6928) ≈ 0.184`. This is not itself `P_c` — it's the ratio of the Gaussian probability *density* at the collision point (the origin) to the peak density at the mean of the combined distribution. Look at the paper's own integral: for a small target circle of area `πR²`, `P_c ≈ (R²/(2√|C_B|))·exp(−D_M²/2)` — the target-size and covariance-scale terms set the overall magnitude, and `exp(−D_M²/2)` is the multiplicative penalty for how far the collision point sits from the mean. At `D_M = 1.84`, that penalty is only ~0.18 — meaning the density has barely decayed from its peak. For a conjunction genuinely safe by orders of magnitude, `D_M` typically runs into the tens, and this factor would be astronomically small (`exp(−50²/2)` is effectively zero). A `D_M` of 1.84 says the "miss" sits almost inside the bulk of the probability cloud — which is precisely why it resolves to a `P_c` two orders of magnitude over threshold rather than a comfortable miss.
> *(Don't try to reverse-engineer the exact `4.2 × 10⁻³` from this — that needs the true `R` and `|C_B|`, which aren't both stated precisely enough in the vault to reconstruct. Use this to explain the shape of the relationship, not to re-derive the paper's number live.)*

> [!question]- 6. Verify Iridium 33's stated velocity, 7.46 km/s, from first principles.
> Circular orbital velocity: `v = √(GM/r)`, with `GM_Earth ≈ 398,600 km³/s²` and orbital radius `r = R_Earth + altitude ≈ 6,371 + 788.6 = 7,159.6 km`. `GM/r = 398,600 / 7,159.6 ≈ 55.67`. `√55.67 ≈ 7.46 km/s.` Matches the table exactly — a clean confirmation that Iridium 33 was in a near-circular orbit and that the propagation is physically consistent. Cosmos 2251's slightly lower 7.42 km/s is consistent with a marginally non-circular (elliptical) orbit at the same altitude.

> [!question]- 7. Dimensional-analysis check: a 3×3 position covariance matrix has variance entries in km². What units should its determinant carry — and does that match the paper's stated `det(C)` in km²?
> The determinant of an `n×n` matrix scales as the product of its `n` eigenvalues, so for a 3×3 covariance with variance units of km² throughout, `det(C)` should carry units of `(km²)³ = km⁶` — not km². The vault and the paper both state `det(C)` in km². **This is worth flagging honestly rather than resolving with a guess:** it likely means the reported quantity is a reduced or effective representation — e.g. a 2×2 projected covariance, or a per-axis standard-deviation-based figure — rather than the raw determinant of the full 3×3 matrix, but that specific definition isn't spelled out in the material available here. If a reviewer pushes on this exact point: *"That's a fair dimensional-analysis catch — I'd want to check the precise matrix definition in the source data before answering with confidence rather than guess at it now."* That answer costs nothing and is exactly the right move — see [[Presentation Prep#If you genuinely don't know]].

> [!question]- 8. The confusion matrix is 745 / 45 / 25 / 185, unlabelled as to which cell is which. What can you still say with confidence, and what can't you?
> The four numbers sum to 1,000. The only pairing of two cells as "correct" that produces a plausible classifier is `745 + 185 = 930` → **93.0% accuracy** — the other two possible pairings (`745+25=770`→77%, or `45+185=230`→23%) would imply a classifier worse than the reported AUC of 0.94 makes plausible, so 93.0% is the pairing forced by consistency with the rest of the reported results, not an arbitrary choice. Taking the natural reading further — `745` true negatives, `45` false positives, `25` false negatives, `185` true positives — gives precision `185/(185+45) = 80.4%`, recall `185/(185+25) = 88.1%`, F1 `≈ 84.1%`. **State the accuracy with confidence; state precision/recall/F1 with the caveat that the exact cell ordering isn't confirmed from the source table**, only inferred as the sole self-consistent reading.

---

**Test-day discipline:** for Q7 and the dimensional-analysis item above, the correct move under pressure is the same line from [[Presentation Prep#If you genuinely don't know]] — *"I'd want to verify that precisely rather than guess — can I follow up?"* A confident wrong derivation in front of a room that includes ICSSIT-1818 (the covariance-structure paper immediately after yours) is a worse outcome than an honest pause.
