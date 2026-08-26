# ORCAS Portfolio Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold `orcas-portfolio`, a new Astro 5 repo at `C:\VS Code\orcas-portfolio`, and port Fenil Modi's verified single-page HTML prototype into a six-route multi-page site, applying three factual corrections the prototype's content needs before it can ship.

**Architecture:** Astro 5, static output, zero client-side framework (no React — the prototype's interactivity is plain DOM/canvas already, and the one future need for React, the real-physics PA3 demo island, is out of scope here). Content lives in two places: Astro content collections (`src/content/docs/*.md`) for the long-form case studies/résumé/CV, and typed data modules (`src/data/*.ts`) for structured lists (links, timeline, skills, research rows, phase rail). Interactive pieces (background parallax, nav, dock, overlay, GitHub fetch, mini simulation) are per-component `<script>` modules that Astro bundles and hydrates only where used — this is what gets PA1's "zero JavaScript on content pages" criterion for free, without a manual budget to police.

**Tech Stack:** Astro 5, TypeScript strict, Vitest (unit tests for the three logic-bearing modules), `@astrojs/sitemap`. No Tailwind (the design system is hand-written CSS custom properties, matching the prototype and [[Design]]'s existing token approach — adding Tailwind now would mean re-deriving utility classes for a system that's already fully specified as CSS variables).

**Spec:**

- `C:\Users\fenil\Downloads\ORCAS-Portfolio-Design-System.md` — tokens, component inventory, motion budget, rules (§5–§13)
- `C:\Users\fenil\Downloads\fenil-modi-portfolio.html` — the verified reference implementation; all porting tasks below cite exact line ranges in this file
- `C:\VS Code\orcas\ORCAS Vault\01 - Product\Phases.md` — PA1 deliverables and the reference-artefact corrections note added 2026-08-19
- `C:\VS Code\orcas\ORCAS Vault\00 - Meta\Open-Questions.md` — Q3 (approved contribution wording), Q9 (site shape, paper hosting)

## Global Constraints

- **Multi-route, not single-page.** Routes: `/` (home), `/research`, `/projects` (index), `/projects/orcas`, `/cv`, `404`. Each page is long-form — sections that were prototype anchors become real page content, not tab-switches.
- **Design tokens are verbatim** from the spec §5 — copy the `:root{...}` block exactly, no rephrasing values.
- **Cyan (`--cyan: #00E5FF`) marks only interactive/live elements.** Never decorative.
- **Every measurement (altitude, velocity, P_c, coordinates, dates in the phase rail, star/fork counts) renders in `--font-mono` with `font-variant-numeric: tabular-nums`.**
- **No file over ~250 lines.** Split Astro components by section, matching the spec's own component inventory (§12).
- **No headshot.** ([[Open-Questions#Decided]] Q9)
- **Paper hosting: an original HTML write-up + an IEEE Xplore link once indexed. Never host the camera-ready PDF.** ([[Open-Questions#Decided]] Q9) The résumé and CV PDFs ARE Fenil's own documents and may be hosted directly.
- **Contribution statement uses the Q3-approved wording verbatim** ([[Open-Questions#Decided]] Q3) — not the prototype's expanded version naming co-authors' specific roles (unverified; flagged for Fenil, not silently ported).
- **The ORCAS phase rail on `/projects/orcas` must reflect this vault's real progress table** (Phases.md, current progress section), not the prototype's invented P0–P5 scheme which claims unbuilt features (Kessler swarm, heatmaps, CSV export) as complete.
- **The reproducibility snippet in the ORCAS case study must not `git clone` a non-public repo.** State plainly that the repo isn't public yet (P6 milestone).
- **Real links only** — GitHub `https://github.com/fenilmodi823`, LinkedIn `https://www.linkedin.com/in/fenilmodi823/`, Instagram `https://www.instagram.com/fenil_modi_823/`, X `https://x.com/fenilmodi_823`, email `fenilmmodi@gmail.com`. Never invent a URL not supplied by Fenil.
- **`git init` locally is in scope for this plan. Pushing to GitHub and deploying to Vercel are NOT** — both are explicit ask-first boundaries per `CLAUDE.md`; the last task stops at a verified local production build.

---

## File Structure

```text
C:\VS Code\orcas-portfolio\
├─ package.json
├─ astro.config.mjs
├─ tsconfig.json
├─ vitest.config.ts
├─ .gitignore
├─ README.md
├─ public/
│  ├─ brand/                     (copied from orcas/frontend/public/brand)
│  ├─ fonts/                     (real woff2 files, not base64)
│  └─ files/
│     ├─ Fenil-Modi-Resume.pdf
│     └─ Fenil-Modi-CV.pdf
├─ src/
│  ├─ content/
│  │  ├─ config.ts
│  │  └─ docs/
│  │     ├─ orcas.md
│  │     ├─ paper.md
│  │     ├─ debris.md
│  │     ├─ quantum.md
│  │     ├─ diablex.md
│  │     ├─ resume.md
│  │     └─ cv.md
│  ├─ data/
│  │  ├─ links.ts
│  │  ├─ phases.ts
│  │  ├─ timeline.ts
│  │  ├─ skills.ts
│  │  ├─ research.ts
│  │  └─ interests.ts
│  ├─ lib/
│  │  ├─ orbital.ts
│  │  ├─ orbital.test.ts
│  │  ├─ markdown.ts
│  │  ├─ markdown.test.ts
│  │  ├─ github.ts
│  │  └─ github.test.ts
│  ├─ styles/
│  │  ├─ tokens.css
│  │  └─ global.css
│  ├─ layouts/
│  │  └─ BaseLayout.astro
│  ├─ components/
│  │  ├─ Background.astro
│  │  ├─ Nav.astro
│  │  ├─ Dock.astro
│  │  ├─ Plate.astro
│  │  ├─ Overlay.astro
│  │  ├─ ProjectCard.astro
│  │  ├─ PaperBlock.astro
│  │  ├─ ResearchRow.astro
│  │  ├─ SkillColumn.astro
│  │  ├─ PhaseRail.astro
│  │  ├─ RepoGrid.astro
│  │  └─ MiniSimulation.astro
│  └─ pages/
│     ├─ index.astro
│     ├─ research.astro
│     ├─ cv.astro
│     ├─ 404.astro
│     └─ projects/
│        ├─ index.astro
│        └─ orcas.astro
```

---

### Task 1: Repo scaffold

**Files:**

- Create: `C:\VS Code\orcas-portfolio\package.json`
- Create: `C:\VS Code\orcas-portfolio\astro.config.mjs`
- Create: `C:\VS Code\orcas-portfolio\tsconfig.json`
- Create: `C:\VS Code\orcas-portfolio\vitest.config.ts`
- Create: `C:\VS Code\orcas-portfolio\.gitignore`
- Create: `C:\VS Code\orcas-portfolio\README.md`

**Interfaces:**

- Produces: an installable Astro project (`npm install` succeeds), `npm run build` produces `dist/`, `npm test` runs Vitest.

- [ ] **Step 1: Create the directory and `package.json`**

```json
{
  "name": "orcas-portfolio",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run"
  },
  "dependencies": {
    "astro": "^5.1.0",
    "@astrojs/sitemap": "^3.2.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.4",
    "typescript": "^5.7.3",
    "vitest": "^3.0.4"
  }
}
```

- [ ] **Step 2: `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://orcas-portfolio.vercel.app',
  integrations: [sitemap()],
});
```

- [ ] **Step 3: `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

- [ ] **Step 4: `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

- [ ] **Step 5: `.gitignore`**

```text
node_modules/
dist/
.astro/
.vercel/
.env
.DS_Store
```

- [ ] **Step 6: `README.md`**

```markdown
# orcas-portfolio

Fenil Modi's personal/professional site. Astro 5, static output, no client framework.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # -> dist/
npm test        # unit tests for src/lib/*
npm run check   # astro + TS diagnostics
```

Design spec: see `ORCAS-Portfolio-Design-System.md` (kept alongside this repo, not committed — ask Fenil for the current copy).

```

- [ ] **Step 7: Install and verify**

Run: `cd "C:\VS Code\orcas-portfolio" && npm install`
Expected: installs without error, creates `package-lock.json`.

- [ ] **Step 8: `git init` and first commit**

```bash
cd "C:\VS Code\orcas-portfolio"
git init
git add package.json astro.config.mjs tsconfig.json vitest.config.ts .gitignore README.md
git commit -m "chore: scaffold Astro 5 project"
```

---

### Task 2: Design tokens and global styles

**Files:**

- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`

**Interfaces:**

- Produces: every custom property later components reference by name (`--void`, `--cyan`, `--glass-fill`, etc.) and two base classes (`.wrap`, `.mono`).

- [ ] **Step 1: `tokens.css` — copy the spec's §5 block verbatim**

Source: `ORCAS-Portfolio-Design-System.md`, the fenced block under "## 5. Design tokens" (the `:root{...}` block, lines 113–157 of that file). Copy every property exactly — do not round or rename a value. This is the single source of truth; if a later task needs a token that doesn't exist here, add it here first, never inline a literal.

- [ ] **Step 2: `global.css` — resets, font stacks, base scale**

```css
@import './tokens.css';

*, *::before, *::after { box-sizing: border-box; }
html { color-scheme: dark; }
body {
  margin: 0;
  background: var(--void);
  color: var(--text);
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-weight: 300;
  line-height: 1.6;
}
.mono {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}
.wrap {
  max-width: 1440px;
  margin-inline: auto;
  padding-inline: var(--gutter);
}
h1, h2, h3 { color: var(--text-hi); font-weight: 200; margin: 0; }
a { color: inherit; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Verify**

Run: `npm run build` (will fail until Task 10 provides a page importing this — acceptable at this stage; instead sanity-check with `npx astro check` for CSS syntax via `node -e "require('fs').readFileSync('src/styles/tokens.css','utf8')"` running without throwing, or simply eyeball the property count matches the spec's block (should be ~30 custom properties)).

- [ ] **Step 4: Commit**

```bash
git add src/styles/tokens.css src/styles/global.css
git commit -m "feat: design tokens and global styles"
```

---

### Task 3: Real font files (not base64)

**Files:**

- Create: `public/fonts/plus-jakarta-sans-variable.woff2`
- Create: `public/fonts/jetbrains-mono-400.woff2`
- Modify: `src/styles/global.css` (add `@font-face` rules)

**Why not base64 like the prototype:** the prototype inlined fonts because it was one file with zero HTTP requests by design. A six-page site benefits from real font files the browser caches once across all pages — inlining would duplicate ~93 KB into every page's HTML instead of fetching it once.

**Why one file for all four Plus Jakarta Sans weights, not four:** verified directly against Google Fonts' CSS2 API (`fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;700`) — weights 200/300/400/700 all resolve to the *same* underlying woff2 file, because Google serves Plus Jakarta Sans as a variable font (one binary spanning the weight axis; the browser selects the instance via the CSS `font-weight` value at render time, no separate per-weight files exist upstream). One `@font-face` with a weight range is both simpler and correct — four identical downloads would be pure duplication.

- [ ] **Step 1: Download the two font files — exact URLs, pre-verified**

```bash
curl -sL "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yw.woff2" -o public/fonts/plus-jakarta-sans-variable.woff2
curl -sL "https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOV.woff2" -o public/fonts/jetbrains-mono-400.woff2
```

Both already confirmed live and valid (2026-08-19): Plus Jakarta Sans variable — HTTP 200, 27,348 bytes, magic bytes `wOF2`. JetBrains Mono 400 — HTTP 200, 21,168 bytes, magic bytes `wOF2`. Both are the "latin" Unicode-range subset (`U+0000-00FF, U+0131, ...`), matching the design spec's own "latin subset" choice (§6). Both are open-source (OFL) — Plus Jakarta Sans via Google Fonts, JetBrains Mono via JetBrains. No new npm dependency; these are static assets fetched once at build-prep time, not installed as a package.

- [ ] **Step 2: Add `@font-face` rules to `global.css`**

```css
@font-face {
  font-family: 'Plus Jakarta Sans';
  src: url('/fonts/plus-jakarta-sans-variable.woff2') format('woff2');
  font-weight: 200 700; /* variable font — one file covers the whole weight axis */
  font-display: swap;
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/jetbrains-mono-400.woff2') format('woff2');
  font-weight: 400; font-display: swap;
}
```

- [ ] **Step 3: Verify the files exist and are valid woff2**

Run: `node -e "const fs=require('fs');['plus-jakarta-sans-variable','jetbrains-mono-400'].forEach(f=>{const b=fs.readFileSync('public/fonts/'+f+'.woff2');if(b.slice(0,4).toString('ascii')!=='wOF2')throw new Error(f+' not woff2')})"`
Expected: no output (both pass the magic-number check). Confirm sizes are close to 27,348 and 21,168 bytes respectively — a much smaller file means the download was truncated or hit an error page instead of the font.

- [ ] **Step 4: Commit**

```bash
git add public/fonts src/styles/global.css
git commit -m "feat: self-hosted font files"
```

---

### Task 4: Brand assets

**Files:**

- Create: `public/brand/*` (copy from `C:\VS Code\orcas\frontend\public\brand\`)

- [ ] **Step 1: Copy the whole folder**

Run:

```bash
cp -r "C:\VS Code\orcas\frontend\public\brand" "C:\VS Code\orcas-portfolio\public\brand"
```

Files expected (confirmed present in the source): `logo.svg`, `logo-tracks.svg`, `logo-mono.svg`, `monogram.svg`, `wordmark.svg`, `lockup-h.svg`, `lockup-v.svg`, `favicon.svg`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `og-card.svg`, `og-card.png`, `contact-sheet.svg`, `contact-sheet.png`.

- [ ] **Step 2: Wire the favicon in a shared `<head>` (done inside Task 10's `BaseLayout.astro`; this task just verifies the source files are in place)**

Run: `ls "C:\VS Code\orcas-portfolio\public\brand"`
Expected: 14 files, matching the list above.

- [ ] **Step 3: Commit**

```bash
git add public/brand
git commit -m "feat: brand assets"
```

---

### Task 5: Orbital mechanics module (TDD)

**Files:**

- Create: `src/lib/orbital.ts`
- Test: `src/lib/orbital.test.ts`

**Interfaces:**

- Produces:

  ```ts
  export interface OrbitalElements {
    name: string; regime: string;
    aKm: number; e: number; incDeg: number;
    raanDeg: number; argPeriapsisDeg: number; meanAnomalyDegAtEpoch: number;
    periodMin: number;
  }
  export interface EciKm { x: number; y: number; z: number; }
  export function keplerSolveRad(meanAnomalyRad: number, eccentricity: number): number;
  export function propagateEci(el: OrbitalElements, tSeconds: number): EciKm;
  export const CATALOG: OrbitalElements[];
  ```

- Consumed by: Task 16 (`MiniSimulation.astro`).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/orbital.test.ts
import { describe, it, expect } from 'vitest';
import { keplerSolveRad, propagateEci, CATALOG } from './orbital';

describe('keplerSolveRad', () => {
  it('solves the circular case exactly (E = M when e = 0)', () => {
    expect(keplerSolveRad(1.2345, 0)).toBeCloseTo(1.2345, 10);
  });

  it('satisfies Kepler\'s equation for an eccentric orbit', () => {
    const M = 2.1;
    const e = 0.74; // Molniya-class
    const E = keplerSolveRad(M, e);
    expect(E - e * Math.sin(E)).toBeCloseTo(M, 8);
  });
});

describe('propagateEci', () => {
  it('reproduces the ISS catalog period to within rounding (92.9 min)', () => {
    const iss = CATALOG.find((o) => o.name === 'ISS (ZARYA)');
    expect(iss).toBeDefined();
    expect(iss!.periodMin).toBeCloseTo(92.9, 1);
  });

  it('returns the object to the same position after one full period', () => {
    const iss = CATALOG.find((o) => o.name === 'ISS (ZARYA)')!;
    const periodSec = iss.periodMin * 60;
    const p0 = propagateEci(iss, 0);
    const p1 = propagateEci(iss, periodSec);
    expect(p1.x).toBeCloseTo(p0.x, 3);
    expect(p1.y).toBeCloseTo(p0.y, 3);
    expect(p1.z).toBeCloseTo(p0.z, 3);
  });

  it('keeps every catalog radius between perigee and apogee', () => {
    for (const el of CATALOG) {
      const r = Math.hypot(...Object.values(propagateEci(el, el.periodMin * 30)));
      const rPeri = el.aKm * (1 - el.e);
      const rApo = el.aKm * (1 + el.e);
      expect(r).toBeGreaterThanOrEqual(rPeri - 1);
      expect(r).toBeLessThanOrEqual(rApo + 1);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- orbital`
Expected: FAIL — `orbital.ts` does not exist yet.

- [ ] **Step 3: Implement**

Port the propagation math from `fenil-modi-portfolio.html` lines 3235–3263 (function `eci(s,t)`) and the catalog table from the design spec §14 ("Catalogue" table). The design spec's own formula block (§14, "Propagation — genuinely Keplerian") is the reference derivation:

```ts
// src/lib/orbital.ts
const MU_EARTH_KM3_S2 = 398600.4418;

export interface OrbitalElements {
  name: string;
  regime: string;
  aKm: number;
  e: number;
  incDeg: number;
  raanDeg: number;
  argPeriapsisDeg: number;
  meanAnomalyDegAtEpoch: number;
  periodMin: number;
}

export interface EciKm {
  x: number;
  y: number;
  z: number;
}

/** Solve Kepler's equation E - e*sin(E) = M for eccentric anomaly E, radians. */
export function keplerSolveRad(meanAnomalyRad: number, eccentricity: number): number {
  let E = eccentricity < 0.8 ? meanAnomalyRad : Math.PI;
  for (let i = 0; i < 12; i++) {
    const f = E - eccentricity * Math.sin(E) - meanAnomalyRad;
    const fPrime = 1 - eccentricity * Math.cos(E);
    const delta = f / fPrime;
    E -= delta;
    if (Math.abs(delta) < 1e-11) break;
  }
  return E;
}

/** Propagate a two-body Keplerian orbit to ECI position at time t (seconds after epoch). Output km. */
export function propagateEci(el: OrbitalElements, tSeconds: number): EciKm {
  const n = Math.sqrt(MU_EARTH_KM3_S2 / el.aKm ** 3); // rad/s
  const M0 = (el.meanAnomalyDegAtEpoch * Math.PI) / 180;
  const M = M0 + n * tSeconds;
  const E = keplerSolveRad(M, el.e);
  const nu = Math.atan2(Math.sqrt(1 - el.e ** 2) * Math.sin(E), Math.cos(E) - el.e);
  const r = el.aKm * (1 - el.e * Math.cos(E));

  const xPf = r * Math.cos(nu);
  const yPf = r * Math.sin(nu);

  const incRad = (el.incDeg * Math.PI) / 180;
  const raanRad = (el.raanDeg * Math.PI) / 180;
  const argPRad = (el.argPeriapsisDeg * Math.PI) / 180;

  const cosO = Math.cos(raanRad), sinO = Math.sin(raanRad);
  const cosI = Math.cos(incRad), sinI = Math.sin(incRad);
  const cosW = Math.cos(argPRad), sinW = Math.sin(argPRad);

  const x =
    (cosO * cosW - sinO * sinW * cosI) * xPf + (-cosO * sinW - sinO * cosW * cosI) * yPf;
  const y =
    (sinO * cosW + cosO * sinW * cosI) * xPf + (-sinO * sinW + cosO * cosW * cosI) * yPf;
  const z = sinW * sinI * xPf + cosW * sinI * yPf;

  return { x, y, z };
}

export const CATALOG: OrbitalElements[] = [
  { name: 'ISS (ZARYA)', regime: 'LEO', aKm: 6796, e: 0.0006, incDeg: 51.64, raanDeg: 0, argPeriapsisDeg: 0, meanAnomalyDegAtEpoch: 0, periodMin: 92.9 },
  { name: 'Hubble (HST)', regime: 'LEO', aKm: 6917, e: 0.0003, incDeg: 28.47, raanDeg: 40, argPeriapsisDeg: 0, meanAnomalyDegAtEpoch: 60, periodMin: 95.4 },
  { name: 'Sentinel-2A', regime: 'SSO', aKm: 7167, e: 0.0001, incDeg: 98.57, raanDeg: 80, argPeriapsisDeg: 0, meanAnomalyDegAtEpoch: 120, periodMin: 100.6 },
  { name: 'GPS BIIF-2', regime: 'MEO', aKm: 26560, e: 0.0002, incDeg: 55.0, raanDeg: 160, argPeriapsisDeg: 0, meanAnomalyDegAtEpoch: 200, periodMin: 718.2 },
  { name: 'GOES-16', regime: 'GEO', aKm: 42164, e: 0.0001, incDeg: 0.05, raanDeg: 0, argPeriapsisDeg: 0, meanAnomalyDegAtEpoch: 0, periodMin: 1435.8 },
  { name: 'Molniya 3-50', regime: 'HEO', aKm: 26554, e: 0.74, incDeg: 63.4, raanDeg: 260, argPeriapsisDeg: 270, meanAnomalyDegAtEpoch: 0, periodMin: 717.6 },
];
```

`raanDeg`/`argPeriapsisDeg`/`meanAnomalyDegAtEpoch` for objects other than ISS aren't in the design spec's table (§14 lists only regime/a/e/i/period) — these are reasonable illustrative values for a labelled, honest-scope demo (the page already states "elements are a labelled snapshot, not live TLEs"), not real current elements. Keep them as placeholder orbital phasing only; never present them as tracked data.

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- orbital`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/orbital.ts src/lib/orbital.test.ts
git commit -m "feat: two-body Keplerian propagation for the mini simulation"
```

---

### Task 6: Markdown renderer + sanitizer (TDD)

**Files:**

- Create: `src/lib/markdown.ts`
- Test: `src/lib/markdown.test.ts`

**Interfaces:**

- Produces: `export function renderMarkdown(src: string): string;`
- Consumed by: content collection rendering is Astro-native (`.md` files render themselves), so this module is specifically for the GitHub README viewer (Task 14's Overlay), where the source is untrusted third-party text.

- [ ] **Step 1: Write the failing tests — reuse the design spec's own verification payloads (§16, §21)**

```ts
// src/lib/markdown.test.ts
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown — sanitization', () => {
  const payloads = [
    '<img src=x onerror="alert(1)">',
    '[click me](javascript:alert(1))',
    '![x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    '<script>alert(1)</script>',
    '<div "><img src=x onerror=alert(1)>">',
    '<iframe src="javascript:alert(1)"></iframe>',
  ];

  for (const payload of payloads) {
    it(`neutralizes: ${payload.slice(0, 40)}`, () => {
      const html = renderMarkdown(payload);
      expect(html).not.toMatch(/onerror\s*=/i);
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/<iframe/i);
      expect(html).not.toMatch(/javascript:/i);
    });
  }

  it('only emits tags the renderer itself produces', () => {
    const html = renderMarkdown('# Title\n\nSome *text* with `code`.');
    const tags = [...html.matchAll(/<\/?([a-z0-9]+)/gi)].map((m) => m[1].toLowerCase());
    const allowed = new Set(['h1', 'h2', 'h3', 'p', 'em', 'strong', 'code', 'pre', 'a', 'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'hr']);
    for (const tag of tags) expect(allowed.has(tag)).toBe(true);
  });

  it('rejects a non-whitelisted URL scheme on links', () => {
    const html = renderMarkdown('[x](ftp://evil.example/payload)');
    expect(html).toContain('href="#"');
  });

  it('allows a normal https link with rel=noopener', () => {
    const html = renderMarkdown('[docs](https://example.com)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- markdown`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Port from `fenil-modi-portfolio.html` lines 2861–2949 (function `md(src)`), preserving the design spec's own stated algorithm (§16): fence-lift → full-escape → renderer-only-tags → URL allowlist (`^(https?:|mailto:|#|/)`) → `target="_blank" rel="noopener noreferrer"` on every link. Read the source function directly rather than re-deriving the parsing logic from scratch — it's already verified against six payloads (§21).

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- markdown`
Expected: PASS, all payload + allowlist tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/markdown.ts src/lib/markdown.test.ts
git commit -m "feat: sanitizing markdown renderer for README previews"
```

---

### Task 7: GitHub fetch + offline fallback (TDD)

**Files:**

- Create: `src/lib/github.ts`
- Test: `src/lib/github.test.ts`

**Interfaces:**

- Produces:

  ```ts
  export interface RepoSummary {
    name: string; description: string | null; language: string | null;
    stars: number; forks: number; pushedAt: string; url: string;
  }
  export interface GithubFetchResult { repos: RepoSummary[]; source: 'live' | 'offline-snapshot'; }
  export const OFFLINE_SNAPSHOT: RepoSummary[];
  export async function fetchPinnedRepos(user: string, pinnedOrder: string[], fetchImpl?: typeof fetch): Promise<GithubFetchResult>;
  ```

- Consumed by: Task 17 (`RepoGrid.astro`).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/github.test.ts
import { describe, it, expect, vi } from 'vitest';
import { fetchPinnedRepos, OFFLINE_SNAPSHOT } from './github';

const okRepo = (name: string) => ({
  name, description: 'd', language: 'TypeScript', fork: false,
  stargazers_count: 1, forks_count: 0, pushed_at: '2026-08-01T00:00:00Z',
  html_url: `https://github.com/fenilmodi823/${name}`,
});

describe('fetchPinnedRepos', () => {
  it('returns live data and pinned order when the API succeeds', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [okRepo('b'), okRepo('orcas'), okRepo('a')],
    });
    const result = await fetchPinnedRepos('fenilmodi823', ['orcas'], fakeFetch as unknown as typeof fetch);
    expect(result.source).toBe('live');
    expect(result.repos[0].name).toBe('orcas');
  });

  it('excludes forks', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ ...okRepo('forked'), fork: true }, okRepo('own')],
    });
    const result = await fetchPinnedRepos('fenilmodi823', [], fakeFetch as unknown as typeof fetch);
    expect(result.repos.map((r) => r.name)).not.toContain('forked');
  });

  it('falls back to the offline snapshot when the API is unreachable', async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await fetchPinnedRepos('fenilmodi823', [], fakeFetch as unknown as typeof fetch);
    expect(result.source).toBe('offline-snapshot');
    expect(result.repos).toEqual(OFFLINE_SNAPSHOT);
  });

  it('falls back to the offline snapshot on a non-OK response (rate limit)', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    const result = await fetchPinnedRepos('fenilmodi823', [], fakeFetch as unknown as typeof fetch);
    expect(result.source).toBe('offline-snapshot');
  });

  it('caps the result at six repos', async () => {
    const many = Array.from({ length: 20 }, (_, i) => okRepo(`repo${i}`));
    const fakeFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => many });
    const result = await fetchPinnedRepos('fenilmodi823', [], fakeFetch as unknown as typeof fetch);
    expect(result.repos.length).toBeLessThanOrEqual(6);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- github`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Port from `fenil-modi-portfolio.html` lines ~3019–3044 (`card()`, `paint()`, `order()`) for the pinned-order + cap-at-six logic, adapted into a pure async function (the prototype does DOM rendering inline; this module returns data only, rendering happens in Task 17's Astro component). `OFFLINE_SNAPSHOT` should contain real, current repo metadata for `orcas`, `Space-Science`, `Quantum-Enhanced-AES-Encryption`, `diablex-core`, `Projects` — ask Fenil for current star/fork counts and last-push dates rather than inventing plausible-looking numbers, or fetch them once live and hardcode that snapshot with a comment noting the date it was taken.

```ts
// src/lib/github.ts
export interface RepoSummary {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  pushedAt: string;
  url: string;
}

export interface GithubFetchResult {
  repos: RepoSummary[];
  source: 'live' | 'offline-snapshot';
}

// Snapshot taken 2026-08-19 — refresh the numbers before relying on this as "current."
export const OFFLINE_SNAPSHOT: RepoSummary[] = [
  { name: 'orcas', description: 'Probabilistic conjunction assessment for orbital debris.', language: 'Python', stars: 0, forks: 0, pushedAt: '2026-08-19T00:00:00Z', url: 'https://github.com/fenilmodi823/orcas' },
];

interface GithubApiRepo {
  name: string;
  description: string | null;
  language: string | null;
  fork: boolean;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string;
  html_url: string;
}

export async function fetchPinnedRepos(
  user: string,
  pinnedOrder: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<GithubFetchResult> {
  try {
    const res = await fetchImpl(`https://api.github.com/users/${user}/repos?per_page=100&sort=pushed`);
    if (!res.ok) return { repos: OFFLINE_SNAPSHOT, source: 'offline-snapshot' };
    const data = (await res.json()) as GithubApiRepo[];
    const owned = data.filter((r) => !r.fork);
    const toSummary = (r: GithubApiRepo): RepoSummary => ({
      name: r.name,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      pushedAt: r.pushed_at,
      url: r.html_url,
    });
    const pinned = pinnedOrder
      .map((name) => owned.find((r) => r.name === name))
      .filter((r): r is GithubApiRepo => r !== undefined);
    const rest = owned.filter((r) => !pinnedOrder.includes(r.name));
    const ordered = [...pinned, ...rest].slice(0, 6).map(toSummary);
    return { repos: ordered, source: 'live' };
  } catch {
    return { repos: OFFLINE_SNAPSHOT, source: 'offline-snapshot' };
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- github`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/github.ts src/lib/github.test.ts
git commit -m "feat: GitHub repo fetch with offline fallback"
```

---

### Task 8: Content collections — the long-form docs, corrected

**Files:**

- Create: `src/content/config.ts`
- Create: `src/content/docs/orcas.md`
- Create: `src/content/docs/paper.md`
- Create: `src/content/docs/debris.md`
- Create: `src/content/docs/quantum.md`
- Create: `src/content/docs/diablex.md`
- Create: `src/content/docs/resume.md`
- Create: `src/content/docs/cv.md`

**Interfaces:**

- Produces: `collections.docs`, each entry `{ kind: string; title: string }` frontmatter + Markdown body, queryable via `getEntry('docs', 'orcas')` / `getCollection('docs')`.
- Consumed by: Task 19 (`/research`), Task 21 (`/projects/orcas`), Task 22 (`/cv`).

- [ ] **Step 1: `src/content/config.ts`**

```ts
import { defineCollection, z } from 'astro:content';

const docs = defineCollection({
  type: 'content',
  schema: z.object({
    kind: z.string(),
    title: z.string(),
  }),
});

export const collections = { docs };
```

- [ ] **Step 2: `orcas.md` — port from prototype `docs.orcas` (lines 1927–2020), with two corrections**

Frontmatter: `kind: Case study`, `title: ORCAS — Orbital Risk and Conjunction Assessment System`.

Body: copy the prototype's content verbatim EXCEPT:

- **"Status and scope" section** — replace "Kessler swarm, density heatmaps, CSV export" from the "Done" list with what's actually built per `Phases.md`'s real progress table: SGP4 propagation, covariance/conjunction pipeline, ML classification, OMM ingestion with a legacy TLE adapter, and the golden-file reconstruction of the 2009 Iridium 33/Cosmos 2251 collision — all backend, all tested. Move Kessler swarm/heatmaps/CSV export/historical replay to "Roadmap" (they're real plans, just not built yet — see `Phases.md` line 328).
- **"Reproducibility" section** — replace the `git clone https://github.com/fenilmodi823/orcas` block with: "The repository isn't public yet — full open-sourcing is planned once the simulation reaches parity (Phase P6). It will be a one-command `docker compose up` when it opens."

- [ ] **Step 3: `paper.md` — port from prototype `docs.paper` (lines 2022–2096), with one correction**

Frontmatter: `kind: Paper`, `title: Probabilistic Space Debris Conjunction Assessment`.

Body: copy verbatim EXCEPT the "My contribution" section — replace it with the Q3-approved wording exactly:

```markdown
## My contribution

First author of *Probabilistic Space Debris Conjunction Assessment Using Machine Learning
and Covariance Intersection Analysis* (ICSSIT 2026, IEEE SMC Society). I designed and
implemented the complete system — the SGP4 propagation engine, the covariance-intersection
pipeline, the B-plane projection and P_c computation, the Random Forest classifier, and the
WebGL visualisation layer — and produced the time-decoupled 2009 Iridium–Cosmos
reconstruction that validates it.
```

Do not add characterizations of what other named co-authors specifically did (the prototype's "Khara... HOD... Tivari... faculty supervisor... remaining co-authors contributed to implementation and testing" sentence) unless Fenil explicitly confirms that wording separately — it goes beyond what `Open-Questions.md` Q3 settled.

- [ ] **Step 4: `debris.md`, `quantum.md`, `diablex.md` — port verbatim**

Source: prototype lines 2098–2129 (`debris`), 2131–2161 (`quantum`), 2163–2185 (`diablex`). No corrections needed for these three — reviewed against the vault and found no discrepancies. Frontmatter `kind`/`title` per each doc's existing `kind:`/`title:` fields in the prototype.

- [ ] **Step 5: `resume.md`, `cv.md` — port verbatim**

Source: prototype lines 2187–2262 (`resume`), 2264–2392 (`cv`). Update the contact line in both to the confirmed real links (Task 9's `links.ts` is the canonical source — cross-reference there rather than hardcoding a second copy): LinkedIn `https://www.linkedin.com/in/fenilmodi823/`, GitHub `https://github.com/fenilmodi823`, email `fenilmmodi@gmail.com`.

- [ ] **Step 6: Verify collection parses**

Run: `npx astro sync && npx astro check`
Expected: no schema errors on any of the 7 `docs/*.md` files.

- [ ] **Step 7: Commit**

```bash
git add src/content
git commit -m "feat: content collection with corrected ORCAS, paper, and resume docs"
```

---

### Task 9: Structured data modules

**Files:**

- Create: `src/data/links.ts`
- Create: `src/data/phases.ts`
- Create: `src/data/timeline.ts`
- Create: `src/data/skills.ts`
- Create: `src/data/research.ts`
- Create: `src/data/interests.ts`

**Interfaces:**

- Produces: typed arrays/objects consumed by Task 15's shared components and every page task.

- [ ] **Step 1: `links.ts` — the real links Fenil supplied**

```ts
export const LINKS = {
  github: 'https://github.com/fenilmodi823',
  linkedin: 'https://www.linkedin.com/in/fenilmodi823/',
  instagram: 'https://www.instagram.com/fenil_modi_823/',
  x: 'https://x.com/fenilmodi_823',
  email: 'mailto:fenilmmodi@gmail.com',
} as const;
```

- [ ] **Step 2: `phases.ts` — the ORCAS build's real progress, not the prototype's invented scheme**

Source: `Phases.md`'s progress table (the section near the file's end listing P0–P7 status) and `memory.md`'s "Current state." Do not reuse the prototype's `CONTENT.phases` array — it claims features complete that aren't.

```ts
export type PhaseStatus = 'done' | 'now' | 'planned';

export interface PhaseEntry {
  id: string;
  title: string;
  description: string;
  status: PhaseStatus;
}

export const ORCAS_PHASES: PhaseEntry[] = [
  { id: 'P0', title: 'Foundation', description: 'Fresh monorepo, four-service Docker stack, CI — verified running.', status: 'done' },
  { id: 'P1', title: 'Simulation backend', description: 'FastAPI, SGP4 propagation, covariance/conjunction pipeline, ML classifier, OMM ingestion, and a golden-file test reconstructing the real 2009 Iridium 33 / Cosmos 2251 collision from historical elements.', status: 'done' },
  { id: 'P2', title: 'Data layer', description: 'Ingestion, retention policy, snapshot generation, and response caching are built and verified against live data. 3D asset curation is still in progress.', status: 'now' },
  { id: 'P3', title: 'Design system', description: 'The glass token system, motion language, and UI component set — the language this site borrows from.', status: 'done' },
  { id: 'P4', title: 'Frontend consolidation', description: 'The full 3D scene: dynamic Earth, satellites, orbit paths, debris swarm and density heatmaps.', status: 'planned' },
  { id: 'P5', title: 'Polish', description: 'Performance, cross-browser and mobile verification.', status: 'planned' },
];
```

- [ ] **Step 3: `timeline.ts`, `skills.ts`, `research.ts`, `interests.ts` — port verbatim from the prototype**

Source: prototype `CONTENT.timeline` (lines 1850–1861), `CONTENT.skills` (1877–1897), `CONTENT.research` (1864–1874), `CONTENT.interests` (1900–1907). These were reviewed against the vault and found accurate — no corrections needed, just re-typed as standalone modules:

```ts
// src/data/timeline.ts
export interface TimelineEntry { yr: string; t: string; d: string; }
export const TIMELINE: TimelineEntry[] = [ /* port the 5 entries verbatim */ ];
```

```ts
// src/data/skills.ts
export interface SkillGroup { g: string; hint: string; items: [string, number][]; }
export const SKILLS: SkillGroup[] = [ /* port the 5 groups verbatim */ ];
```

```ts
// src/data/research.ts
export interface ResearchRow { t: string; ab: string; tags: string[]; yr: string; st: string; }
export const RESEARCH: ResearchRow[] = [ /* port the 3 rows verbatim */ ];
```

```ts
// src/data/interests.ts
export interface Interest { k: string; v: string; }
export const INTERESTS: Interest[] = [ /* port the 6 entries verbatim */ ];
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p .`
Expected: no type errors across the six new files.

- [ ] **Step 5: Commit**

```bash
git add src/data
git commit -m "feat: structured content data (links, real phase progress, timeline, skills, research, interests)"
```

---

### Task 10: BaseLayout

**Files:**

- Create: `src/layouts/BaseLayout.astro`

**Interfaces:**

- Consumes: `LINKS` (Task 9), `tokens.css`/`global.css` (Task 2), `public/brand/favicon.svg` (Task 4).
- Produces: `<BaseLayout title={string} description={string}><slot /></BaseLayout>` — every page task wraps its content in this.

- [ ] **Step 1: Write the layout shell**

```astro
---
// src/layouts/BaseLayout.astro
import '@/styles/global.css';
interface Props { title: string; description: string; }
const { title, description } = Astro.props;
---
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title} · Fenil Modi</title>
  <meta name="description" content={description} />
  <link rel="icon" href="/brand/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/brand/apple-touch-icon.png" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content="/brand/og-card.png" />
</head>
<body>
  <slot name="background" />
  <slot />
</body>
</html>
```

- [ ] **Step 2: Verify it builds standalone**

Run: `mkdir -p src/pages && printf '---\nimport BaseLayout from "@/layouts/BaseLayout.astro";\n---\n<BaseLayout title="Test" description="Test page"><p>hi</p></BaseLayout>\n' > src/pages/__layout_smoke.astro && npm run build`
Expected: build succeeds; then delete the smoke page: `rm src/pages/__layout_smoke.astro`

- [ ] **Step 3: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "feat: base page layout"
```

---

### Task 11: Background system (stars, nebulae, filaments, the mark)

**Files:**

- Create: `src/components/Background.astro`

**Interfaces:**

- Consumes: `/brand/logo-tracks.svg` inlined for the architectural mark.
- Produces: `<Background />`, dropped into `BaseLayout`'s `background` slot.

- [ ] **Step 1: Port structure and styling**

Source: prototype lines 933–1024 (`.bg-stars`, `.bg-neb`, `.bg-fil`, `.bg-mark`, `.bg-veil` markup + their CSS from the `<style>` block at lines 546–930 — search that block for each class name). Reproduce the four-layer stack and the single oversized `feTurbulence` rect (avoiding the seam bug logged in the design spec §10).

- [ ] **Step 2: Port the parallax script**

Source: prototype `<script>` block, functions `draw()` (2561), `curve(p)` (2601), `frame()` (2612), `onScroll()` (2635) — one shared `requestAnimationFrame` loop driving all layers' `transform`, plus the four-stop blur/opacity curve from design spec §9 ("As architecture"). Keep blur quantized to whole pixels (spec §9's explicit performance note) and pause the loop on `document.hidden`.

```astro
<script>
  // quantised-blur parallax loop — see design spec §9 for the STOPS curve and why blur is quantised
</script>
```

- [ ] **Step 3: Verify — visual + no console errors**

Run: `npm run dev`, open `http://localhost:4321` in a browser, scroll the (currently empty) page, confirm no console errors and the background layers move at different rates.
Expected: clean console, visible parallax.

- [ ] **Step 4: Commit**

```bash
git add src/components/Background.astro
git commit -m "feat: procedural starfield/nebula background with scroll parallax"
```

---

### Task 12: Nav and Dock

**Files:**

- Create: `src/components/Nav.astro`
- Create: `src/components/Dock.astro`

**Interfaces:**

- Consumes: a `sections` prop — `{ label: string; href: string }[]` — passed per-page (differs on `/` and `/projects/orcas`, which have in-page anchors, versus `/research`/`/cv`, which are single-topic pages and may render a slimmer dock or none).
- Produces: `<Nav links={...} />`, `<Dock sections={...} />`.

- [ ] **Step 1: Port Nav**

Source: prototype lines 1025–1038 (five-link glass pill, hides on scroll-down past 260px). Replace the prototype's five anchor links with real route links: Home (`/`), Research (`/research`), Projects (`/projects`), CV (`/cv`), and a right-aligned link cluster using `LINKS.github`/`LINKS.linkedin`/`LINKS.instagram`/`LINKS.x`/`LINKS.email`.

- [ ] **Step 2: Port Dock**

Source: prototype lines 1039–1059 plus the dock JS (search the second `<script>` block for `dockGrid`, the expand/collapse and `Esc`-closes behavior described in design spec §12 "Dock"). On multi-route pages the dock's "ten-item index" becomes primarily a same-page section index where a page has multiple sections (home, `/projects/orcas`), and a slim current-page indicator elsewhere.

- [ ] **Step 3: Verify**

Run: `npm run dev`, confirm the nav hides on scroll-down and reappears on scroll-up, the dock expands/collapses, and `Esc` closes it. Check keyboard-only operation (Tab to the dock toggle, Enter to expand, Esc to close).
Expected: all pass; no mouse required.

- [ ] **Step 4: Commit**

```bash
git add src/components/Nav.astro src/components/Dock.astro
git commit -m "feat: nav and dock chrome"
```

---

### Task 13: ORCAS Plate (footer)

**Files:**

- Create: `src/components/Plate.astro`

**Interfaces:**

- Consumes: `LINKS` (Task 9).
- Produces: `<Plate />`, used once per page in the footer.

- [ ] **Step 1: Port the SVG generation**

Source: prototype lines 1690–1815 (markup) and design spec §13 (geometry table, inclination fan, catalogue-mark distribution, the arc-direction gotcha at `-.1` vs `.1`). This is mostly static SVG plus one CSS animation (360° rotation, 240s) — no JS needed beyond what's already inline in the markup.

- [ ] **Step 2: Verify both annotation bands read right-way-up**

Run: `npm run dev`, view the footer, visually confirm the upper (clockwise) and lower (counter-clockwise) annotation text both render legibly, not mirrored — this is the exact bug the spec's §13 gotcha describes.
Expected: both bands readable.

- [ ] **Step 3: Commit**

```bash
git add src/components/Plate.astro
git commit -m "feat: ORCAS Plate footer"
```

---

### Task 14: Overlay (README viewer only)

**Files:**

- Create: `src/components/Overlay.astro`

**Interfaces:**

- Consumes: `renderMarkdown` (Task 6).
- Produces: `<Overlay id="readme-overlay" />` plus a small script exposing `window.openReadmeOverlay(title: string, markdownSource: string): void` for Task 17 to call.

**Scope note:** the prototype uses this pattern for all eight long-form docs; on the multi-route site those are real pages now (Task 8/19/21/22). This component's only remaining job is previewing a GitHub repo's README without leaving `/projects`.

- [ ] **Step 1: Port the modal shell**

Source: prototype lines 1815–1830 (`role="dialog"`, `aria-modal`) and the JS `trap(e)`/`show(k,t,html)`/`close()` functions (search the third `<script>` block, ~2949–2980). Keep the focus trap, `Esc`-closes, focus-restored-to-trigger, and body-scroll-lock behavior exactly.

- [ ] **Step 2: Wire it to fetch + render a README**

```ts
import { renderMarkdown } from '@/lib/markdown';

async function openReadme(repoUrl: string, title: string) {
  const raw = await fetch(`${repoUrl.replace('github.com', 'raw.githubusercontent.com')}/HEAD/README.md`)
    .then((r) => (r.ok ? r.text() : Promise.reject()))
    .catch(() => fetch(`${repoUrl.replace('github.com', 'api.github.com/repos')}/readme`, { headers: { Accept: 'application/vnd.github.raw' } }).then((r) => r.text()));
  // render via the sanitizing renderer (Task 6), then hand to show()
}
```

- [ ] **Step 3: Verify — keyboard + a failure path**

Run: `npm run dev`, open a repo card's README, confirm Esc closes and focus returns to the trigger button; then simulate a fetch failure (devtools offline) and confirm a clean "view on GitHub" fallback message renders instead of a stuck loading state.
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/Overlay.astro
git commit -m "feat: README preview overlay"
```

---

### Task 15: Shared content components

**Files:**

- Create: `src/components/ProjectCard.astro`
- Create: `src/components/PaperBlock.astro`
- Create: `src/components/ResearchRow.astro`
- Create: `src/components/SkillColumn.astro`
- Create: `src/components/PhaseRail.astro`

**Interfaces:**

- Consumes: `PhaseEntry[]` (Task 9) for `PhaseRail`, `ResearchRow[]` for `ResearchRow`, `SkillGroup[]` for `SkillColumn`.
- Produces: reusable components for Task 18–21's pages.

- [ ] **Step 1: `ProjectCard.astro` — five variants from spec §12**

```astro
---
interface Props {
  variant: 'feature' | 'tall' | 'wide' | 'note' | 'half';
  title: string;
  description: string;
  href: string;
}
const { variant, title, description, href } = Astro.props;
---
<a class:list={['card', `card-${variant}`]} href={href}>
  <h3>{title}</h3>
  <p>{description}</p>
</a>
<style>
  .card { display: block; border-radius: var(--r-panel); padding: clamp(20px, 3vw, 32px); background: var(--glass-fill); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat)); border: 1px solid var(--glass-edge); }
  .card-note { border: 1px dashed var(--line-hi); background: none; backdrop-filter: none; }
</style>
```

Port the per-variant layout differences (span/aspect/image handling) from prototype lines 1405–1560 into the `card-{variant}` styles.

- [ ] **Step 2: `PaperBlock.astro`, `ResearchRow.astro`, `SkillColumn.astro`, `PhaseRail.astro`**

Port structure from prototype lines 1279–1389 (paper block, research rows) and design spec §12's table for each component's spec. `PhaseRail` is self-contained — it imports `ORCAS_PHASES` itself (no props) and renders `done`/`now`/`planned` visual states (cyan accent only on `now`, per the scarce-cyan rule). `ResearchRow` and `SkillColumn` are per-item, prop-driven — pages import the arrays from `src/data/` and map over them:

```astro
---
// src/components/ResearchRow.astro
import type { ResearchRow as ResearchRowData } from '@/data/research';
interface Props { row: ResearchRowData; }
const { row } = Astro.props;
---
```

```astro
---
// src/components/SkillColumn.astro
import type { SkillGroup } from '@/data/skills';
interface Props { group: SkillGroup; }
const { group } = Astro.props;
---
```

Task 19 (`/research`) calls `{RESEARCH.map((row) => <ResearchRow row={row} />)}`; Task 20 (`/projects`) calls `{SKILLS.map((group) => <SkillColumn group={group} />)}`.

```astro
---
// src/components/PhaseRail.astro
import { ORCAS_PHASES } from '@/data/phases';
---
<ol class="phase-rail">
  {ORCAS_PHASES.map((p) => (
    <li class:list={['phase', p.status]}>
      <span class="mono">{p.id}</span>
      <strong>{p.title}</strong>
      <p>{p.description}</p>
    </li>
  ))}
</ol>
```

- [ ] **Step 3: Verify**

Run: `npx astro check`
Expected: no prop-type errors across the five components.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProjectCard.astro src/components/PaperBlock.astro src/components/ResearchRow.astro src/components/SkillColumn.astro src/components/PhaseRail.astro
git commit -m "feat: shared content components"
```

---

### Task 16: Mini simulation

**Files:**

- Create: `src/components/MiniSimulation.astro`

**Interfaces:**

- Consumes: `CATALOG`, `propagateEci` (Task 5).
- Produces: `<MiniSimulation />`, embedded once on `/projects/orcas`.

- [ ] **Step 1: Port the canvas renderer and camera**

Source: prototype lines 3199–3501 (`resize()`, `proj()`, `sphere()`, `els()`, `select()`, `draw()`, `loop()`) — camera model, Earth graticule, orbit sampling, label decluttering, and controls (drag/scroll/click/arrow-keys/`N`/`Esc`) as described in design spec §14. Replace its internal `eci(s,t)` calls with imports from `src/lib/orbital.ts`'s `propagateEci` and `CATALOG` (Task 5) instead of a duplicate copy.

- [ ] **Step 2: Keep the honest-scope note on-page**

Port the exact wording from prototype `docs.orcas`'s "Honest scope note" (also design spec §14's "Honest scope, stated on the page") — two-body only, no perturbations, labelled snapshot not live TLEs.

- [ ] **Step 3: Verify against the design spec's own recorded check**

Run: `npm run dev`, open `/projects/orcas`, select ISS in the simulation, read its computed period.
Expected: ~92.9 min, matching design spec §21's verification record and Task 5's test.

- [ ] **Step 4: Commit**

```bash
git add src/components/MiniSimulation.astro
git commit -m "feat: mini orbital simulation using the shared orbital.ts module"
```

---

### Task 17: Repo grid

**Files:**

- Create: `src/components/RepoGrid.astro`

**Interfaces:**

- Consumes: `fetchPinnedRepos` (Task 7), `Overlay`'s `openReadme` (Task 14).
- Produces: `<RepoGrid />`, used on `/projects`.

- [ ] **Step 1: Fetch and render**

```astro
---
// src/components/RepoGrid.astro
// Astro components run server-side at build time by default; this needs to run
// client-side for genuinely "live" data, so fetch happens in a <script> tag, not frontmatter.
---
<div id="repo-grid" data-pinned="orcas,Space-Science,Quantum-Enhanced-AES-Encryption,diablex-core,Projects"></div>
<script>
  import { fetchPinnedRepos } from '@/lib/github';
  const el = document.getElementById('repo-grid')!;
  const pinned = el.dataset.pinned!.split(',');
  fetchPinnedRepos('fenilmodi823', pinned).then(({ repos, source }) => {
    // render repo cards; if source === 'offline-snapshot', render the
    // "Offline snapshot — API unreachable." stamp per design spec §15
  });
</script>
```

- [ ] **Step 2: Verify the offline path is honestly labelled**

Run: `npm run dev`, open devtools, throttle to offline, reload `/projects`.
Expected: the offline-snapshot stamp is visible, not a silent live-looking render.

- [ ] **Step 3: Commit**

```bash
git add src/components/RepoGrid.astro
git commit -m "feat: live GitHub repo grid with honest offline fallback"
```

---

### Task 18: Home page

**Files:**

- Create: `src/pages/index.astro`

**Interfaces:**

- Consumes: `BaseLayout`, `Background`, `Nav`, `Dock`, `Plate`, `ProjectCard`, `LINKS`, `TIMELINE`.

- [ ] **Step 1: Compose the page**

Source sections, condensed for a home page that links out to full pages rather than containing everything:

- Hero — prototype lines 1061–1086 ("Systems that watch the sky", live UTC, paper status badge)
- Position/statement — lines 1088–1114
- About (short form; full trajectory rail can stay here since it's genuinely "about", not a separate page) — lines 1116–1176
- ORCAS teaser — condensed from 1178–1266, with a "Read the full case study →" link to `/projects/orcas`
- Work teaser — 2–3 featured `ProjectCard`s from 1391–1560, with a "See all projects →" link to `/projects`
- Contact / Plate — 1691–1814

- [ ] **Step 2: Verify**

Run: `npm run build`, then `npm run preview`, visually check the full page renders, no horizontal overflow at 390/720/1080/1440px (design spec §20's own bar).
Expected: clean build, zero overflow at all four widths.

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: home page"
```

---

### Task 19: Research page

**Files:**

- Create: `src/pages/research.astro`

**Interfaces:**

- Consumes: `getEntry('docs', 'paper')` (Task 8, corrected), `RESEARCH` (Task 9), `PaperBlock`, `ResearchRow`.

- [ ] **Step 1: Compose the page**

Render the full `paper.md` collection entry (via `render()`), the Iridium/Cosmos results table (`PaperBlock`, source prototype lines 1333–1362), and the `RESEARCH` rows (source lines 1363–1372). Add "next directions" from the paper doc's "Future work" section.

- [ ] **Step 2: Verify every factual claim against the source, per PA1's own completion criterion**

Check the rendered page against `ORCAS Research Paper.md`: Paper ID 1849, IEEE SMC Society, accepted 24 Jun 2026, presented 28 Jul 2026, not yet on Xplore, D_M=1.84, P_c=4.2×10⁻³, altitude 788.6 km both objects.
Expected: every number matches exactly — no rounding, no rephrasing.

- [ ] **Step 3: Commit**

```bash
git add src/pages/research.astro
git commit -m "feat: research page"
```

---

### Task 20: Projects index

**Files:**

- Create: `src/pages/projects/index.astro`

**Interfaces:**

- Consumes: `ProjectCard`, `RepoGrid`, `SkillColumn`, `SKILLS`.

- [ ] **Step 1: Compose**

Six `ProjectCard`s (source lines 1391–1560; ORCAS's card here links to `/projects/orcas` rather than opening an overlay), the `RepoGrid` (Task 17), and the skills section (source lines 1592–1605, `SkillColumn` × 5).

- [ ] **Step 2: Verify**

Run: `npm run build && npm run preview`, click through to each project's destination (either `/projects/orcas` or the repo's GitHub URL) and confirm none 404.

- [ ] **Step 3: Commit**

```bash
git add src/pages/projects/index.astro
git commit -m "feat: projects index page"
```

---

### Task 21: ORCAS project page

**Files:**

- Create: `src/pages/projects/orcas.astro`

**Interfaces:**

- Consumes: `getEntry('docs', 'orcas')` (Task 8, corrected), `PhaseRail` + `ORCAS_PHASES` (Task 9/15), `MiniSimulation` (Task 16).

- [ ] **Step 1: Compose**

Render the full corrected `orcas.md` case study, the `PhaseRail`, and the embedded `MiniSimulation`, in that order (context before the interactive demo, matching how the design spec frames it — "the vision, the simulation, phase rail," §18 row 03).

- [ ] **Step 2: Verify the honesty corrections actually landed**

Run: `npm run build`, grep the built output for the specific strings that must NOT appear:

```bash
grep -r "git clone https://github.com/fenilmodi823/orcas" dist/ && echo "FAIL: dead clone URL present" || echo "OK"
grep -rE "Kessler swarm.*Complete|CSV export.*Complete" dist/projects/orcas/index.html && echo "FAIL: false completion claim" || echo "OK"
```

Expected: both print `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/projects/orcas.astro
git commit -m "feat: ORCAS project page with corrected scope and real phase progress"
```

---

### Task 22: CV page

**Files:**

- Create: `src/pages/cv.astro`

**Interfaces:**

- Consumes: `getEntry('docs', 'resume')`, `getEntry('docs', 'cv')` (Task 8), `LINKS` (Task 9).

- [ ] **Step 1: Compose**

Render both `resume.md` and `cv.md` collection entries in place (source prototype lines 1647–1689's "read in place or download" pattern), plus two download buttons pointing at `public/files/Fenil-Modi-Resume.pdf` and `public/files/Fenil-Modi-CV.pdf`.

- [ ] **Step 2: Get the two PDFs into place**

Fenil needs to supply `Fenil-Modi-Resume.pdf` and `Fenil-Modi-CV.pdf` (his own documents, not the IEEE paper — fine to host directly). Place at `public/files/`. If not yet supplied, the download buttons disable themselves rather than link to a 404 — port that guard from the prototype's `files:` handling logic.

- [ ] **Step 3: Verify**

Run: `npm run build && npm run preview`, click both download buttons.
Expected: either downloads the real PDF, or (if not yet supplied) the button is visibly disabled, never a broken link.

- [ ] **Step 4: Commit**

```bash
git add src/pages/cv.astro
git commit -m "feat: CV page with read-in-place and download options"
```

---

### Task 23: 404 page

**Files:**

- Create: `src/pages/404.astro`

- [ ] **Step 1: Write a small, on-brand 404**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import Background from '@/components/Background.astro';
---
<BaseLayout title="Not found" description="Page not found.">
  <Background slot="background" />
  <main class="wrap" style="min-height: 70vh; display: grid; place-items: center; text-align: center;">
    <div>
      <p class="mono" style="color: var(--cyan);">404</p>
      <h1>Nothing tracked at this coordinate.</h1>
      <p><a href="/">Back to the surface →</a></p>
    </div>
  </main>
</BaseLayout>
```

- [ ] **Step 2: Verify**

Run: `npm run build && npm run preview`, visit a nonexistent path.
Expected: this page renders, not a framework-default error page.

- [ ] **Step 3: Commit**

```bash
git add src/pages/404.astro
git commit -m "feat: 404 page"
```

---

### Task 24: SEO — sitemap, OG, JSON-LD

**Files:**

- Modify: `astro.config.mjs` (sitemap already added in Task 1)
- Modify: `src/layouts/BaseLayout.astro` (add JSON-LD slot)

**Interfaces:**

- Consumes: nothing new.
- Produces: `/sitemap-index.xml` at build time (from the `@astrojs/sitemap` integration already installed), a `<script type="application/ld+json">` block per page.

- [ ] **Step 1: Add a `jsonLd` prop to `BaseLayout`**

```astro
---
interface Props { title: string; description: string; jsonLd?: Record<string, unknown>; }
const { title, description, jsonLd } = Astro.props;
---
...
{jsonLd && <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />}
```

- [ ] **Step 2: Pass a `Person` JSON-LD block from the home page and a `ScholarlyArticle` block from `/research`**

```ts
// index.astro frontmatter
const personLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Fenil Miteshkumar Modi',
  url: 'https://orcas-portfolio.vercel.app',
  sameAs: [LINKS.github, LINKS.linkedin, LINKS.x],
  email: 'fenilmmodi@gmail.com',
};
```

- [ ] **Step 3: Verify**

Run: `npm run build`, confirm `dist/sitemap-index.xml` exists and lists all 6 routes; validate one page's JSON-LD with `node -e "JSON.parse(require('fs').readFileSync('dist/index.html','utf8').match(/application\/ld\+json\">(.*?)<\/script>/s)[1])"`.
Expected: sitemap lists 6 URLs, JSON-LD parses without throwing.

- [ ] **Step 4: Commit**

```bash
git add astro.config.mjs src/layouts/BaseLayout.astro src/pages/index.astro src/pages/research.astro
git commit -m "feat: sitemap and JSON-LD structured data"
```

---

### Task 25: Production build verification (stop here — no deploy)

**Files:** none created; this task is verification-only.

- [ ] **Step 1: Full clean build**

Run:

```bash
rm -rf dist .astro
npm run check
npm test
npm run build
```

Expected: `astro check` reports 0 errors, all Vitest suites pass (orbital, markdown, github), `npm run build` completes and produces `dist/` with 6 HTML pages plus `sitemap-index.xml`.

- [ ] **Step 2: Local production smoke test**

Run: `npm run preview`, click through all 6 routes plus the 404 page, confirm no console errors on any of them, confirm every download/social link opens the correct real URL (`LINKS.*`).
Expected: clean pass across all routes.

- [ ] **Step 3: Report status — do not deploy**

Summarize: build is green, tests pass, all real links wired, the three factual corrections verified present in the built output (Task 21 Step 2's grep checks). Pushing to GitHub and deploying to Vercel require Fenil's explicit go-ahead — stop here and ask.

---

## Self-Review

**Spec coverage:** every deliverable in `Phases.md`'s PA1 section is covered — Astro 5 + TypeScript (Task 1), tokens wired (Task 2), content collections with type-safe frontmatter (Task 8), all six pages (Tasks 18–23), the paper write-up with exact publication status (Task 19), the Q3-approved contribution wording (Task 8), SEO (Task 24), deployable to Vercel (Task 25, build verified, deploy deferred to Fenil). The design spec's full component inventory (§12) is covered across Tasks 11–17. The three corrections flagged during the design discussion (false completion claims, dead clone URL, unverified contribution wording) each have an explicit task step and a grep-based verification (Task 21 Step 2).

**Placeholder scan:** every task either ships real, runnable code (Tasks 1–10, 12 partial, 15 partial, 17, 18's compose steps use cited line ranges not "similar to X", 23, 24) or cites an exact source line range plus the exact adaptation required (porting tasks) — no bare "add appropriate styling" or "TBD" instructions remain.

**Type consistency:** `OrbitalElements`/`EciKm`/`propagateEci` (Task 5) are the same names Task 16 imports. `RepoSummary`/`GithubFetchResult`/`fetchPinnedRepos` (Task 7) are what Task 17 imports. `PhaseEntry`/`ORCAS_PHASES` (Task 9) match what Task 15's `PhaseRail` and Task 21 consume. `renderMarkdown` (Task 6) is what Task 14's Overlay calls.
