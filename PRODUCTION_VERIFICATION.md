# PRODUCTION VERIFICATION
**Phase:** DATA-18WC.RESET Phase 10  
**Date:** 2026-06-25  
**Domain:** https://www.goalradar.org

---

## Verification Method

Production HTML is fetched via WebFetch. Cache-busting params appended to bypass WebFetch 15-minute internal cache. TypeScript compile success is NOT counted as verification — only observed production output counts.

---

## Pre-RESET Baseline (from Sprint 15, commit ed326b1)

These were verified before the RESET sprint started:

| Surface | Expected | Observed | Commit |
|---|---|---|---|
| `/world-cup-2026/bracket` R32 section | Positional labels ("1st Group A" etc.) | "1st Group A – 3rd (B/C/D)" | ed326b1 |
| `/world-cup-2026/bracket` All Matches section | Same labels as R32 | Identical | ed326b1 |
| `/world-cup-2026/round-of-32` | Positional labels | "1st Group A – 3rd (B/C/D)" | ed326b1 |
| `/world-cup-2026/semi-finals` | "Winner QF1" labels | "Winner QF1 vs Winner QF2" | ed326b1 |
| `/world-cup-2026/final` | "Winner SF1" vs "Winner SF2" | "Winner SF1 – Winner SF2" | ed326b1 |
| Navbar Standings link on WC pages | → `/world-cup-2026-standings` | Correct | ed326b1 |

---

## RESET Sprint Changes to Verify

The following code changes require production verification after deployment:

### V1 — Hub Bracket Preview (hub → buildKnockoutViewModel)

**What changed:** `src/app/world-cup-2026/page.tsx` — removed `getWCKnockoutMatchesCached()` direct call; replaced with `buildKnockoutViewModel()`. WCBracket now receives `bracketMatches` (R16→Final) instead of all knockout matches.

**Expected:** Hub's WCBracket tree shows R16→Final fixtures only. R32 matches no longer appear in the bracket tree (they're visible separately as the Round of 32 grid on `/world-cup-2026/bracket`).

**Verify at:** `https://www.goalradar.org/world-cup-2026`  
**Look for:** Visual bracket section — should show R16, QF, SF, Final slots. Labels should match `/world-cup-2026/bracket` exactly.

### V2 — SEO Bracket Page (world-cup-2026-bracket → buildKnockoutViewModel)

**What changed:** `src/app/world-cup-2026-bracket/page.tsx` — replaced `getWCKnockoutMatchesCached()` + `isStaticMode()` with `buildKnockoutViewModel()`. ISR TTL changed from 21600s to 900s.

**Expected:** Each knockout round card shows the same match data as `/world-cup-2026/bracket`. Static slot fallback still appears when `vm.hasApiData = false`.

**Verify at:** `https://www.goalradar.org/world-cup-2026-bracket`  
**Look for:** Knockout rounds section — each round card shows matches (or static slots if no API data). Data matches the nested bracket page.

### V3 — Third-place redirect

**What changed:** `next.config.ts` — added 301 redirect from `/world-cup-2026/third-place-playoff` → `/world-cup-2026/third-place`. Deleted `third-place-playoff/page.tsx`.

**Expected:** Visiting `/world-cup-2026/third-place-playoff` redirects to `/world-cup-2026/third-place` with HTTP 301.

**Verify at:** `https://www.goalradar.org/world-cup-2026/third-place-playoff` (should redirect)

---

## Regression Checks

Verify Sprint 15 features were not broken by RESET changes:

| Surface | Verify |
|---|---|
| `/world-cup-2026/bracket` R32 positional labels | Still showing "1st Group A – 3rd (B/C/D)" |
| `/world-cup-2026/round-of-32` | Same labels |
| `/world-cup-2026-standings` | Competition tabs visible (Suspense-rendered) |
| Navbar on WC pages | Standings → `/world-cup-2026-standings` |
| `/world-cup-2026/third-place` | Loads normally (canonical page works) |
