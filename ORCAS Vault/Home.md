---
title: ORCAS — Home
type: moc
updated: 2026-07-28
---

# 🐋 ORCAS

**Orbital Risk and Conjunction Assessment System**

An interactive space simulation platform with a peer-reviewed conjunction-assessment engine underneath — plus the portfolio that presents it.

> ⚠️ **Restructured 2026-07-27**: new backend, one frontend, full containerisation.
>
> 🔴 **Split 2026-08-13 — the two properties swapped roles.** The **portfolio** is now the shipped public product and ships first; the **simulation runs locally only** and is never deployed. This removed most free-tier constraints from the simulation. Start with [[memory]], then [[Stack]].

---

## 🎯 The two tracks

| | 🌍 **Portfolio** | 🛰️ **Simulation** |
| --- | --- | --- |
| Role | ⭐ **The shipped product** | Personal tool |
| Deploys | Cloudflare Pages | ❌ `localhost` only |
| Stack | Astro 5 + TS, React island | React 19 + R3F · Python + FastAPI |
| Ships | **First — weeks** | When it's ready |
| Constraints | Free tier, SEO, mobile, a11y | Correctness. That's it. |

Shared: `packages/orcas-physics` + `orcas-scene`. Details in [[Stack]].

---

## 🚦 Status board

| Thing | Status | Note |
| --- | --- | --- |
| Research paper | ✅ **Accepted, in proceedings** | ICSSIT 2026, **Paper ID 1849**, pp. 1769–1774 — ⚪ pending IEEE Xplore |
| Conference talk | ✅ **Delivered — 28 Jul 2026** | Parallel Session 5, certificate received — [[Conference - ICSSIT 2026]] |
| *Other submission* | ❌ **Rejected 12 Aug 2026** | TEMSMET 2026, Paper ID **1655** — closed, does not affect 1849 |
| 🌍 **Portfolio site** | 🔴 **Next up** | PA1 — Astro, deploy early — [[Stack#1. Portfolio → Astro]] |
| 🌍 Shared physics package | ⚪ Not started | PA2 — one propagator, two consumers |
| 🌍 ORCAS demo island | ⚪ Not started | PA3 — few hundred objects, no backend |
| 🛰️ New backend | ⚪ Not started | P1 — [[Architecture#Backend architecture]] |
| 🛰️ Frontend consolidation | ⚪ Not started | P4 — one folder, from `frontend-three` |
| Design system | ⚪ Not started | P3 — feeds both tracks — [[Design]] |
| Simulation restructure | 🔴 **Next** | P0 — [[Prompt - Simulation Restructure]] |
| Vault | 🟢 Current | You are here |

---

## 🗺️ Map of content

### Meta — how we work
- [[memory]] — ⭐ **read first every session.** Where we left off.
- [[Rules]] — libraries, hard bans, error handling, AI boundaries, `/sync`
- [[Prompting]] — how to write prompts for this project
- [[Handoff - Claude Code Briefing]] — 📋 **paste this into a fresh Claude Code session**
- [[Prompt - Simulation Restructure]] — 🔴 **ready to run** — restructures this folder in place
- [[Prompt - Phase 0 Scaffold]] — ⚫ superseded by the above
- [[Git-Workflow]] — branches, commits, the pre-public secret audit
- [[Open-Questions]] — decisions still owed

### Product
- [[PRD]] — what we're building, for whom, the feature list
- [[Phases]] — P0 → P7 with completion criteria
- [[Data-Strategy]] — ⚠️ **the TLE deprecation**, storage, static vs dynamic, CDN

### Design
- [[Design]] — Liquid Glass, colour, typography, motion, layout
- [[Branding]] — the orca metaphor, the mark, logo animation, voice
- [[UI-Research]] — NASA Eyes analysis, glass technique, anti-patterns

### Engineering
- [[Stack]] — ⭐ **languages and frameworks**, and why the alternatives lost
- [[Architecture]] — system design, backend layering, frontend structure, data model
- [[Docker]] — containerisation, compose, the one-command rule
- [[Deployment]] — free-tier hosting, domains, pre-launch checklist

### Research
- [[ORCAS Research Paper]] — the paper, its maths, its numbers
- [[Conference - ICSSIT 2026]] — links, schedule, logistics
- [[Presentation Prep]] — 🔴 revision pack for the talk
- [[Presentation Script]] — 🔴 word-for-word script, all 12 slides
- [[Glossary]] — SGP4, TLE, OMM, B-plane, P_c, Mahalanobis, Kessler

### Templates
- [[Session Log]] · [[Decision]]

---

## ⚡ Quick facts

- **Repo:** `github.com/fenilmodi823/orcas` (MIT)
- **Paper ID:** 1849 (ICSSIT 2026) — *1655 is a different, earlier submission*
- **Headline result:** D_M = 1.84, P_c = 4.2 × 10⁻³ on the 2009 Iridium 33 / Cosmos 2251 event — which deterministic screening predicted would miss by **over 500 m**
- **ML:** Random Forest, ROC AUC 0.94 vs 0.70 deterministic
- **Catalogue scale:** ~16,200 active satellites (CelesTrak, July 2026)
- **Cost target:** ₹0 / month

---

## ⚠️ Three things that will trip you up

1. **`frontend-3d`'s physics is fake.** `angle += speed`, sine-wave velocity, no `satellite.js`. It is being deleted. `frontend-three` is the real one.
2. **TLE format is being retired.** 6-digit catalog numbers since 2026-07-11. Ingest OMM; store `norad_id` as VARCHAR. [[Data-Strategy#The TLE deprecation]]
3. **Fly.io has no free tier in 2026.** Use Render + Cloudflare. [[Deployment]]
