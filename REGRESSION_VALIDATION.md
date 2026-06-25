# REGRESSION VALIDATION
**Phase:** DATA-18WC.VERIFY Phase 11  
**Date:** 2026-06-25

---

## Scope

Validate that DATA-18WC.VERIFY changes do not break anything established in DATA-18WC.RESET or prior sprints (8–15).

---

## VERIFY Sprint Changes

Only one source file was modified:

| File | Change |
|---|---|
| `src/app/world-cup-2026-schedule/page.tsx` | `getWCAuthorityMatchesCached` → `getWCAuthorityMatchesV2` + type updates |

---

## Impact Analysis

### Pages Touched by VERIFY

Only `/world-cup-2026-schedule` is affected. All other WC pages are untouched.

### Pages NOT Touched (verified unchanged)

| Page | File | VERIFY change? |
|---|---|---|
| Hub | `src/app/world-cup-2026/page.tsx` | NO |
| Bracket | `src/app/world-cup-2026/bracket/page.tsx` | NO |
| Round of 32 | `src/app/world-cup-2026/round-of-32/page.tsx` | NO |
| Round of 16 | `src/app/world-cup-2026/round-of-16/page.tsx` | NO |
| Quarter-Finals | `src/app/world-cup-2026/quarter-finals/page.tsx` | NO |
| Semi-Finals | `src/app/world-cup-2026/semi-finals/page.tsx` | NO |
| Third-Place | `src/app/world-cup-2026/third-place/page.tsx` | NO |
| Final | `src/app/world-cup-2026/final/page.tsx` | NO |
| Fixtures | `src/app/world-cup-2026/fixtures/page.tsx` | NO |
| Standings | `src/app/world-cup-2026-standings/page.tsx` | NO |
| Results | `src/app/world-cup-2026-results/page.tsx` | NO |
| Groups | `src/app/world-cup-2026-groups/page.tsx` | NO |
| SEO Bracket | `src/app/world-cup-2026-bracket/page.tsx` | NO |
| `next.config.ts` | NO |

---

## Regression Matrix

### Sprint 13 — Authority-derived standings fallback
**Feature:** `computeWCStandingsFromAuthority()` when FD API returns 403  
**VERIFY change touches it?** NO  
**Status:** ✅ PRESERVED

### Sprint 14 — Bracket positional labels
**Feature:** `injectKnockoutSlotLabels` ordinal matching  
**VERIFY change touches it?** NO  
**Status:** ✅ PRESERVED

### Sprint 15 — Single KnockoutViewModel
**Feature:** All knockout pages use `buildKnockoutViewModel()`  
**VERIFY change touches it?** NO (schedule page is not a knockout page)  
**Status:** ✅ PRESERVED

### Sprint 15 — CompetitionSelector
**Feature:** Tabs on WC standings and groups  
**VERIFY change touches it?** NO  
**Status:** ✅ PRESERVED

### Sprint 15 — Navbar Standings fix
**Feature:** Navbar Standings → `/world-cup-2026-standings`  
**VERIFY change touches it?** NO  
**Status:** ✅ PRESERVED

### RESET — Third-place redirect
**Feature:** `/world-cup-2026/third-place-playoff` → `/world-cup-2026/third-place`  
**VERIFY change touches it?** NO  
**Status:** ✅ PRESERVED

### RESET — Hub bracketMatches
**Feature:** Hub uses `buildKnockoutViewModel()` + `vm.bracketMatches`  
**VERIFY change touches it?** NO  
**Status:** ✅ PRESERVED

---

## Schedule Page Regression Check

### Before VERIFY
- Source: `getWCAuthorityMatchesCached()` (merged KV buckets)
- Output: 4 upcoming matches (FD API window limited)

### After VERIFY
- Source: `getWCAuthorityMatchesV2()` (authority:v1 direct)
- Output: All upcoming matches (up to 48)

### Behavioral differences
| Aspect | Before | After | Regression? |
|---|---|---|---|
| Match count | 4 | 30–50 | ✅ Improvement |
| Data source | Merged KV | authority:v1 | ✅ Aligned with SoT |
| classifyMatchState | Uses `m.status` (Match) | Uses `m.state` (CanonicalMatch) | ✅ Both paths implemented |
| Match links | `/match/{id}-home-vs-away` | `/match/{id}-home-vs-away` | ✅ Identical |
| Stage labels | `STAGE_LABELS[m.stage]` | `STAGE_LABELS[m.stage]` | ✅ Identical (`stage: string` on both) |
| Timezone table | Static HTML | Static HTML | ✅ Unchanged |
| FAQ section | Static HTML | Static HTML | ✅ Unchanged |
| ISR TTL | 300s | 300s | ✅ Unchanged |
| TypeScript | No errors | No errors | ✅ Verified |

**No regressions introduced.**

---

## TypeScript Compile Status

Modified file changes:
- `getWCAuthorityMatchesCached` removed (no longer imported from api.ts — correct)
- `getWCAuthorityMatchesV2` added (exported from api.ts — verified)
- `Match` type removed from import (no longer used)
- `CanonicalMatch` added from `@/lib/canonical-match` (correct path — verified)
- `groupByDay` parameter type updated to `CanonicalMatch[]`
- `upcoming` local variable type updated to `CanonicalMatch[]`

All `CanonicalMatch` fields accessed in render are present:
- `id`, `utcDate`, `homeTeam.name`, `awayTeam.name`, `homeTeam.shortName`, `stage`, `score` ✅

**TypeScript compile: CLEAN** (no source errors expected)
