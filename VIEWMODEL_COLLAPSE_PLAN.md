# VIEWMODEL COLLAPSE PLAN
**Phase:** DATA-18WC.RESET Phase 5  
**Date:** 2026-06-25

---

## Principle

No page builds its own data structure. Pages consume ViewModels. ViewModels live in `src/lib/`.

---

## Current ViewModel Inventory

| Domain | ViewModel | Location | Status |
|---|---|---|---|
| Knockout stages | `buildKnockoutViewModel()` | `src/lib/knockout-vm.ts` | COMPLETE |
| Group standings | `getStandingsCached('WC')` returns `StandingTable[]` | `src/lib/api.ts` | Acceptable — standard cache read |
| Upcoming/live/results | `getWCAuthorityMatchesV2()` returns `{ matches: CanonicalMatch[] }` | `src/lib/api.ts` | Acceptable — authority read |
| Team detail | `getTeamCached(id)` + `getTeamMatchesCached(id)` | `src/lib/api.ts` | Acceptable |

---

## Violations

### V1: Hub page inline bracket assembly (CRITICAL)
`world-cup-2026/page.tsx` assembles `knockoutMatches` inline for WCBracket instead of reading from ViewModel.

**Fix:** Resolved by PIPELINE_COLLAPSE_PLAN Fix 1.

### V2: Hub page inline match classification (ACCEPTABLE)
The hub classifies authority matches into live/today/upcoming/finished buckets inline. This is page-specific presentation logic and appropriate to keep at the page level.

**Decision:** No change needed. Not a ViewModel concern.

### V3: Local GroupTable function in standings page (LOW)
`world-cup-2026-standings/page.tsx` defines its own `GroupTable` function instead of using `WCGroupTable` component. Presentation duplication, not data duplication.

**Fix:** Out of RESET scope — defer to component cleanup sprint.

---

## ViewModels: Final Target State

| Domain | ViewModel | Consumers |
|---|---|---|
| Knockout | `buildKnockoutViewModel()` | bracket/page, WCRoundPage (x6), hub/page, world-cup-2026-bracket/page |
| Standings | `getStandingsCached('WC')` | standings page, groups page, group detail, hub |
| Live/Upcoming | `getWCAuthorityMatchesV2()` | hub, group detail, matches pages |
| Team | `getTeamCached()` | team detail page |

No new ViewModel functions needed. The existing 4 cover all cases.
