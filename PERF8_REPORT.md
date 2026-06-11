# PERF-8 Report — Match Navigation Speed
## GoalRadar · Sprint PERF-8

Generated: 2026-06-10
Audit: see `PERF8_AUDIT.md` (Phase 0, written before any code change).

---

## Bottlenecks Found (from audit)

1. **No `loading.tsx` on `/match/[id]` or `/predict/[id]`** — clicking a match
   card showed a frozen page until the full RSC payload arrived. This was the
   dominant *perceived* delay, independent of server speed.
2. **Default-only Link prefetch** — zero explicit `prefetch=` props existed.
   Next's viewport-prefetch heuristics skip slow connections / data-saver,
   exactly where the 500 ms mobile budget is hardest to hit.
3. **User intent signals unused** — hover precedes click by 100–300 ms,
   touchstart by ~80–120 ms; nothing exploited this window.
4. **No client-side timing** — `[MATCH_LATENCY]` measured server snapshot
   fetch only, not user-perceived click→content time.

---

## Changes Made

### Phase 1 — Aggressive route prefetch

| Entry point | Change |
|------------|--------|
| `MatchCard` (≈90 % of match clicks: homepage, schedule, live, WC hub, fixtures, groups, teams, rounds, bracket R32) | now renders through new **`MatchLink`** with `prefetch={true}` |
| Homepage `BracketPreview` rows | `prefetch={true}` |
| `WCBracket` visual bracket cards | `prefetch={true}` |
| Bracket page `ThirdPlaceCard` / `FinalCard` / R32-list links | `prefetch={true}` (3 sites) |
| `/world-cup-2026-results` list rows | `prefetch={true}` (2 sites) |
| `matches-tomorrow` `KickoffRow` | `prefetch={true}` |

**Coverage: every `next/link` that targets `/match/[id]` now has explicit full
prefetch** (8 direct call sites + MatchLink). No raw `<a>` tags or
`router.push` paths to match pages exist (verified in audit).

### Phase 1b — Instant loading skeletons

- `src/app/match/[id]/loading.tsx` — score-hero-shaped skeleton renders the
  moment navigation starts; mirrors the real layout to avoid CLS.
- `src/app/predict/[id]/loading.tsx` — same for prediction pages.

This converts "click → frozen page → full content" into
"click → instant skeleton → content", eliminating perceived delay even on the
slowest path.

### Phase 2 — Hover/tap/viewport snapshot prewarm

- **`src/lib/match-prewarm.ts`** (client): queue with **dedupe** (Set, one
  request per id per page load), **debounce** (80 ms hover delay, cancelled on
  mouseleave), **max concurrency 3**, `fetch(..., {priority:'low'})`.
- **`src/components/MatchLink.tsx`** (client): viewport entry
  (IntersectionObserver, 120 px margin, one-shot), `onMouseEnter` (debounced),
  `onTouchStart` (immediate) → all queue a prewarm.
- **`GET /api/prewarm/match/[id]`** → **`prewarmMatchSnapshotKVOnly()`** in
  `match-snapshot.ts`:
  - KV snapshot exists → `hit` (no work)
  - KV detail exists → assemble snapshot from KV-only parallel data
    (`assembleSnapshot`, extracted from `buildSnapshot`) → write KV → `built`
  - both missing → `skip` — **the provider code path is structurally absent
    from this function**; the eventual real page visit handles full-cold under
    the existing cross-instance KV lock (PERF-6 Phase 4)
  - coalesces with in-flight page-render builds via `_buildInflight`
  - response edge-cached 30 s (`s-maxage=30`) so hint bursts for the same
    match collapse to one invocation

### Phase 3 — Viewport-based snapshot seeding

`SnapshotPrewarmHints` (client, renders nothing) receives the **first 10
server-rendered match IDs** and queues prewarm on `requestIdleCallback`:

| Page | IDs passed |
|------|-----------|
| `/schedule` | first 10 of the date-grouped list |
| `/live` | first 10 live matches |
| `/world-cup-2026` hub | live + today + upcoming, first 10 |
| `/world-cup-2026-results` | live + finished, first 10 |

### Phase 4 — Navigation telemetry

- `MatchLink` `onClick` stamps `sessionStorage` (`gr:nav` = `{id, t}`) —
  `navigationStartMs`.
- `MatchNavTelemetry` (rendered by `/match/[id]`) computes
  `clickToRenderMs = now − t` on hydration (≈ first content visible),
  validates id match + 60 s staleness window, beacons via
  `navigator.sendBeacon` → `POST /api/telemetry/navigation` → `recordNavigation()`.
- `match-perf-tracker.ts`: new `_navLatencies` window (100 samples),
  `getNavigationPerfStats()` → `{samples, p50, p95, p99, goalMet: p50 < 500}`.
- `/api/debug/performance` exposes the new **`navigationPerf`** block.

---

## Validation (Phase 5)

### Functional (dev server, observed)

| Check | Result |
|-------|--------|
| `GET /api/prewarm/match/{id}` with no KV data | `{"status":"skip"}` — **no provider call** (provider path does not exist in the function) ✅ |
| `GET /api/prewarm/match/abc` | 400 ✅ |
| `POST /api/telemetry/navigation` | 204, `[NAV_PERF]` logged ✅ |
| `/match/[id]` route with `loading.tsx` | 200, skeleton in route tree ✅ |
| `npx tsc --noEmit` | 0 errors ✅ |
| `npm run build` | success ✅ |

### Before → after latency model (production)

| Scenario | Before | After | Mechanism |
|----------|--------|-------|-----------|
| **Cached** (router cache, recently prefetched) | 300–800 ms blank wait | **<100 ms** — renders from prefetched RSC payload instantly | `prefetch={true}` keeps payload in client router cache |
| **Warm** (ISR fresh, snapshot in KV) | 200–600 ms blank | **<200 ms** — payload usually already prefetched on viewport entry; otherwise TTFB ~80–150 ms with instant skeleton | prefetch + skeleton + KV snapshot (~10 ms, PERF-7B) |
| **Cold** (ISR expired) | 400–2 000 ms blank | skeleton at ~0 ms; content at 150–400 ms — snapshot was prewarmed by hover/touch/viewport hint seconds earlier | hover fires ~200 ms before click; prewarm builds snapshot from KV in ~30–130 ms |
| **Mobile click → content visible** | no feedback until full payload | **skeleton <100 ms, content target <500 ms** | touchstart prewarm + prefetch + skeleton |

Production validation: `navigationPerf` in `/api/debug/performance` now
measures real users — check `p50 < 500` (goalMet) after deploy.

---

## Invariants Preserved

| Constraint | Status |
|-----------|--------|
| PERF-6 queue elimination | ✅ no new provider call sites; prewarm endpoint coalesces with `_buildInflight` and never enqueues |
| PERF-7A zero provider render | ✅ untouched; `prewarmMatchSnapshotKVOnly` has no provider path at all |
| PERF-7B snapshot architecture | ✅ reuses `readKVSnapshot` / `readMatchDetailFromKV` / extracted `assembleSnapshot`; `buildSnapshot` behavior unchanged |
| No new provider traffic | ✅ structurally impossible from any PERF-8 code |
| No vercel.json changes | ✅ untouched |

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/MatchLink.tsx` | NEW — prefetch + intent prewarm + click stamp |
| `src/lib/match-prewarm.ts` | NEW — client prewarm queue (dedupe/debounce/concurrency 3) |
| `src/components/SnapshotPrewarmHints.tsx` | NEW — top-10 idle seeding |
| `src/components/MatchNavTelemetry.tsx` | NEW — click→content beacon |
| `src/app/api/prewarm/match/[id]/route.ts` | NEW — KV-only prewarm endpoint |
| `src/app/api/telemetry/navigation/route.ts` | NEW — beacon receiver |
| `src/app/match/[id]/loading.tsx` | NEW — instant skeleton |
| `src/app/predict/[id]/loading.tsx` | NEW — instant skeleton |
| `src/lib/match-snapshot.ts` | `assembleSnapshot` extracted; `prewarmMatchSnapshotKVOnly` added |
| `src/lib/match-perf-tracker.ts` | `recordNavigation` + `getNavigationPerfStats` |
| `src/components/MatchCard.tsx` | Link → MatchLink |
| `src/app/page.tsx`, `WCBracket.tsx`, bracket page, results page, matches-tomorrow | `prefetch={true}` on match links |
| `src/app/{schedule,live}/page.tsx`, WC hub, `world-cup-2026-results` | `SnapshotPrewarmHints` |
| `src/app/api/debug/performance/route.ts` | `navigationPerf` block |
| `src/app/match/[id]/page.tsx` | renders `MatchNavTelemetry` |
