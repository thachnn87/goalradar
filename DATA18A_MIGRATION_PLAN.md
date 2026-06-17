# DATA-18A Migration Plan
## Staged Migration S0 → S5

Date: 2026-06-17
Status: Design only — no implementation activated.

---

## Overview

| Stage | Name | What changes | Risk | Activation |
|-------|------|-------------|------|-----------|
| S0 | Dormant | Types + architecture docs committed, nothing imported | None | This PR |
| S1 | Side-by-side | `canonical-match.ts` + `buildCanonicalMatch()` + authority cache writer | None (nothing reads new code) | Explicit PR |
| S2 | Shadow validation | Authority cache written alongside existing; compare outputs | None (pages still read old path) | Explicit PR + flag |
| S3 | Page opt-in | One page (Results) migrated to read `CanonicalMatch[]`; others unchanged | Low | Explicit PR |
| S4 | Full cutover | All WC pages read `CanonicalMatch[]`; `getWCAuthorityMatchesCached()` writes authority cache | Medium | Explicit PR |
| S5 | Legacy removal | `overlayMatchStates()`, `getRecentMatchesCached()`, `type CanonicalMatch = Match` removed | Low (after S4 stable) | Explicit PR |

---

## S0 — Dormant

**Status: This task (DATA-18A). Completed when this PR merges.**

### What is committed

- `DATA18A_*.md` architecture documents
- `src/lib/canonical-match.ts` — interface + type definitions only
  - `CanonicalMatch` interface
  - Supporting types (`CanonicalMatchSource`, `CanonicalTeam`, `CanonicalScore`, etc.)
  - `buildCanonicalMatch()` function (not exported from any index; not called by anything)
  - File is not imported by any page or API module

### What does NOT change

- No pages modified
- No cache keys added or changed
- No existing functions modified
- No new environment variables

### Validation

```
npx tsc --noEmit    → 0 errors
```

### Rollback

Delete `src/lib/canonical-match.ts`. No other changes to revert.

---

## S1 — Side-by-Side Build

**New task: DATA-18B**

### What changes

1. `src/lib/canonical-match.ts` — add `buildAllCanonicalMatches()`:
   - Reads bulk feeds (SCHEDULED/TIMED, FINISHED, live) — same sources as `getWCAuthorityMatchesCached()`
   - Batch-reads snapshots via `kv.mget`
   - Calls `buildCanonicalMatch()` per match
   - Returns `CanonicalMatch[]`

2. `src/lib/authority-cache.ts` (new dormant file):
   - `writeAuthorityCache()` — builds + writes `goalradar:wc:authority:v1`
   - `readAuthorityCache()` — reads primary then DR fallback
   - Not called from anywhere yet

3. `src/lib/api.ts` — add `getWCAuthorityMatchesV2()` (dormant, not exported from pages):
   - Reads `goalradar:wc:authority:v1`
   - Falls back to `buildAllCanonicalMatches()` on miss

### What does NOT change

- All pages still call `getWCAuthorityMatches()` (current path)
- No orchestrator changes
- No cache keys written in production until S2

### Risk level: None

New code exists but nothing reads it. Any bug in `buildCanonicalMatch()` is
unreachable from production.

### Validation

```
npx tsc --noEmit    → 0 errors
Unit test: buildCanonicalMatch() with mock inputs → expected CanonicalMatch shape
```

### Rollback

Delete `src/lib/authority-cache.ts`. Revert `canonical-match.ts` additions.

---

## S2 — Shadow Validation

**New task: DATA-18C**

### What changes

1. Orchestrator cron — after existing bulk feed refresh, call `writeAuthorityCache()`:
   - Flag-gated: `AUTHORITY_CACHE_ENABLED=true` (env var, default false)
   - Writes `goalradar:wc:authority:v1` + DR copy
   - Does NOT affect page reads

2. Shadow comparison endpoint (optional, internal-only):
   - `/api/debug/authority-compare` — reads both old (`getWCAuthorityMatches()`) and
     new (`getWCAuthorityMatchesV2()`) for the same 4 benchmark matches and diffs them
   - Protected by `INTERNAL_TOKEN` header; not indexed by Google
   - Removed in S5

### What does NOT change

- All pages still read from current path
- No ISR changes
- `AUTHORITY_CACHE_ENABLED` defaults false in production until this stage

### Validation checks

For all 4 benchmark matches, shadow endpoint must show:
- Identical `score.fullTime` between old and new paths
- `enrichmentApplied=true` for FINISHED WC matches
- `goals` array non-empty for matches that show goals on the match page
- `state` matches `classifyMatchState()` output on old path

### Risk level: None

Pages read zero bytes from the new cache. Worst case: orchestrator cron takes
slightly longer due to the extra write. Can be disabled by setting
`AUTHORITY_CACHE_ENABLED=false`.

### Rollback

Set `AUTHORITY_CACHE_ENABLED=false`. No page behaviour changes.

---

## S3 — Page Opt-In (Results Page First)

**New task: DATA-18D**

### What changes

1. `src/app/world-cup-2026-results/page.tsx`:
   - Import `getWCAuthorityMatchesV2()` instead of `getWCAuthorityMatches()`
   - Adjust field access: `m.goals` instead of (current) no-op, `m.state` instead of `classify(m)`
   - The Results page already uses `classifyMatchState()` — replace with `m.state` directly

2. `AUTHORITY_CACHE_ENABLED` must be `true` for this stage to work correctly.

### Why Results page first

- Results page is the highest-value page for score correctness (DATA-16D motivation)
- It has no events rendering (only scores) — so field-access changes are minimal
- It is easy to visually verify: check all 4 benchmark matches show correct scores

### Risk level: Low

One page reads from new path. Other pages unchanged. If Results page shows
wrong data, the fix is to revert the import — one line.

### Validation checks

Deploy to production with `AUTHORITY_CACHE_ENABLED=true`:
1. `/world-cup-2026-results` shows same scores as before for all 4 benchmark matches
2. `FT` status badge correct for all FINISHED matches
3. `Live Now` section appears correctly for any live matches
4. `played` count matches Hub page count

### Rollback

Revert the one import line in Results page.

---

## S4 — Full Cutover

**New task: DATA-18E**

### What changes

1. All remaining WC pages migrated to `getWCAuthorityMatchesV2()`:
   - `/world-cup-2026` (Hub)
   - `/world-cup-2026-schedule`
   - `/world-cup-2026/fixtures`
   - `/world-cup-2026/[group]`

2. `src/lib/api.ts`:
   - `getWCAuthorityMatches()` rewritten to return from `readAuthorityCache()` directly
     (replacing the inline merge + `overlayMatchStates()` call)
   - `getWCAuthorityMatchesV2()` becomes the implementation; `getWCAuthorityMatches()`
     becomes the public alias (maintains API surface unchanged for pages)
   - `CanonicalMatch` type alias `= Match` replaced with the real interface import

3. `src/lib/match-state-overlay.ts`:
   - `overlayMatchStates()` no longer called from the authority path
   - Still used by `getUpcomingMatchesCached()` and other non-WC paths — NOT removed in S4

4. All pages: field access changes from `Match` shape to `CanonicalMatch` shape:
   - `m.status === 'FINISHED'` → `m.state === 'finished'` (already using `classifyMatchState()` on current path, minimal change)
   - `classify(m)` call sites → `m.state` (direct field access, no function call)

### Risk level: Medium

All WC pages on new path. Mitigated by:
- S3 validation already confirmed Results page works
- S2 shadow comparison confirmed output parity for all 4 benchmark matches
- `AUTHORITY_CACHE_ENABLED` must be stable in production since S2
- `buildCanonicalMatch()` has unit test coverage from S1

### Validation checks

Post-deploy production check:
1. All 4 benchmark matches show correct scores on Hub, Results, Group pages
2. Hub "Recent Results" section shows same matches as Results page
3. Schedule page shows no FINISHED matches in upcoming section
4. Group J page shows Argentina 3-0 Algeria in Results section
5. `npx tsc --noEmit` → 0 errors

### Rollback

Revert all page imports to `getWCAuthorityMatches()` (old implementation).
The old implementation remains in the codebase throughout S4 — no net removal.
Revert is a 5-file import change.

---

## S5 — Legacy Removal

**New task: DATA-18F (after S4 stable for ≥1 week)**

### What removes

1. `src/lib/canonical-match.ts` — `buildCanonicalMatch()` internal helper absorbed
   into `authority-cache.ts` or kept; DATA-17 `type CanonicalMatch = Match` alias removed
2. `src/lib/api.ts`:
   - Remove `getWCAuthorityMatchesCached()` (replaced by authority cache reader)
   - Remove `getWCAuthorityMatchesV2()` (absorbed into `getWCAuthorityMatches()`)
   - Remove `getRecentMatchesCached()` export if no other callers remain
3. `src/lib/match-state-overlay.ts`:
   - Remove `overlayMatchStates()` if no callers remain outside WC authority path
   - Keep if still used by non-WC pages
4. Shadow comparison endpoint `src/app/api/debug/authority-compare/route.ts` — deleted

### Risk level: Low

By S5, S4 has been stable for ≥1 week. Legacy code is unused.

### Validation

```
npx tsc --noEmit    → 0 errors
grep -r getWCAuthorityMatchesCached src/  → 0 results
grep -r getRecentMatchesCached src/       → 0 results (if removed)
```

---

## Rollback Summary

| Stage | Rollback action | Time to revert |
|-------|----------------|---------------|
| S0 | Delete `src/lib/canonical-match.ts` | < 1 min |
| S1 | Delete `authority-cache.ts`, revert `canonical-match.ts` | < 2 min |
| S2 | Set `AUTHORITY_CACHE_ENABLED=false` (env var, no deploy) | < 1 min |
| S3 | Revert 1 import line in Results page | < 2 min |
| S4 | Revert 5 page import lines; old path still in codebase | < 5 min |
| S5 | Git revert of S5 commit | < 2 min |

---

## Risk Register

| Risk | Stage | Severity | Mitigation |
|------|-------|----------|-----------|
| `buildCanonicalMatch()` produces wrong score for a match | S2, S3 | High | Shadow comparison in S2 catches before any page reads new path |
| Authority cache cold miss on first deploy | S3, S4 | Medium | `readAuthorityCache()` falls back to cold `buildAllCanonicalMatches()`; same result as current path |
| `CanonicalMatch` field access breaks TypeScript | S4 | Low | `npx tsc --noEmit` required to pass before merge |
| Orchestrator cron takes too long due to extra authority write | S2 | Low | Write is async fire-and-forget; can be disabled via flag |
| ESPN team ID reconciliation regression | S1, S4 | Medium | S2 shadow comparison specifically checks `goals[].team.id === fdMatch.homeTeam.id or awayTeam.id` |
| KV payload size limit (104 matches × enriched) | S2 | Low | Estimated 310–415 KB; KV limit 25 MB; 60× headroom |
