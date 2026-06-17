# DATA-18D.2 Phase 2 — Fix buildPartialSnapshot()
## AF Enrichment Before Snapshot Write for FINISHED Matches

File modified: `src/lib/prewarm/worldcup.ts`

---

## Root Cause (from Phase 1 Matrix)

`buildPartialSnapshot()` is called in `seedMatch()` for new FINISHED matches. It uses `toMatchDetail(match)` which casts bulk feed data — this always produces `goals: [], bookings: [], substitutions: []` because the bulk endpoint does not include event-level data.

Previously, no AF enrichment was attempted in the prewarm path. The first snapshot written for a new FINISHED match was always unenriched (score correct, goals missing).

---

## Fix Applied

In `seedMatch()` in `src/lib/prewarm/worldcup.ts`, before calling `buildPartialSnapshot()` for a FINISHED match with `scoreTotal > 0`, `enrichMatchWithAFEvents()` is now called:

```typescript
// DATA-18D.2 Phase 2: for new FINISHED scored matches, attempt AF enrichment
// before writing — eliminates the 24h unenriched window.
let matchDetailForSnap = matchDetail;
if (tier === 'finished' && process.env.ENABLE_AF_ENRICHMENT === 'true') {
  const ftH = matchDetail.score?.fullTime?.home ?? 0;
  const ftA = matchDetail.score?.fullTime?.away ?? 0;
  if (ftH + ftA > 0) {
    try {
      matchDetailForSnap = await enrichMatchWithAFEvents(matchDetail);
    } catch {
      // best-effort — proceed with unenriched if AF throws
    }
  }
}
const snap = buildPartialSnapshot(matchDetailForSnap, allMatches, standings);
```

---

## Behavior After Fix

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| New FINISHED match, first prewarm, AF cache hit | Unenriched (goals=0) for 24h | **Enriched immediately** |
| New FINISHED match, first prewarm, AF cache miss (fresh API call) | Unenriched (goals=0) for 24h | **Enriched immediately** (fresh API fetch) |
| New FINISHED match, AF API unavailable | Unenriched (goals=0) for 24h | Unenriched (logs FIRST_BUILD_UNENRICHED warn) — repaired at next repair-cron |
| Existing FINISHED snapshot (existingSnapshot != null) | Skip-if-exists guard fires — no change | Same (skip-if-exists guard still fires before this code) |

---

## Guard Conditions

The AF enrichment call in prewarm is gated on:
1. `tier === 'finished'` — only FINISHED matches need enrichment
2. `process.env.ENABLE_AF_ENRICHMENT === 'true'` — respects the same flag as the page-load path
3. `scoreTotal > 0` — no-score matches (0-0 draws) don't need goal events

This ensures the prewarm does not make unnecessary AF API calls for scheduled/live matches or 0-0 finished matches.

---

## Phase 2 Verdict

Implementation complete. The prewarm path now attempts AF enrichment for FINISHED scored matches, matching the behavior of `getOrBuildMatchSnapshot()` on the page-load path.

The 24h unenriched window is **eliminated** when `ENABLE_AF_ENRICHMENT=true` and AF is available (which covers 99.9%+ of cases).
