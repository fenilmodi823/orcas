---
title: Prompting
type: meta
updated: 2026-07-27
status: active
---

# Prompting

> ⚠️ **Examples updated 2026-07-27** for the restructure. The principles were sound; the examples referenced a portfolio and a window manager that no longer exist.

How to talk to an AI agent about ORCAS so you get useful work instead of plausible-sounding filler.

**Related:** [[Rules]] · [[memory]] · [[Git-Workflow]] · [[Home]]

---

## The session opener

Paste this at the start of any new agent session:

```
Read ORCAS Vault/00 - Meta/memory.md first, then
ORCAS Vault/00 - Meta/Rules.md.

Confirm in two lines what you understand the current state to be
before doing anything else.
```

That one paragraph replaces about thirty thousand tokens of re-reading. It is the entire reason [[memory]] exists.

---

## Anatomy of a good prompt

Five parts. Skip any and you get guesswork.

```
1. CONTEXT      which part of ORCAS, and which vault note governs it
2. TASK         one verb, one outcome
3. CONSTRAINTS  what must be true when it's done
4. OUTPUT       file path, format, length
5. CHECK        how you'll know it worked
```

### Weak
> "Build the propagation service."

### Strong
> **Context:** ORCAS backend, [[Phases]] Phase 1. Governed by [[Architecture#Backend structure]] and [[Rules]].
> **Task:** Build `app/domain/propagation.py`.
> **Constraints:** Pure module — no I/O, no FastAPI import, no database. Wraps `sgp4`. Every function states units and reference frame in its docstring. Custom exception types for propagation failure. Full type hints; must pass `mypy --strict`.
> **Output:** One module plus `tests/unit/test_propagation.py`.
> **Check:** Propagating the 2009 Iridium 33 TLE at T₀ reproduces altitude 788.6 km and velocity 7.46 km/s.

The second is longer to write and roughly ten times cheaper to fix.

---

## Rules for this project

### 1. Name the governing note
"Per [[Design#Colour]]" beats "use the dark theme". The vault is the spec — point at it.

### 2. One task per prompt
"Build the ingestion worker **and** the schema **and** the endpoint" produces three mediocre things. Chain them.

### 3. State what must NOT change
Agents refactor things nobody asked them to touch. Say "don't modify anything under `app/domain/`".

### 4. Ask for the plan before the code
> "Before writing anything, list the files you'll create or modify and why. Wait for my go-ahead."

Catches wrong-direction work at zero cost.

### 5. Demand honesty about uncertainty
> "If you're not certain a number is correct, say so rather than picking a plausible one."

Critical here — see [[Rules#Honesty rules]]. An agent that invents an AUC value or a catalogue count does real damage.

### 6. Give the failure mode, not just the goal
> "`norad_id` must be VARCHAR. Catalog numbers exceeded five digits on 2026-07-11 and Alpha-5 encoding is alphanumeric — an INTEGER column will break on real data."

Telling the agent the trap is worth more than telling it the target.

### 7. Ask for verification, not assurance
> "Then run `docker compose run --rm backend pytest` and paste the output."
> "Then render the scene and take a screenshot."

"It should work now" is not evidence.

### 8. Close with `/sync`
See [[Rules#The /sync command]].

---

## Reusable templates

### Build a backend module
```
Context: ORCAS backend, Phase <n>. Governed by [[Architecture]] and [[Rules]].
Task: Build <path>.
Constraints:
  - Layer: <domain | services | api | infra> — respect the import rules in
    [[Architecture#Backend structure]]
  - Full type hints; mypy --strict must pass
  - Docstrings state units and reference frames for any physics
  - Custom exception types, no bare except
Do not modify: <paths>
Output: the module + its tests
Check: <observable outcome, ideally a real number from the paper>
```

### Build a frontend component
```
Context: ORCAS frontend, Phase 4. Governed by [[Architecture#Frontend structure]] and [[Design]].
Task: Build <path>.
Constraints:
  - TypeScript strict, named export, under 250 lines
  - Colours only from styles/tokens.css
  - If it's in scene/: no React state per frame — refs + useFrame
  - If it's in ui/: never import from scene/ — go through state/
  - Respects prefers-reduced-motion
Do not modify: <paths>
Check: <observable outcome>
```

### Port from the old frontend
```
Port <component> from frontend-three/src/App.jsx into <destination>.
Structure per [[Architecture#Frontend structure]].
Convert inline style objects to Tailwind using tokens from [[Design#Colour]].
Convert to TypeScript, strict.
⚠️ Preserve the physics behaviour EXACTLY — do not "improve" or "simplify" any
   satellite.js call. frontend-three is the only implementation with real SGP4.
List anything you changed semantically, and why.
```

### Write user-facing content
```
Write <section>.
Audience: see [[PRD#Target users]].
Every factual claim must trace to [[ORCAS Research Paper]] or to code in the repo.
Do not round, rephrase or improve any number.
Tone: precise, not promotional — [[Branding#Voice]].
Length: <n> words.
Flag anything you couldn't verify instead of writing around it.
```

### Debug
```
Symptom: <what you see>
Expected: <what should happen>
Already tried: <list>
Relevant files: <paths>
Diagnose before changing anything. Tell me the cause, then propose the fix.
```

### Review
```
Review <paths> against [[Rules]].
Report only real problems, ordered by severity.
For each: what's wrong, why it matters, the smallest fix.
Do not change any code in this pass.
```

---

## Anti-patterns

| ❌ | Why it fails |
| --- | --- |
| "Make it look better" | No definition of better. You get someone else's taste. |
| "Fix all the bugs" | Unbounded. The agent invents bugs to fix. |
| "You're the expert, decide" | Fine on architecture. Never on *your* research claims. |
| "Just make it work" | Produces the shortest path to something that *appears* to work — which is exactly how `frontend-3d` ended up with a fake propagator. |
| Pasting an error with no context | The agent patches the symptom |
| Accepting "should work now" | Ask for evidence |

---

## Context economy

Agents lose accuracy as context fills. Protect it:

- **[[memory]] first, always** — it is the compressed state of the project
- Point at a specific note and heading, not the whole vault
- Ask for file paths and diffs, not full file dumps
- Start a fresh session for a new phase, opening with `/sync`-updated memory
- Long tool output (large JSON, container logs) goes to a file and is queried, never pasted
