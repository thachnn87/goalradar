# COMPONENT COLLAPSE PLAN
**Phase:** DATA-18WC.RESET Phase 6  
**Date:** 2026-06-25

---

## Components Inventory

### Canonical (KEEP)

| Component | File | Purpose |
|---|---|---|
| `MatchCard` | `src/components/MatchCard.tsx` | Single match — score, teams, status |
| `WCGroupTable` | `src/components/WCGroupTable.tsx` | Standing table for one group |
| `WCBracket` | `src/components/WCBracket.tsx` | Visual bracket tree (R16 → Final) |
| `WCRoundPage` | `src/components/WCRoundPage.tsx` | Shared component for 6 round pages |
| `WCPageNav` | `src/components/WCPageNav.tsx` | Cross-page WC navigation |
| `CompetitionSelector` | `src/components/CompetitionSelector.tsx` | Competition switcher tabs |
| `WCCountdown` | `src/components/WCCountdown.tsx` | Countdown banner |

---

## Duplicates / Candidates for Merge

### CC1 — `GroupTable` function vs `WCGroupTable` component

| Instance | Location | Status |
|---|---|---|
| `GroupTable` local function | `src/app/world-cup-2026-standings/page.tsx:73` | Standalone — renders differently |
| `WCGroupTable` | `src/components/WCGroupTable.tsx` | Shared component |

**Analysis:** `GroupTable` in the standings page renders all 12 groups with qualification status. `WCGroupTable` is a separate shared component also used on group detail pages. They likely render similar data.

**Decision:** Defer — investigate if `WCGroupTable` can accept the same props as `GroupTable`. If yes, migrate standings page to use `WCGroupTable` and delete `GroupTable`. Out of critical RESET scope.

---

### CC2 — `LocalKnockoutRound` vs `ScheduleSlots`

| Instance | Location | Purpose |
|---|---|---|
| `LocalKnockoutRound` | `src/app/world-cup-2026/bracket/page.tsx:159` | Static slot display for bracket page |
| `ScheduleSlots` | `src/components/WCRoundPage.tsx:124` | Static slot display for round pages |

**Analysis:** Both render the same `WCKnockoutSlot[]` data when API is unavailable. Slightly different styling.

**Decision:** Defer — low priority cosmetic duplication. Both are correctly gated by `!vm.hasApiData`.

---

### CC3 — `ThirdPlaceCard` and `FinalCard` (bracket/page.tsx)

These are bespoke UI components specific to the bracket page. No duplication — each serves a unique visual purpose.

**Decision:** Keep inline. No action needed.

---

## Summary

No component merges are required for RESET sprint correctness. Deferred component cleanup (CC1, CC2) can happen post-RESET.

The critical fix is ensuring all components receive their data from the ViewModel, not from independent fetches. That is addressed in PIPELINE_COLLAPSE_PLAN.
