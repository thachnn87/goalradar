# PERF-11 Report — Match Above-The-Fold Streaming
## GoalRadar · Sprint PERF-11

Generated: 2026-06-11
Audit: `PERF11_AUDIT.md`.

---

## Render Waterfall — Before vs After

### Before (dynamic/MISS render)

```
t0 ── click ──────────────────────────────────────────────────
      loading.tsx skeleton (PERF-8)            ~0 ms
      └─ server: await snapshot               (warm ~10 ms)
         └─ server renders ENTIRE page tree   ← hero blocked by
            (hero + report + stats + events     ~12 below-fold
             + FAQ + funnels + nav + ads)        sections
            └─ ONE flush: everything at once
               └─ Suspense H2H / WC-group resolve (same snapshot)
```

### After

```
t0 ── click ──────────────────────────────────────────────────
      loading.tsx skeleton                     ~0 ms
      └─ server: await snapshot               (warm ~10 ms)
         ├─ FLUSH 1 — above-the-fold only:    ← hero no longer waits
         │    Breadcrumb · ScoreHero (teams/    for below-fold render
         │    score/kickoff/status) ·
         │    WCAboveFoldCTA (watch live +
         │    country chips) · top ad ·
         │    BelowFoldSkeleton placeholder
         ├─ FLUSH 2 — BelowTheFoldDeferred:
         │    summary · report · stats ·
         │    goals/bookings/subs/lineups ·
         │    FAQ · funnels · nav · newsletter
         ├─ FLUSH 3 — H2H (own boundary)
         └─ FLUSH 4 — WC group/related (own boundary)
```

Client paint: 5 `content-visibility:auto` wrappers let the browser skip
layout/paint of all below-fold sections until they near the viewport —
verified live: offscreen FAQ content present in HTML but excluded from the
rendered text until scrolled.

---

## Changes

| Phase | Implementation |
|-------|----------------|
| 1 — Above-the-fold group | Page body now renders only Breadcrumb + ScoreHero + WCAboveFoldCTA + top ad after the snapshot await — exactly the spec set (teams, score, kickoff, status, watch live) |
| 2 — Independent streaming | New `BelowTheFoldDeferred` async server component awaits the **same React.cache-memoised snapshot** (never a second fetch) behind `<Suspense fallback={<BelowFoldSkeleton/>}>`; H2H and WC-group keep their own nested boundaries → 3 independent streams |
| 3 — Viewport lazy rendering | `LazySection` wrapper (`content-visibility:auto` + `contain-intrinsic-size:auto 600px`) on 5 below-fold groups — CSS-only, HTML fully present (SEO-safe), no JS observers |
| 4 — Metrics | Nav beacon extended with `heroMs` (above-fold hydration) + `fullMs` (window load); `recordRenderPhases` + `renderPerf {hero:{p50,p95,p99}, full:{…}}` in `/api/debug/performance` |

## Verification (running app)

- Full SSR HTML still contains every section: watch strip, country chips,
  match report, H2H, FAQ heading + FAQPage JSON-LD (125 KB page) — **no SEO
  regression**.
- Telemetry beacon accepted (`POST /api/telemetry/navigation` → 204) with the
  new fields.
- `content-visibility` confirmed active (offscreen content skipped from
  rendered text, present in DOM).
- Console: the only errors are pre-existing (provider failover noise in dev +
  a duplicate-React-key warning **verified present before this change** —
  flagged as a separate task).
- `tsc --noEmit` 0 errors · production build passes.

## Expected user-perceived improvement

| Scenario | Before | After |
|----------|--------|-------|
| Warm open (ISR HIT + prefetched) | full HTML at once; browser lays out ~15 sections before first paint | same network, but **first paint only lays out above-the-fold** (content-visibility) → perceived <150 ms ✅ |
| Warm open (ISR MISS, snapshot in KV) | hero waits for full server tree render | hero flushes in FLUSH 1 (~10 ms after snapshot); below-fold streams behind skeleton |
| Cold open | hero waits for snapshot AND full tree | hero flushes immediately after snapshot resolves; gap covered by skeletons |

Production validation: `renderPerf.hero.p50` in `/api/debug/performance`
(target < 150 ms on warm opens).

## Constraint compliance

- **No SEO regression** — all content server-rendered in HTML (verified by grep on the live response); JSON-LD unchanged.
- **No provider increase** — `BelowTheFoldDeferred` awaits the memoised snapshot promise; zero extra fetches.
- **No ISR regression** — `revalidate = 60` untouched; no dynamic APIs introduced.

## Files Changed

| File | Change |
|------|--------|
| `src/app/match/[id]/page.tsx` | Above-fold/below-fold split: `BelowTheFoldDeferred` + `BelowFoldSkeleton` + `LazySection` |
| `src/components/MatchNavTelemetry.tsx` | beacons `heroMs` + `fullMs` on window load |
| `src/lib/match-perf-tracker.ts` | `recordRenderPhases` + `getRenderPerfStats` |
| `src/app/api/telemetry/navigation/route.ts` | accepts the new fields |
| `src/app/api/debug/performance/route.ts` | new `renderPerf` block |
