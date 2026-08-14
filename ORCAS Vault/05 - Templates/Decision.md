---
title: Decision
type: template
updated: 2026-07-27
---

# ADR-{{NNN}} — {{Title}}

> Template for recording a decision that would be expensive to reverse or confusing to rediscover. Copy into `07 - Decisions/` as `ADR-001-short-title.md`.
> Small choices belong in [[Open-Questions#Decided]]; this is for the ones with teeth.

**Date:**
**Status:** Proposed | **Accepted** | Superseded by ADR-___
**Deciders:**

---

## Context

*What situation forced a decision? What constraints were real — audience, budget, timeline, existing code?*

---

## Options considered

### Option A —

**For:**
**Against:**

### Option B —

**For:**
**Against:**

### Option C —

**For:**
**Against:**

---

## Decision

*What was chosen, stated plainly.*

## Why

*The reasoning. This is the part future-you actually needs — not what was decided, but why the alternatives lost.*

---

## Consequences

**Accepted costs:**
-

**What this makes easier:**
-

**What this makes harder:**
-

**Reversal cost:** *cheap / moderate / expensive — and what specifically would have to change*

---

## Affects

- [[ ]]

---

<!--
Example, for reference:

# ADR-001 — Rebuild the backend rather than repair it

Status: Accepted · 2026-07-27

Context: The existing FastAPI backend is unreliable. Options were incremental
repair or a clean rebuild. The research code (Skyfield, sgp4, scikit-learn)
is Python and is not worth reimplementing.

Decision: Rebuild from scratch, in Python + FastAPI. Keep the language, discard
the code. The old backend is frozen immediately and deleted only in Phase 6,
after parity is proven.

Why: The instability was architectural, not linguistic — network I/O inside
request handlers, no layering, config scattered across modules, no tests.
Incremental repair would have meant restructuring every file anyway, while
carrying the old assumptions. Changing language instead would have meant
reimplementing peer-reviewed physics, introducing new bugs for no benefit.

Consequences: no working backend until Phase 1 completes, which is why the
frontend is architected to boot from a static snapshot and never depend on the
API. Accepted deliberately — that constraint also makes the product resilient
in production.

-->
