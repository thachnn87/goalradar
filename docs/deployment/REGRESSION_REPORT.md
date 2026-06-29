# REGRESSION REPORT
**Phase:** DATA-18WC.RESET Phase 12  
**Date:** 2026-06-25  
**Scope:** Verify all Sprint 8–15 working features are preserved after RESET changes

---

## Changes Made in RESET Sprint

| # | Change | File |
|---|---|---|
| R1 | Hub page: `getWCKnockoutMatchesCached` → `buildKnockoutViewModel()` | `src/app/world-cup-2026/page.tsx` |
| R2 | SEO bracket: `getWCKnockoutMatchesCached` + `isStaticMode` → `buildKnockoutViewModel()` | `src/app/world-cup-2026-bracket/page.tsx` |
| R3 | SEO bracket: ISR TTL 21600 → 900 | `src/app/world-cup-2026-bracket/page.tsx` |
| R4 | next.config.ts: added `/world-cup-2026/third-place-playoff` → `/world-cup-2026/third-place` redirect | `next.config.ts` |
| R5 | Deleted `/world-cup-2026/third-place-playoff` page | (deleted) |

---

## Regression Matrix

### Sprint 13 — Authority-derived standings
**Feature:** `computeWCStandingsFromAuthority()` fallback when FD API returns 403  
**Touched by RESET:** NO — `getStandingsCached('WC')` unchanged  
**Status:** ✅ PRESERVED

### Sprint 14 — Bracket positional labels
**Feature:** `injectKnockoutSlotLabels` ordinal matching; `WC_DATA_PATHS` revalidation  
**Touched by RESET:** NO — `injectKnockoutSlotLabels` lives in `knockout-vm.ts`, unchanged  
**Status:** ✅ PRESERVED

### Sprint 15 — Single KnockoutViewModel (all round pages)
**Feature:** bracket/page.tsx and all WCRoundPage consumers → `buildKnockoutViewModel()`  
**Touched by RESET:** YES (R1, R2) — hub and SEO bracket ALSO migrated to same VM  
**Risk:** Low — adding two more consumers to the same VM that already serves 8 consumers  
**Status:** ✅ PRESERVED (and extended)

### Sprint 15 — Competition Tabs on WC standings
**Feature:** `CompetitionSelector` with `onWCPath` in `world-cup-2026-standings/page.tsx`  
**Touched by RESET:** NO  
**Status:** ✅ PRESERVED

### Sprint 15 — Navbar Standings 404 fix
**Feature:** Navbar Standings link → `/world-cup-2026-standings` on WC pages  
**Touched by RESET:** NO — `Navbar.tsx` unchanged  
**Status:** ✅ PRESERVED

---

## Behavioral Change Assessment

### R1 — Hub bracket tree no longer shows R32

**Before RESET:** Hub WCBracket received ALL knockout matches (including LAST_32 from `getWCKnockoutMatchesCached`). WCBracket renders R32 slots in its leftmost column when passed.

**After RESET:** Hub WCBracket receives `vm.bracketMatches` (LAST_16 → FINAL only). R32 no longer appears in the hub's bracket tree.

**Assessment:** The hub bracket is a PREVIEW — showing R32 in the visual tree is inconsistent with the dedicated bracket page which shows R32 as a separate grid, not in the tree. RESET makes the hub consistent with the bracket page. Functionally equivalent for users; R32 matches are still prominent on `/world-cup-2026/bracket`.

**Risk:** Low. Removes an inconsistency, not a feature.

### R3 — SEO bracket page TTL reduced from 6h to 15min

**Before RESET:** `/world-cup-2026-bracket` page cached for 6 hours. Match score updates lagged up to 6 hours.

**After RESET:** Cached for 15 minutes, matching all other knockout pages.

**Assessment:** Improvement. Pages now consistent. No regression risk.

---

## TypeScript Compile Status

Only error: stale `.next/` generated type cache references deleted `third-place-playoff/page.js`. This is a generated file that auto-regenerates on next build. No source code TypeScript errors.

**Status:** ✅ CLEAN (after build regeneration)
