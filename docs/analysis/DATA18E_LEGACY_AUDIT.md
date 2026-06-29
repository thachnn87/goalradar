# DATA-18E Phase 3 — Legacy Feed Audit

Date: 2026-06-17  
Commit: `0c963a8`

Audit of all callers of `getRecentMatchesCached`, `getUpcomingMatchesCached`, and `overlayMatchStates` across the codebase.

---

## `getWCAuthorityMatches()` (the type-lie alias)

**Definition:** `src/lib/api.ts` line ~591  
**Runtime type:** Returns `Match[]` (delegates to `getWCAuthorityMatchesCached()` which does 3-feed merge + `overlayMatchStates()`)  
**Declared type:** Claims `CanonicalMatch[]` — TYPE LIE

### Callers after Phase 4

| File | Status | Notes |
|------|--------|-------|
| `src/app/api/debug/authority-compare/route.ts` | **KEPT** | Debug-only endpoint — compares old vs new path deliberately |
| `src/app/world-cup-2026/groups/page.tsx` | **KEPT (out of scope)** | Groups index page — not a listing page, lower traffic |

All 6 WC listing pages: **MIGRATED** to `getWCAuthorityMatchesV2()`.

---

## `getWCAuthorityMatchesCached()` (the 3-feed merge)

**Definition:** `src/lib/api.ts` line ~536  
**Returns:** `Promise<{ matches: Match[] }>`  
**Implementation:** Merges `getUpcomingMatchesCached('WC')` + `getWCResultsCached()` + `getWCLiveMatches()`, then calls `overlayMatchStates()`

### Callers after Phase 4

| File | Status | Notes |
|------|--------|-------|
| `src/lib/api.ts` — `getWCAuthorityMatches()` | **KEPT** | Wrapper alias — kept for authority-compare debug endpoint |

---

## `getUpcomingMatchesCached()`

**Definition:** `src/lib/api.ts`  
**KV key:** `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED`

### Callers after Phase 4

| File | Status | Notes |
|------|--------|-------|
| `src/app/world-cup-2026/matches-today/page.tsx` | **REMOVED** | Replaced by single V2 call |
| `src/app/world-cup-2026/matches-tomorrow/page.tsx` | **REMOVED** | Replaced by single V2 call |
| `src/lib/api.ts` — `getWCAuthorityMatchesCached()` | **KEPT** | Internal to legacy merge path |
| `/schedule` page | **KEPT** | Multi-competition schedule, correct scope |

---

## `getWCResultsCached()`

**Definition:** `src/lib/api.ts`  
**KV key:** `goalradar:/competitions/WC/matches?status=FINISHED`

### Callers after Phase 4

| File | Status | Notes |
|------|--------|-------|
| `src/app/world-cup-2026/matches-today/page.tsx` | **REMOVED** | Replaced by single V2 call |
| `src/app/api/debug/authority-compare/route.ts` | **KEPT** | Used only when `scope=all` to read FINISHED feed for match IDs |
| `src/lib/api.ts` — `getWCAuthorityMatchesCached()` | **KEPT** | Internal to legacy merge path |

---

## `getWCLiveMatchesCached()`

**Definition:** `src/lib/api.ts`  
**KV key:** `goalradar:live:wc-matches`

### Callers after Phase 4

| File | Status | Notes |
|------|--------|-------|
| `src/app/world-cup-2026/page.tsx` | **REMOVED** | Hub now uses V2 exclusively |
| `src/app/world-cup-2026/matches-today/page.tsx` | **REMOVED** | Replaced by V2 |
| `/live` page | **KEPT** | Live-only page — correct scope, not a listing page |
| `src/lib/api.ts` — `getWCAuthorityMatchesCached()` | **KEPT** | Internal to legacy merge path |

---

## `overlayMatchStates()`

**Definition:** `src/lib/match-state-overlay.ts`  
**Purpose:** Promotes SCHEDULED → FINISHED if a snapshot exists for a match

### Callers after Phase 4

| File | Status | Notes |
|------|--------|-------|
| `src/lib/api.ts` — `getWCAuthorityMatchesCached()` | **KEPT** | Only runs on legacy merge path — no WC listing page calls it directly |

---

## Summary

| Legacy function | WC listing page callers remaining | Overall callers remaining |
|----------------|----------------------------------|--------------------------|
| `getWCAuthorityMatches()` | 0 | 1 (debug endpoint) |
| `getWCAuthorityMatchesCached()` | 0 | 1 (internal alias) |
| `getUpcomingMatchesCached()` | 0 | 2 (schedule page + internal) |
| `getWCResultsCached()` | 0 | 2 (debug endpoint + internal) |
| `getWCLiveMatchesCached()` | 0 | 2 (live page + internal) |
| `overlayMatchStates()` | 0 | 1 (internal to legacy merge) |

**All WC listing pages are now legacy-free.** The legacy merge path (`getWCAuthorityMatchesCached`) is retained only for the `authority-compare` debug endpoint (intentional — it is the old path being compared against).
