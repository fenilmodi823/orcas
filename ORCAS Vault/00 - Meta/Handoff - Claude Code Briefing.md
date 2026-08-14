---
title: Handoff — Claude Code Briefing
type: meta
updated: 2026-08-13
status: ready
---

# Handoff — Claude Code Briefing

> Paste the block below into a fresh Claude Code session in `C:\VS Code\orcas`. It orients the agent, states what changed, and hands it the next action.
> Keep this note updated whenever the state changes materially — it is the "catch up a new agent in 60 seconds" document.

**Related:** [[memory]] · [[Prompt - Simulation Restructure]] · [[Stack]] · [[Phases]] · [[Rules]]

---

## The message

```text
Hi Claude. Picking up the ORCAS project. Before doing anything, read these two
files in order, then confirm in two lines what you understand the current state
to be:

  1. ORCAS Vault/00 - Meta/memory.md      ← current state, read first
  2. ORCAS Vault/00 - Meta/Rules.md       ← the working contract

Here's the situation, so you can orient fast.

═══════════════════════════════════════════════════════════════
WHAT ORCAS IS
═══════════════════════════════════════════════════════════════

An interactive space-simulation platform with a peer-reviewed conjunction-
assessment engine underneath. Instead of measuring the distance between two
satellites and alerting below a threshold, it carries each object's positional
uncertainty (its covariance matrix) through the whole pipeline and computes an
actual probability of collision.

The validation: on 10 Feb 2009, deterministic screening predicted Iridium 33 and
Cosmos 2251 would miss by over 500 m. They collided at 11.7 km/s. ORCAS
reconstructs the event from historical element sets and correctly flags it as
critical — D_M = 1.84, P_c = 4.2e-3, forty-two times the alert threshold.

There's an accepted IEEE-sponsored paper behind it. It is in the ICSSIT 2026
proceedings (pp. 1769-1774, ISBN 979-8-3315-8087-2), presented 28 Jul 2026, and
NOT yet indexed on IEEE Xplore. Say "accepted, presented, in the conference
proceedings" — never bare "published", never claim an Xplore listing.

Six authors. Fenil is first author and did all the implementation, which can be
claimed specifically — but never write "sole author" or "solo project".

═══════════════════════════════════════════════════════════════
THE BIG STRUCTURAL DECISION (2026-08-13)
═══════════════════════════════════════════════════════════════

The project split into two properties, and they SWAPPED ROLES from what older
docs say:

  PORTFOLIO   — the shipped public product. Astro 5. Deploys to Cloudflare
                Pages. Ships FIRST. Lives in its OWN separate folder/repo,
                which does not exist yet.

  SIMULATION  — a personal tool. THIS folder. Runs on localhost via
                docker compose. NEVER deployed. No deadline.

Why this matters to you: most free-tier constraints written in this vault
applied to the simulation and NO LONGER APPLY. No 0.5 GB database ceiling, no
25 MiB texture cap, no cold starts, and data/ (124 MB) can be used freely on
local disk. Only the portfolio — a static site — carries deployment limits.
Don't reintroduce the old constraints.

═══════════════════════════════════════════════════════════════
STACK — settled, see ORCAS Vault/03 - Engineering/Stack.md
═══════════════════════════════════════════════════════════════

  Portfolio            TypeScript  ·  Astro 5 (React islands)
  Portfolio demo       TypeScript  ·  React 19 + R3F island
  Simulation frontend  TypeScript  ·  React 19 + R3F + Vite
  Simulation backend   PYTHON 3.12 ·  FastAPI
  Shared physics       TypeScript  ·  pure, framework-free

Two languages, one HTTP boundary. Python is non-negotiable for the backend: the
.joblib classifier, scipy.spatial.cKDTree and the NumPy/SciPy covariance maths
ARE the research. Retraining the model in another framework would mean the
paper's AUC 0.94 no longer describes the shipped code. Don't propose unifying
on TypeScript.

═══════════════════════════════════════════════════════════════
OTHER DECISIONS ALREADY MADE — don't relitigate these
═══════════════════════════════════════════════════════════════

  OMM is the canonical orbital-data format. TLE is a legacy import adapter
    only. CelesTrak exhausted 5-digit catalog IDs on 2026-07-11. Store
    norad_id as VARCHAR, never INTEGER. Both propagators take OMM natively:
    satellite.js json2satrec() (v6+) and Python sgp4 omm.initialize().
  No Redis. In-process cache behind a CacheService interface. Four compose
    services, not five.
  ~30-50 curated 3D models in three tiers; class-generic for everything else.
  Debris swarm ships, labelled unmistakably as simulation, with
    source_type="simulation" barring it from the screening pipeline.
  frontend-3d has FAKE physics (angle += speed, no satellite.js import).
    It is deleted, nothing salvaged. frontend-three is the real one.

═══════════════════════════════════════════════════════════════
REPO AUDIT — two corrections to what the vault used to say
═══════════════════════════════════════════════════════════════

I audited this folder on disk. Two findings that contradict older notes:

  GOOD: backend/.env was NEVER committed. `git ls-files` finds no .env. It
        exists in the working tree only. Older notes called this a High-severity
        "secret going public" — that was wrong. Rotate the NASA key as hygiene,
        but it is not urgent and not blocking.

  BAD:  data/ IS committed — 117 files including de421.bsp. 47 commits,
        217 MiB pack. .gitignore cannot undo that.

Also: the vault's repo-layout section listed 8 top-level items; there are 20+.
Notably data_analysis/generate_ml_plots.py GENERATES THE PAPER'S FIGURES and was
undocumented. Do not delete it as clutter.

═══════════════════════════════════════════════════════════════
YOUR NEXT TASK
═══════════════════════════════════════════════════════════════

Run the restructure described in:

    ORCAS Vault/00 - Meta/Prompt - Simulation Restructure.md

It restructures THIS folder in place with fresh git history (bundle-archive the
47 commits, rm -rf .git, re-init). It has three mandatory stop-and-confirm
checkpoints. Follow them — do not run it end to end without pausing.

Note: ORCAS Vault/00 - Meta/Prompt - Phase 0 Scaffold.md is SUPERSEDED. Ignore it.

═══════════════════════════════════════════════════════════════
BOUNDARIES
═══════════════════════════════════════════════════════════════

Ask me first before: deleting anything, adding a dependency not already listed
in Rules.md, changing the stack, touching git history beyond the planned reset,
or changing any wording about the paper's publication status.

Never: overstate the research, invent a number or citation, commit secrets or
data/, imply sole authorship, or mark a task complete when it isn't.

Verify, don't assure. Run the command, print the output. "It should work now"
is not evidence.

Update ORCAS Vault/00 - Meta/memory.md before you finish the session.
```

---

## Keeping this current

Update this note when any of these change:

- the next task at the bottom
- a decision in the "don't relitigate" list
- anything discovered that contradicts the vault

The briefing is deliberately **opinionated and short**. It is not a substitute for the vault — it is the thing that gets an agent to the right vault note quickly, and prevents the three or four mistakes that a cold agent reliably makes on this project: treating the simulation as a public product, proposing a TypeScript backend, deleting `data_analysis/`, and describing the paper as "published".

---

**Related:** [[memory]] · [[Rules]] · [[Stack]] · [[Phases]] · [[Prompt - Simulation Restructure]] · [[Prompting]]
