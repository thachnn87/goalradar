# PERF-11 Audit — Match Above-The-Fold Streaming
## GoalRadar · Sprint PERF-11

Generated: 2026-06-11

---

## Current Render Architecture (`/match/[id]`)

```
generateMetadata ──┐
                   ├─ await getOrBuildMatchSnapshot(id)   ← React.cache (1 real call)
page component  ───┘
        │  (snapshot resolved — warm: ~10 ms · cold: 30 ms–7 s)
        ▼
ONE synchronous flush renders ALL of:
  Breadcrumb · ScoreHero · WCAboveFoldCTA · AdSlot ·
  MatchSummary · MatchReport · WCMidFunnel · MatchStatistics ·
  GoalsSection · BookingsSection · SubstitutionsSection · LineupsSection ·
  MatchFaqSection · WCNavBox · WCBottomFunnel · Push/Newsletter · AdSlot
        │
        ├─ <Suspense> HeadToHeadDeferred      (awaits same memoised snapshot)
        └─ <Suspense> WCGroupSectionDeferred  (awaits same memoised snapshot)
```

## Section Classification

| Section | Data dependency | Render cost | Blocks first paint today? |
|---------|----------------|-------------|---------------------------|
| **Hero (teams/score/kickoff/status)** — `ScoreHero` | `snapshot.match` | low | yes (needs snapshot — unavoidable) |
| **Watch live strip** — `WCAboveFoldCTA` + CountryChips | none beyond match id | low | yes — rendered with hero ✅ correct |
| TV schedule / streaming links — `WCMidFunnel`, `WCBottomFunnel` | none | low-med | **yes — unnecessarily** |
| Match report — `MatchReport` | `snapshot.match` | **high** (longest prose block) | **yes — unnecessarily** |
| Match summary / statistics | `snapshot.match` | med | **yes — unnecessarily** |
| Goals / bookings / substitutions / lineups | `snapshot.match` | med | **yes — unnecessarily** |
| FAQ section + JSON-LD | `snapshot.match` | med | **yes — unnecessarily** |
| Prediction teaser links (inside funnels/nav) | none | low | **yes — unnecessarily** |
| H2H | `snapshot.headToHead` | med | no — already Suspense-deferred ✅ |
| Related matches / group standings | `snapshot.wc*` | **high** (match grids) | no — already Suspense-deferred ✅ |

## Findings

1. **The hero cannot render before the snapshot** — it needs
   `snapshot.match`. The pre-snapshot gap is already covered by the PERF-8
   `loading.tsx` skeleton. Nothing to gain there.
2. **~12 secondary sections render in the same server flush as the hero.**
   On a MISS/dynamic render, the hero HTML cannot flush until the entire
   below-fold tree (report prose, stats tables, event lists, FAQ, funnels)
   has been rendered server-side. This is the real above-the-fold tax.
3. The two existing Suspense boundaries await the **same memoised snapshot**
   — they add no extra latency, but the pattern they use (deferred async
   component + skeleton) is exactly what the rest of the below-fold content
   should use.
4. **Client paint cost**: the full page hydrates and paints ~15 sections
   even though the first viewport shows only hero + watch strip + 1 ad.
   `content-visibility: auto` can skip offscreen layout/paint without
   removing content from the HTML (SEO-safe — unlike JS viewport gating,
   which would hide SSR content from crawlers).
5. **ISR nuance:** on edge-cache HIT the whole HTML arrives at once and
   streaming order is irrelevant; the wins apply to MISS/revalidation
   renders (every 60 s per match URL) and to client paint cost on all loads.

## Fix Plan

| Phase | Change |
|-------|--------|
| 1 | Above-the-fold group stays in the page body: Breadcrumb + ScoreHero + WCAboveFoldCTA (watch live) + top ad |
| 2 | Everything else moves into `BelowTheFoldDeferred` (async, awaits the memoised snapshot) behind `<Suspense>` — hero flushes first on dynamic renders; H2H + WC-group keep their own nested boundaries (independent streams) |
| 3 | `content-visibility: auto` + `contain-intrinsic-size` on below-fold section wrappers — browser skips layout/paint until near viewport; HTML unchanged (no SEO regression, no JS) |
| 4 | Extend nav telemetry beacon with `heroMs` + `fullMs`; new `renderPerf` block in `/api/debug/performance` |
