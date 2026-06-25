# PRODUCTION DIVERGENCE
**Phase:** DATA-18WC.VERIFY Phase 3  
**Date:** 2026-06-25

---

## Purpose

Every place where production behavior differs from the Source of Truth established in DATA-18WC.RESET. Each issue maps to: Root Cause, Pipeline, Component, Cache, ViewModel, Route, Severity, Fix.

---

## Divergences

---

### D1 — Schedule Page Shows Only 4 Upcoming Matches

**Severity:** HIGH  
**Status:** REQUIRES FIX

**Observed:** `https://www.goalradar.org/world-cup-2026-schedule` shows 4 upcoming fixtures.  
**Expected:** All upcoming WC matches (up to 48 shown). Today is 2026-06-25; at minimum 18 group stage + 32 knockout = 50+ upcoming matches exist.

| Attribute | Value |
|---|---|
| **Route** | `/world-cup-2026-schedule` → `src/app/world-cup-2026-schedule/page.tsx` |
| **Pipeline** | `getWCAuthorityMatchesCached()` — merges 3 KV buckets (upcoming + results + live) |
| **Cache key** | `/competitions/WC/matches?status=SCHEDULED,TIMED` (populated by cron from FD API) |
| **ViewModel** | None — raw `Match[]` filtered inline |
| **Component** | `MatchCard` links in day-by-day grid |
| **Root Cause** | `getWCAuthorityMatchesCached()` depends on FD API's `SCHEDULED,TIMED` feed for upcoming matches. FD API returns only matches within a limited forward window (~7 days). Matches scheduled beyond this window (all knockout stage, future group stage) are not in the KV. `getWCAuthorityMatchesV2()` reads `goalradar:wc:authority:v1` which is a pre-built canonical dataset with all 104 confirmed match dates. |
| **Evidence** | Fixtures page (`/world-cup-2026/fixtures`) uses `getWCAuthorityMatchesV2()` and shows 40+ matches. Schedule page uses `getWCAuthorityMatchesCached()` and shows 4. |
| **Fix** | Migrate `world-cup-2026-schedule/page.tsx` from `getWCAuthorityMatchesCached()` → `getWCAuthorityMatchesV2()` |
| **Fix safety** | `classifyMatchState()` already accepts both `Match` (status) and `CanonicalMatch` (state) shapes. `CanonicalTeam` has `name`, `shortName`. `CanonicalMatch` has `id`, `utcDate`, `stage`. All downstream usage is compatible. |

**Comparison:**

| | `/world-cup-2026/fixtures` | `/world-cup-2026-schedule` |
|---|---|---|
| Source function | `getWCAuthorityMatchesV2` | `getWCAuthorityMatchesCached` |
| Cache | `goalradar:wc:authority:v1` (104 matches) | merged KV buckets (FD window limited) |
| Upcoming count | 40+ | **4** |

---

### D2 — Hub WCBracket R32 Shows TBD Slots

**Severity:** LOW (documented behavioral change, not a bug)  
**Status:** ACCEPTED — NO FIX REQUIRED

**Observed:** Hub's WCBracket tree renders 16 R32 layout slots as TBD/empty.  
**Before RESET:** R32 slots showed confirmed Group stage qualifier teams (Germany, Mexico, USA, Argentina visible as opponents).

| Attribute | Value |
|---|---|
| **Route** | `/world-cup-2026` → `src/app/world-cup-2026/page.tsx` |
| **Pipeline** | `buildKnockoutViewModel()` |
| **Cache key** | `goalradar:wc:authority:v1` |
| **ViewModel** | `vm.bracketMatches` = matches where `BRACKET_TREE_STAGES.has(m.stage)` = LAST_16 + QF + SF + FINAL only |
| **Component** | `WCBracket` — always renders 16 LAST_32 layout slots from internal `ROUND_MATCH_COUNT.LAST_32 = 16`, regardless of data passed |
| **Root Cause** | RESET intentional change: Hub now passes `vm.bracketMatches` (R16+) instead of all knockout matches. `WCBracket` generates R32 slots internally but has no data to fill them. |
| **Rationale** | The bracket tree on the hub page is a PREVIEW of the full bracket. R32 is the first knockout round and is shown as a separate grid on `/world-cup-2026/bracket`. Excluding R32 from the hub tree preview is consistent with the bracket page's design. This removes an inconsistency (hub tree showed R32; bracket page doesn't include R32 in its WCBracket tree either). |
| **Fix** | None — accepted behavioral change. Documented in REGRESSION_REPORT.md as R1. |

---

### D3 — CompetitionSelector Not Verifiable via SSR

**Severity:** N/A (observation, not a divergence)  
**Status:** KNOWN LIMITATION — NOT A BUG

**Observed:** CompetitionSelector on standings, groups, and WC pages renders via client-side Suspense. SSR HTML fetched via WebFetch shows server-rendered shell only.

| Attribute | Value |
|---|---|
| **Route** | `/world-cup-2026-standings`, `/world-cup-2026-groups`, `/world-cup-2026` |
| **Component** | `CompetitionSelector` (Suspense-wrapped, client-rendered) |
| **Root Cause** | By design — CompetitionSelector is dynamic (user's selected competition). SSR boundary is intentional. |
| **Fix** | None — not a divergence from Source of Truth. Navigation tabs are client-hydrated. |

---

## Summary Table

| # | Surface | Severity | Root Cause | Fix Required |
|---|---|---|---|---|
| D1 | `/world-cup-2026-schedule` | HIGH | Wrong data source (`getWCAuthorityMatchesCached` vs `getWCAuthorityMatchesV2`) | YES |
| D2 | Hub WCBracket R32 | LOW | Intentional RESET behavioral change | NO — accepted |
| D3 | CompetitionSelector | N/A | Client-side Suspense design | NO — by design |

---

## Pre-condition Check

Before implementing D1 fix: confirm `CanonicalMatch` type compatibility with all usages in `world-cup-2026-schedule/page.tsx`:

| Usage | Field | `CanonicalMatch` has it? | Compatible? |
|---|---|---|---|
| `classifyMatchState(m, today)` | `m.state` | ✅ `state: 'scheduled'\|'live'\|'finished'\|'cancelled'` | ✅ |
| `groupByDay(matches)` | `m.utcDate` | ✅ | ✅ |
| `matchPath(m.id, ...)` | `m.id` | ✅ `id: number` | ✅ |
| `m.homeTeam?.name` | `homeTeam.name` | ✅ `CanonicalTeam.name: string` | ✅ |
| `m.awayTeam?.name` | `awayTeam.name` | ✅ `CanonicalTeam.name: string` | ✅ |
| `m.homeTeam?.shortName` | `homeTeam.shortName` | ✅ `CanonicalTeam.shortName: string` | ✅ |
| `STAGE_LABELS[m.stage ?? '']` | `m.stage` | ✅ `stage: string` | ✅ |
| `m.score?.fullTime?.home` | `m.score` | ✅ `CanonicalScore = Score` | ✅ |
| JSON-LD `m.utcDate` | `m.utcDate` | ✅ | ✅ |

All usages are type-compatible. Migration is safe.
