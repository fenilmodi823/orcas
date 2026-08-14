---
title: ORCAS Research Paper
type: research
updated: 2026-07-28
---

# ORCAS Research Paper

**Probabilistic Space Debris Conjunction Assessment Using Machine Learning and Covariance Intersection Analysis**

---

## Publication record

| | |
| --- | --- |
| Status | ✅ **Accepted — in proceedings, pending IEEE Xplore** |
| Venue | 7th International Conference on Smart Systems and Inventive Technology (ICSSIT 2026) |
| Sponsor | Technically sponsored by IEEE SMC Society and IEEE |
| Paper ID | **1849** |
| Accepted | 24 June 2026 |
| Presented | 28 July 2026, online — Parallel Session 5 (see [[Conference - ICSSIT 2026]]) |
| Length | 6 pages (proceedings pp. 1769–1774), IEEE double-column format |
| IEEE copyright | Transferred 24 June 2026 |
| Proceedings ISBN | 979-8-3315-8086-5 (DVD) · 979-8-3315-8087-2 (electronic) |
| DVD part number | CFP26P17-DVD |
| IEEE Xplore | ⚪ **Not yet indexed** — checked 28 Jul 2026, no record under this ISBN or CFP number |
| Camera-ready PDF | `C:\orcas\ICSSIT 2026 Paper (Camera-Ready).pdf` |
| Certificate of participation | `C:\orcas\ICSSIT 2026 Certificate.pdf` |
| Payment receipt | `C:\orcas\ICSSIT 2026 Receipt.pdf` — Receipt No. ICSSIT-2026-251 |

> [!warning] Wording — three distinct states, don't collapse them
> 1. **Accepted** (24 Jun 2026) — peer review passed.
> 2. **In proceedings** (confirmed 28 Jul 2026) — the camera-ready paper carries a real page range, ISBN, DVD part number and IEEE copyright line. This is genuine publication *in the conference proceedings volume*.
> 3. **Indexed on IEEE Xplore** — **not yet true**. IEEE typically uploads a conference's proceedings to Xplore weeks to a couple of months after the event closes (ICSSIT 2026 runs 28–30 Jul). Until then, say *"accepted and in the conference proceedings, not yet on IEEE Xplore"* — never just "published" unqualified, and never claim an Xplore listing that doesn't exist yet. See [[Rules#Honesty rules]].
>
> **How to check when it lands on Xplore:** search ieeexplore.ieee.org by title or by ISBN 979-8-3315-8087-2; a DOI gets assigned at indexing time; Google Scholar typically picks it up shortly after. Some conferences also email the corresponding author when the DOI is live.

### ⚠️ The other submission — Paper ID 1655, TEMSMET 2026: **REJECTED**

The same paper was also under review at **IEEE TEMSMET 2026** (Symbiosis Institute of Technology, Hyderabad, 28–30 Oct 2026) as **Paper ID 1655**, via Microsoft CMT.

| | |
| --- | --- |
| Decision | ❌ **Reject** — 12 August 2026 |
| Track | Track 2: Artificial Intelligence, Data Science & Cybersecurity Governance |
| Subject area on file | *Image/Video Processing, Object Detection & Recognition* |
| Reviewer comments | Available in the Microsoft CMT portal |
| TPC decision | Stated as final |

**This does not affect ICSSIT 2026 / Paper 1849 in any way.** That paper is accepted, presented, and in the published proceedings. Two different venues, two different outcomes, one piece of work.

> [!note] Two things worth recording honestly
> **1. The venue fit was poor, and that is visible in the metadata.** TEMSMET is a *management, marketing and entrepreneurship* conference, and the submission sat under a subject area of *Image/Video Processing, Object Detection & Recognition* — which is not what this paper does. A probabilistic orbital-mechanics paper reviewed by that committee under that subject area was mismatched before anyone read it. The same work passed peer review at ICSSIT, a smart-systems venue, and is in its proceedings. Read the reviewer comments in CMT for anything substantive, but a reject from a badly-matched venue is weak evidence about the science.
>
> **2. Concurrent submission is a real risk, and this outcome closed it.** 1655 was still "Awaiting Decision" at TEMSMET on 10–11 Aug, while 1849 had already been presented (28 Jul) and published in the ICSSIT proceedings. Submitting the same manuscript to two venues at once is prohibited under [IEEE author ethics](https://conferences.ieeeauthorcenter.ieee.org/author-ethics/ethical-requirements/), and had TEMSMET *accepted*, this would have been a genuine dual-publication problem requiring an immediate withdrawal. It resolved itself. **Going forward: one venue at a time, and withdraw from any pending venue the moment a paper is accepted elsewhere.**

### Authors

Fenil Miteshkumar Modi · Satvik V Khara · Gaurav D Tivari · Jay Patel · Prathmesh Patel · Gautam Kumawat
*Department of Computer Engineering, Silver Oak University, Ahmedabad, India*

> ⚠️ **Six authors.** Any public write-up must state Fenil's specific contribution. See [[Open-Questions]].

---

## Abstract

> The exponential proliferation of artificial satellites and the accumulation of micro-debris in Low Earth Orbit presents a critical threat to modern space infrastructure, commonly referred to as the Kessler Syndrome. Standard deterministic physics models frequently fail to predict orbital conjunctions accurately due to inherent uncertainties in radar telemetry and state vectors. This paper presents a novel, real-time tracking and prediction system that bridges high-fidelity orbital mechanics with machine learning. Utilizing a dual-engine WebGL architecture, the system propagates dynamic Earth-Centered Inertial coordinates to Geodetic spatial mappings at high frame rates using live Two-Line Element data. To address the limitations of deterministic distance calculations, a machine learning pipeline is integrated to evaluate the probability of collision and covariance intersection matrices. The accuracy of the physics engine and the necessity of the predictive model are validated through a time-decoupled historical reconstruction of the 2009 collision between the Iridium 33 and Cosmos 2251 satellites. Furthermore, the system introduces a GPU-accelerated debris swarm simulation and volumetric density heatmaps to visualize orbital congestion zones. By exporting time-series kinematic data for analysis, this system provides a scalable, enterprise-grade framework for both real-time operational tracking and academic research in space situational awareness.

---

## The argument in one paragraph

Traditional conjunction assessment computes the Euclidean distance between two predicted ephemerides at the Time of Closest Approach and alerts if it falls below a hardcoded threshold. That ignores the fact that every state vector carries uncertainty. On 10 February 2009, Iridium 33 struck Cosmos 2251 at 11.7 km/s over Siberia — and deterministic screening had not flagged it as critical. This paper replaces the distance threshold with a probability, derived by carrying each object's covariance through the whole pipeline, and shows that doing so catches the 2009 event.

---

## Method chain

```
SGP4 propagation
      │
      ▼
C_ECI                          positional covariance, inertial frame
      │  Jacobian (GMST-driven)
      ▼
C_ECEF = J · C_ECI · Jᵀ        rotate uncertainty with the Earth
      │
      ▼
C_c = C_p + C_s                combine primary + secondary at TCA
      │  P = 2×3 orthographic projection ⊥ relative velocity
      ▼
C_B = P · C_c · Pᵀ             project onto the B-plane
      │
      ├──▶ D_M = √( rᵀ C_B⁻¹ r )        Mahalanobis distance
      │
      ▼
P_c = 1/(2π√|C_B|) ∬_A exp(−½ rᵀ C_B⁻¹ r) dx dy
      │
      ▼
Random Forest classifier ──▶ P_c > 1.0×10⁻⁴ ──▶ CRITICAL CONJUNCTION ALERT
```

The double integral is not solvable analytically at 60 FPS, so the ML pipeline uses an asymptotic approximation.

**Complexity:** broad-phase spatial hashing reduces all-pairs screening from O(N²) to near O(N log N). Only survivors enter the expensive narrow-phase probabilistic stage — that is what preserves the frame budget.

---

## Headline results

### Table I — 2009 Iridium 33 / Cosmos 2251 at T₀ (2009-02-10, 16:56:00 UTC)

| Parameter | Iridium 33 (primary) | Cosmos 2251 (secondary) |
| --- | --- | --- |
| Latitude | 72.51 N | 72.51 N |
| Longitude | 97.90 E | 97.90 E |
| Altitude | 788.6 km | 788.6 km |
| Velocity `v` | 7.46 km/s | 7.42 km/s |
| Covariance `det(C)` | 2.4 × 10⁴ km² | 4.1 × 10⁴ km² |
| Mahalanobis `D_M` | — | **1.84** |
| Calculated `P_c` | — | **4.2 × 10⁻³** |
| Classification | — | **CRITICAL ALERT** |

`P_c` is **two orders of magnitude above** the 1.0 × 10⁻⁴ alert threshold. `D_M = 1.84` means the objects were under two standard deviations apart in uncertainty space — while their geometric centres suggested a comfortable miss.

### Machine learning performance

- **ROC AUC 0.94** (Random Forest) vs **0.70** (deterministic thresholds) — Fig. 3
- Feature importance (Gini): scalar velocity **0.40** · orbital eccentricity **0.25** · orbital altitude **0.20** · inclination **0.15**
- Classification matrix: 745 / 45 / 25 / 185 (orbital debris vs active payload)

### Physics engine validation

The exported 90-minute geodetic projection confirms the inverse relationship between altitude and scalar velocity — at perigee the velocity magnitude peaks, obeying conservation of orbital energy. Fig. 1.

---

## Figures

Stored in `C:\orcas\project figures\`

| Fig | File | What it shows |
| --- | --- | --- |
| 1 | `Figure_1_Orbit_Profile.png` | Orbital velocity profile vs altitude over 90 min |
| 2 | `Figure_2_Euclidean.png` | Euclidean distance during the reconstructed conjunction — sharp cusp at TCA |
| 3 | `Figure_3_ROC.png` | ROC: Random Forest AUC 0.94 vs deterministic 0.70 |
| 4 | `Figure_4_B_Plane.png` | ⭐ **B-plane covariance projection at T₀** — the 3σ ellipses overlap while the centres suggest a miss |
| — | `Approach.png` | Proposed system workflow diagram |
| — | `three_js_3d_interactive_view.png` | Live WebGL tracker |
| — | `collision_prediction_simulation.png` | Critical Conjunction Alert override |
| — | `Figure_6_6_Feature_Importance.png` | Random Forest feature weights |
| — | `confusion_matrix.png` | Classification matrix |

> **Fig. 4 is the single most persuasive image in the project.** It shows, visually, a "miss" that is provably a hit. If one image represents this research anywhere — slide, portfolio hero, OG card — it is this one.

---

## Conclusion (from the paper)

As LEO approaches critical congestion, rigid deterministic Euclidean screening is no longer mathematically viable or operationally safe. Broad-phase spatial hashing mitigated the O(N²) combinatorial explosion, enabling continuous 60 FPS propagation on a GPU-accelerated WebGL frontend. Moving from scalar metrics to probabilistic tensor analysis, the system evaluated dynamic covariance matrices and executed B-plane projections to compute an actionable P_c. Validated by time-decoupled reconstruction of the 2009 event, where legacy algorithms predicted a safe margin and the Random Forest correctly identified a critical conjunction.

## Future work

1. Integrate live phased-array radar feeds to update covariance matrices dynamically, reducing reliance on static TLE epochs
2. Simulate post-conjunction fragmentation clouds to predict immediate orbital dispersion of micro-debris after a hypervelocity impact

---

## Known limitations

Worth being ready to discuss — see [[Conference - ICSSIT 2026#Likely Q&A]]:

- TLEs do not publish covariance; the matrices are modelled for the reconstruction
- The P_c integral is approximated, not solved
- 60 FPS validated on RTX 5060 / Ryzen 9 class hardware
- The historical reconstruction is a single event, not a statistical benchmark

---

## Related documents

| Document | Location |
| --- | --- |
| Full B.Tech report (15 MB) | `C:\orcas\Report - Orbital Risk and Conjunction Assessment System.docx` |
| Abstract | `C:\orcas\Abstract - ...docx` |
| Project presentation | `C:\orcas\Presentation - ...pptx` |
| Supporting research report | `C:\orcas\Research Report - Orbital Mechanics...docx` |
| Reference PDFs (4) | `C:\orcas\orcas related research\` |
| Conference deck | `C:\orcas\ORCAS - ICSSIT 2026 Presentation.pptx` |

---

**Related:** [[Conference - ICSSIT 2026]] · [[Glossary]] · [[Architecture]] · [[PRD]] · [[Rules]]
