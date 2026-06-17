# DATA-18A Migration Plan
## Staged Migration S0 → S5

Date: 2026-06-17
Status: Design only — no implementation activated.
Updated: 2026-06-17 DATA-18A.2 — B5 fix: shadow comparison mandatory; S4 split into S4a + S4b.

---

## Overview

| Stage | Name | What changes | Risk | Activation |
|-------|------|-------------|------|-----------|
| S0 | Dormant | Types + architecture docs committed, nothing imported | None | DATA-18A ✅ |
| S1 | Side-by-side | `buildAllCanonicalMatches()` + `authority-cache.ts` + `getWCAuthorityMatchesV2()` | None | DATA-18B |
| S2 | Shadow validation | Orchestrator writes authority cache (flag-gated); **mandatory** parity gate blocks S3 | None | DATA-18C |
| S3 | Page opt-in | Results page migrated; `statusBadge()` updated to read `m.state` | Low | DATA-18D |
| S4a | Hub + Schedule cutover | Hub + Schedule pages migrated; live refresh loop active | Medium | DATA-18E |
| S4b | Fixtures + Group cutover | Fixtures + Group pages migrated (separate PR from S4a) | Medium | DATA-18E |
| S5 | Legacy removal | Remove `overlayMatchStates` WC path, `getWCAuthorityMatchesCached`, type alias | Low | DATA-18F |

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

2. Shadow comparison endpoint (**required**, internal-only):
   - `/api/debug/authority-compare` — reads both old (`getWCAuthorityMatches()`) and
     new (`getWCAuthorityMatchesV2()`) for the same 4 benchmark matches and diffs them
   - Protected by `INTERNAL_TOKEN` header; not indexed by Google
   - **S3 is BLOCKED until this endpoint returns all-GREEN for all 4 benchmark matches**
   - Removed in S5

### What does NOT change

- All pages still read from current path
- No ISR changes
- `AUTHORITY_CACHE_ENABLED` defaults false in production until this stage

### S2 mandatory gate — S3 is BLOCKED until ALL of the following pass

For all 4 benchmark matches (537397, 537392, 537391, 537351), shadow endpoint must show:
- Identical `score.fullTime` between old and new paths
- `enrichmentApplied=true` for all 4 (all are FINISHED WC matches with confirmed enrichment)
- `goals` array length matches match-page display for each match
- `state === 'finished'` for all 4
- `integrity.status === 'ok'` for all 4 (C2 team IDs reconciled, C3 score non-null)

If any check fails → file DATA-18C.1 remediation; do NOT proceed to S3.

### Risk level: None

Pages read zero bytes from the new cache. Can be disabled by `AUTHORITY_CACHE_ENABLED=false`.

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
- It has no events rendering (only scores) — field-access changes are minimal
- Easy to visually verify: check all 4 benchmark matches show correct scores

### Required field migration in S3 — `statusBadge()` must be updated

`statusBadge()` in `world-cup-2026-results/page.tsx` reads `m.status` (a raw FD
protocol string). `CanonicalMatch` does not have a `status` field — it uses `m.state`.
This function **must** be updated before S3 deploys or all matches will render with
a blank status badge.

Migration:
```typescript
// Before (Match shape):
if (m.status === 'IN_PLAY') return { label: m.minute != null ? `${m.minute}'` : 'LIVE', ... };
if (m.status === 'PAUSED')  return { label: 'HT', ... };
if (m.status === 'FINISHED') return { label: 'FT', ... };

// After (CanonicalMatch shape):
if (m.state === 'live')     return { label: m.minute != null ? `${m.minute}'` : 'LIVE', ... };
if (m.state === 'live' && ...) return { label: 'HT', ... };  // PAUSED: needs m.source to distinguish
if (m.state === 'finished') return { label: 'FT', ... };
```

Note: `CanonicalMatch.state` collapses IN_PLAY and PAUSED into `'live'`. If the
Results page needs to distinguish them, either keep the raw FD status as a separate
field on `CanonicalMatch`, or derive PAUSED from `m.minute` context. Resolve in S3 scope.

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

## S4a — Hub + Schedule Cutover

**New task: DATA-18E (first PR)**

S4 is split into two sub-stages (DATA-18A.2 recommendation R9).
S4a covers simpler pages with no group filtering. S4b covers pages with more
complex state logic. Each is a separate PR with independent rollback.

**Prerequisite: Live refresh loop must be active before S4a.** The Hub page
(`revalidate=30`) must serve fresh live scores from the authority cache. The live
refresh loop writes the authority cache every 30s during live matches.

### What changes

1. `/world-cup-2026` (Hub) — migrated to `getWCAuthorityMatchesV2()`
2. `/world-cup-2026-schedule` — migrated to `getWCAuthorityMatchesV2()`
3. `src/lib/api.ts`:
   - `CanonicalMatch` type alias `= Match` replaced with real interface import
   - `getWCAuthorityMatchesCached()` deprecated but NOT removed (S5 removes it)

### Risk level: Medium

Hub + Schedule on new path. Results page (S3) already validated.
Mitigated by: S2 shadow parity confirmed; S3 working in production.

### Validation checks

1. Hub "Recent Results" and "Today's Matches" sections show same matches as Results page
2. Schedule page shows no FINISHED matches in upcoming section
3. Live score updates on Hub within 30s of a goal during a live match
4. `npx tsc --noEmit` → 0 errors

### Rollback

Revert 2 page imports + revert `CanonicalMatch` type change in `api.ts`.

---

## S4b — Fixtures + Group Cutover

**New task: DATA-18E (second PR, after S4a stable ≥24h)**

### What changes

1. `/world-cup-2026/fixtures` — migrated to `getWCAuthorityMatchesV2()`
2. `/world-cup-2026/[group]` — migrated to `getWCAuthorityMatchesV2()`

Group page note: `m.group` field access is identical on `Match` and `CanonicalMatch`.
Group filtering `authorityResult.value.matches.filter(m => m.group === apiGroup)`
works unchanged.

### Risk level: Medium

Group page is the most complex (group filter + multi-section + standings join).
Running as a separate PR from S4a limits blast radius.

### Validation checks

1. Group J page shows Argentina 3-0 Algeria in Results section
2. Group E page shows Iraq 1-4 Norway in Results section
3. Fixtures page shows all upcoming matches in date order
4. `npx tsc --noEmit` → 0 errors

### Rollback

Revert 2 page imports.

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
| S1 | Delete `authority-cache.ts`, revert `canonical-match.ts` additions | < 2 min |
| S2 | Set `AUTHORITY_CACHE_ENABLED=false` (env var, no deploy needed) | < 1 min |
| S3 | Revert Results page import + `statusBadge()` change | < 2 min |
| S4a | Revert 2 page imports + `CanonicalMatch` type alias in `api.ts` | < 3 min |
| S4b | Revert 2 page imports | < 2 min |
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
