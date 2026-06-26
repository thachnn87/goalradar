# GoalRadar Guardian — comprehensive quality pipeline
**Sprint:** DATA-18WC.GUARDIAN  
**Date:** 2026-06-25

A layered, automated quality gate so production is proven healthy **end-to-end** —
not just "the main paths respond". Three scripts, one pipeline.

```
npm run guardian
  ├─ 1. scripts/check-wc-architecture.mjs   (static — ONE SOURCE / ONE PIPELINE)
  ├─ 2. scripts/check-wc-journeys.mjs        (runtime — 6 user journeys + bracket parity)
  └─ 3. scripts/guardian.mjs                 (runtime — SEO/hydration/a11y/links/cache/perf)
```

Any layer failing fails the pipeline. Run against production:

```
CRAWL_BASE_URL=https://www.goalradar.org npm run guardian
# or a single layer:
CRAWL_BASE_URL=https://www.goalradar.org node scripts/guardian.mjs
```

For local: `AUTO_SERVER=1 npm run guardian` (each runtime script can boot `next start`).

---

## Layers

### 1. Architecture — `check-wc-architecture.mjs` (static, also runs as `prebuild`)
Fails the build if the WC ONE-SOURCE invariant regresses: forbidden imports in WC
surfaces, the deleted legacy knockout pipeline reappears, the pilot gate returns, or
`canonicalToMatch` is duplicated. See R1–R4 in the script.

### 2. User journeys — `check-wc-journeys.mjs` (runtime)
Walks the 6 mandatory journeys following **real links** between steps, and the
SEO-vs-nested bracket **parity** check. Fails on 404 / error-card / dead-end /
match-id-set mismatch. See `USER_JOURNEY_MAP.md` / `END_TO_END_ACCEPTANCE.md`.

### 3. Guardian layers — `guardian.mjs` (runtime)
Inspects a curated set of key pages and writes `GUARDIAN_REPORT.md`.

| Layer | Checks | CRITICAL when |
|---|---|---|
| **http** | status, reachability | non-2xx / network error |
| **hydration** | error-shell markers, Next App-Router payload present | "Application error" / "client-side exception" / error card in SSR HTML |
| **seo** | canonical present & absolute, `<title>`, meta description, OpenGraph, JSON-LD validity, noindex guard | missing canonical / missing title / invalid JSON-LD / accidental `noindex` |
| **a11y** | `<html lang>`, single `<h1>`, `<img>` alt text | (all WARN) |
| **links** | every unique same-origin link resolves | any 4xx/5xx/network error |
| **cache** | Cache-Control / x-vercel-cache reported | (WARN on `no-store` where ISR expected) |
| **perf** | response time + HTML payload size | response > 8s |

CRITICAL → exit 1 (pipeline fails). WARN → reported, non-fatal (tracked, not gating).

---

## Production baseline (this sprint)

```
Architecture : ✅ pass
Journeys     : ✅ 7/7 (6 journeys + bracket parity 32==32)
Guardian     : ✅ 0 CRITICAL · 13 WARN · 291 internal links all resolve
```

### Open WARNs (tracked, non-gating)
| Layer | Where | Note |
|---|---|---|
| seo | hub, bracket, round, standings, groups, schedule, results, team pages | `<title>` > 70 chars — trim for SERP (content pass) |
| seo | `/world-cup-2026/round-of-32` | meta description 247 chars (want ≤ 200) |
| a11y | `/match/[id]` | missing `<h1>` — **fixed this sprint** (sr-only matchup h1) |
| cache | `/match/[id]` | `Cache-Control: no-store` though `revalidate=60` — match page is effectively dynamic; review whether ISR is intended for live freshness |

---

## Production monitoring

`npm run guardian` is a synthetic check that runs against any base URL with no repo
state, so it doubles as a production monitor: schedule it (cron / CI / `/loop`) against
`https://www.goalradar.org` and alert on a non-zero exit. The exit code is the signal;
`GUARDIAN_REPORT.md` is the detail.

---

## Limitations / follow-ups
- **Full client-side error detection** (runtime console errors, hydration mismatch
  warnings) requires a headless browser. `guardian.mjs` detects *server-rendered*
  error shells and the absence of the Next hydration payload; pair with the
  browser-based `verify` skill for true client runtime coverage.
- **Lighthouse-grade performance / a11y** (CLS, contrast, ARIA semantics) is beyond
  HTML inspection — add a Lighthouse-CI layer if deeper scoring is needed.
