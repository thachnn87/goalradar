# ROOT CAUSE REPAIRS
**Phase:** DATA-18WC.VERIFY Phase 9  
**Date:** 2026-06-25

---

## Scope

One divergence requires a code fix: D1 — Schedule page shows only 4 upcoming matches.

D2 (Hub WCBracket R32 TBD) and D3 (CompetitionSelector) require no code changes.

---

## Fix: D1 — Migrate `/world-cup-2026-schedule` to `getWCAuthorityMatchesV2`

### Root Cause

`src/app/world-cup-2026-schedule/page.tsx` calls `getWCAuthorityMatchesCached()` which merges 3 KV buckets. The `upcoming` bucket is populated by cron from FD API's `SCHEDULED,TIMED` feed, which only returns matches within a limited forward window. Knockout stage matches (Round of 32 starts June 27) and far-future group matches are absent from this bucket.

`getWCAuthorityMatchesV2()` reads `goalradar:wc:authority:v1` directly — the pre-built canonical dataset with all 104 confirmed WC matches. The fixtures page already uses this function and correctly shows 40+ upcoming matches.

### Fix

1. Replace `getWCAuthorityMatchesCached` import with `getWCAuthorityMatchesV2`
2. Change `upcoming: Match[]` type to `CanonicalMatch[]` (imported from `@/lib/canonical-match`)
3. Update `groupByDay` signature from `Match[]` to `CanonicalMatch[]`
4. Update call site: `getWCAuthorityMatchesV2(builtAt, { source, sourceType })`
5. Remove unused `import type { Match }` if only used for `upcoming` typing

### Type Compatibility Verification

All fields used in the schedule page render are present on `CanonicalMatch`:

| Usage | `Match` field | `CanonicalMatch` field | Compatible |
|---|---|---|---|
| `classifyMatchState(m, today)` | `m.status` | `m.state` | ✅ classifyMatchState handles both |
| `m.utcDate` | ✅ | ✅ | ✅ |
| `m.id` | ✅ | ✅ | ✅ |
| `m.homeTeam?.name` | ✅ | ✅ (CanonicalTeam.name) | ✅ |
| `m.awayTeam?.name` | ✅ | ✅ (CanonicalTeam.name) | ✅ |
| `m.homeTeam?.shortName` | optional | ✅ (CanonicalTeam.shortName) | ✅ |
| `m.stage` | optional string | ✅ `stage: string` | ✅ |
| `m.score?.fullTime?.home` | Score | CanonicalScore = Score | ✅ |
| JSON-LD `m.utcDate` | ✅ | ✅ | ✅ |
| JSON-LD `m.homeTeam.name` | ✅ | ✅ | ✅ |

### Regression Risk

**LOW.** The change:
- Uses the same KV key as 9 other pages (proven reliable)
- `classifyMatchState` already handles `CanonicalMatch.state`
- All render fields are structurally identical to `Match`
- No behavior change for FINISHED matches (filter excludes them)
- ISR TTL unchanged (300s)

### Expected Production Change

Before fix: 4 upcoming matches displayed (today's remaining group stage only)  
After fix: All upcoming matches displayed (up to 48 across 14 days): today's group matches + future group stage + Round of 32 (June 27+) + R16, QF, SF, 3P, Final

### No Architecture Violations

This fix:
- Does NOT introduce a new ViewModel
- Does NOT introduce a new pipeline
- Does NOT create a new route
- Does NOT call any new external service
- Migrates one page to the already-established Source of Truth function (`getWCAuthorityMatchesV2`)
- Is identical in spirit to the RESET fixes for hub and SEO bracket

---

## Non-Fixes (documented, no code change)

### D2 — Hub WCBracket R32 TBD

**Decision:** Accept.  
**Rationale:** RESET intentionally changed Hub to pass `vm.bracketMatches` (R16+). The hub bracket tree is a PREVIEW. R32 is prominently displayed on `/world-cup-2026/bracket`. The hub's WCBracket showing TBD for R32 is consistent with other post-RESET pages that use `bracketMatches`. Reverting would re-introduce the `bracketMatches`-vs-all-matches duality that RESET eliminated.

### D3 — CompetitionSelector SSR

**Decision:** No action.  
**Rationale:** By design. Not a Source of Truth divergence — the component renders correctly after client hydration.

---

## Implementation

File: `src/app/world-cup-2026-schedule/page.tsx`

**Import changes:**
```diff
-import { getWCAuthorityMatchesCached } from '@/lib/api';
+import { getWCAuthorityMatchesV2 } from '@/lib/api';
 import { classifyMatchState } from '@/lib/match-classify';
-import type { Match } from '@/lib/types';
+import type { CanonicalMatch } from '@/lib/canonical-match';
```

**groupByDay signature change:**
```diff
-function groupByDay(matches: Match[]): Map<string, Match[]> {
+function groupByDay(matches: CanonicalMatch[]): Map<string, CanonicalMatch[]> {
```

**Page component changes:**
```diff
-  let upcoming: Match[] = [];
+  const builtAt = new Date().toISOString();
+  let upcoming: CanonicalMatch[] = [];
   try {
     const today = new Date().toISOString().split('T')[0];
-    const data = await getWCAuthorityMatchesCached();
+    const data = await getWCAuthorityMatchesV2(builtAt, { source: '/world-cup-2026-schedule', sourceType: 'page' });
     upcoming = data.matches
```
