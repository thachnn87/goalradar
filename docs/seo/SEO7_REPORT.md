# SEO-7 Report
## GoalRadar · Authority Content Cleanup — Implementation Documentation

Date: 2026-06-16
Commit: aa83ee5
TypeScript: ✅ 0 errors

---

## Overall Verdict: COMPLETE (with deferred items)

All P0 and HIGH severity issues fixed. Pre-draw Italy fixtures removed from source.
Group prediction metadata updated to remove wrong team names. Pre-draw disclaimer
banner added to all 8 group prediction pages. Deferred items documented.

---

## Fix 1 — Remove Pre-Draw Group Fixtures from `wc-fixtures.ts`

**Problem:** The COMPACT array contained 133 pre-draw group fixtures based on a fabricated
draw that never happened. Italy appeared in Group G against Argentina, Egypt, and Iraq.
All team assignments in all groups were wrong vs the actual draw.

**Action:** Deleted the following from `src/lib/wc-fixtures.ts`:
- `const COMPACT: CompactGroupRow[]` — 133 rows of pre-draw fixtures (all groups A–L)
- `export const WC_GROUP_FIXTURES` — derived from COMPACT, had 0 callers
- `export const WC_ALL_FIXTURES` — also derived from COMPACT, had 0 callers
- `export function getGroupFixtures()` — dead (0 callers)
- `export function getTeamFixtures()` — dead (0 callers)
- `export function getUpcomingGroupFixtures()` — dead (0 callers)
- `export function getMatchdayFixtures()` — dead (0 callers)
- Helper code: `TEAM_MAP`, `team()`, `CompactGroupRow` type, `WC_ALL_TEAMS` import

**Retained:** `WCGroupFixture` type, `WCKnockoutSlot` type, `WC_KNOCKOUT_SLOTS`,
`getKnockoutSlots()` — all still used by bracket pages.

**Impact:** File reduced from 371 lines to 113 lines. Zero callers broken (all dead exports).
Italy and all other pre-draw team assignments removed from source.

---

## Fix 2 — Update Group Prediction Metadata in `wc-predictions.ts`

**Problem:** All 8 group prediction pages had metaTitles listing wrong teams vs the actual
draw. Group G listed "Argentina, Italy, Egypt" — Italy did not qualify. Search engines index
these titles and can penalise for content inconsistency.

**Action:** Updated `metaTitle` and `metaDesc` for all 8 groups (A–H):

| Group | Old metaTitle | New metaTitle |
|-------|--------------|--------------|
| A | "...Group A Predictions – France, USA, Japan, Switzerland" | "...Group A Predictions & Preview" |
| B | "...Group B Predictions – England, Canada, Denmark, South Korea" | "...Group B Predictions & Preview" |
| C | "...Group C Predictions – Spain, Mexico, Australia, Serbia" | "...Group C Predictions & Preview" |
| D | "...Group D Predictions – Germany, Morocco, Iran, Costa Rica" | "...Group D Predictions & Preview" |
| E | "...Group E Predictions – Portugal, Senegal, Saudi Arabia, Panama" | "...Group E Predictions & Preview" |
| F | "...Group F Predictions – Netherlands, Nigeria, Qatar, Honduras" | "...Group F Predictions & Preview" |
| G | "...Group G Predictions – Argentina, Italy, Egypt" | "...Group G Predictions & Preview" |
| H | "...Group H Predictions – Brazil, Belgium, Cameroon, Jordan" | "...Group H Predictions & Preview" |

New metaDesc for all 8 groups:
`"Expert Group X predictions for the FIFA World Cup 2026. Pre-draw analysis, dark horse picks, key match insights and group stage tips from GoalRadar."`

**Note:** The body content (predicted1st, predicted2nd, darkHorse, intro, analysis, FAQ text)
still references pre-draw teams. Full rewrite of this content is deferred to a separate sprint
as it requires significant editorial work. The disclaimer banner (Fix 3) contextualises this.

---

## Fix 3 — Pre-Draw Disclaimer Banner in `WCGroupPredictionsTemplate.tsx`

**Problem:** Prediction pages showed fabricated team analysis with no indication that the
content was written before the draw. Users and search engines had no way to distinguish
pre-draw editorial from live authority data.

**Action:** Added a yellow warning banner inserted between `<WCPageNav />` and the hero
section on all 8 group prediction pages:

```
⚠️ Pre-draw analysis. These predictions were written before the official FIFA World Cup 2026
draw. Team assignments shown here may not reflect the actual draw. For live standings and
confirmed group fixtures, visit the Group X page.
```

The banner links to the authoritative group page (`/world-cup-2026/group-x`) so users and
crawlers can easily navigate to correct information.

---

## TypeScript Verification

```
npx tsc --noEmit
Result: 0 errors
```

---

## Files Modified

| File | Change | Lines changed |
|------|--------|---------------|
| `src/lib/wc-fixtures.ts` | Removed COMPACT array + 6 dead exports + helper code | -258 lines |
| `src/lib/wc-predictions.ts` | Updated metaTitle/metaDesc for groups A–H | 16 lines changed |
| `src/components/WCGroupPredictionsTemplate.tsx` | Added pre-draw disclaimer banner | +13 lines |

---

## Remaining Italy References (Legitimate)

The following Italy references remain in source and are all factually correct:

| File | Reference | Status |
|------|-----------|--------|
| `wc-all-teams.ts` | Italy entry with `qualified: false` | ✅ Correct |
| `wc-all-teams.ts` | Non-qualification FAQ answer | ✅ Correct |
| `winner-predictions/page.tsx` | Historical WC winner table (Italy 2006, Brazil vs Italy 1994) | ✅ Historical fact |
| `wc-tv-countries.ts` | Italy as a TV broadcast market | ✅ Correct |
| `wc-venues.ts` | 1970 and 1994 finals (historical mentions) | ✅ Historical fact |

---

## Deferred Issues (DATA-10)

| Issue | Reason for deferral |
|-------|---------------------|
| GROUP_PREDICTIONS body content rewrite (wrong team analysis text) | Requires significant editorial work; disclaimer banner contextualises it |
| GROUP_PREDICTIONS FAQ questions reference wrong teams | Same as above |
| Norway missing from `wc-all-teams.ts` | Norway is in Group I per actual draw; needs team page creation, not just data entry |
| Prediction pages Groups I–L absent from GROUP_PREDICTIONS | No data exists for actual groups I–L; separate content sprint needed |

---

## Success Criteria Check

| Criterion | Status |
|-----------|--------|
| No fabricated WC team assignments in fixture source data | ✅ COMPACT array deleted |
| No pre-draw fake fixture strings in source | ✅ Removed with COMPACT |
| Italy removed from group fixtures | ✅ COMPACT deleted entirely |
| Metadata not listing wrong teams in titles | ✅ All 8 group prediction metaTitles updated |
| Pre-draw content contextualised for users | ✅ Disclaimer banner on all 8 prediction pages |
| TypeScript clean | ✅ 0 errors |
| No regressions in live pages | ✅ Dead code removal only; no active consumers broken |
