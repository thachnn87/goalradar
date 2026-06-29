# SEO-7 Audit
## GoalRadar · Authority Content Cleanup — Pre-Implementation Findings

Date: 2026-06-16

---

## Problem Statement

GoalRadar contained pre-draw editorial content created before the official FIFA World Cup 2026
draw was held. This content referenced fabricated group compositions (e.g. Italy in Group G,
France in Group A) that were directly contradicted by the actual draw and the live authority
API. Serving wrong team-to-group assignments in page content, metadata, and structured data
creates SEO authority risk: search engines will discover the inconsistency between the page
content and authoritative sources.

---

## Phase 1: WC Page Audit — Hardcoded Italy / Fake Fixtures

### Files searched
- `src/lib/wc-fixtures.ts`
- `src/app/world-cup-2026/page.tsx`
- `src/app/world-cup-2026-schedule/page.tsx`
- `src/app/world-cup-2026/matches/page.tsx`
- All `src/app/world-cup-2026-*/page.tsx` files

### Findings

| Location | Issue | Severity |
|----------|-------|----------|
| `src/lib/wc-fixtures.ts` COMPACT array | Italy in Group G (Argentina vs Italy, Italy vs Iraq, Italy vs Egypt) | **P0** |
| `src/lib/wc-fixtures.ts` COMPACT array | All 133 group fixtures are pre-draw — wrong teams in every group | **P0** |
| `src/lib/wc-fixtures.ts` dead exports | `WC_GROUP_FIXTURES`, `WC_ALL_FIXTURES`, `getGroupFixtures`, `getTeamFixtures`, `getUpcomingGroupFixtures`, `getMatchdayFixtures` — no callers, dead code | MEDIUM |
| Schedule/results pages | No hardcoded fixtures found — pages use live authority API | ✅ CLEAN |
| WC hub page | No fake fixtures — uses live API | ✅ CLEAN |

### Fake fixture strings (from COMPACT, all pre-draw fabrications)
- Mexico vs Spain (Group C opening)
- USA vs France (Group A)
- Canada vs England (Group B)
- Argentina vs Italy (Group G)
- Belgium vs Brazil (Group H)
- Colombia vs Poland (Group I) — wrong — actual Group I is France, Iraq, Norway, Senegal

---

## Phase 2: Group Prediction Pages Audit

### GROUP_PREDICTIONS in `src/lib/wc-predictions.ts`

Groups A–H only. Pre-draw compositions compared against actual draw (from production authority API):

| Group | Prediction Teams | Actual Draw Teams | Match? |
|-------|-----------------|-------------------|--------|
| A | France, USA, Japan, Switzerland | Mexico, Korea Republic, Czechia, South Africa | ❌ ALL WRONG |
| B | England, Canada, Denmark, South Korea | Switzerland, Canada, Qatar, Bosnia-H. | ❌ 1/4 correct (Canada) |
| C | Spain, Mexico, Australia, Serbia | Scotland, Morocco, Brazil, Haiti | ❌ ALL WRONG |
| D | Germany, Morocco, Iran, Costa Rica | USA, Australia, Turkey, Paraguay | ❌ ALL WRONG |
| E | Portugal, Senegal, Panama, Saudi Arabia | Germany, Ivory Coast, Ecuador, Curaçao | ❌ ALL WRONG |
| F | Netherlands, Nigeria, Qatar, Honduras | Sweden, Japan, Netherlands, Tunisia | ❌ 1/4 correct (Netherlands) |
| G | Argentina, Italy, Egypt, Iraq | Egypt, Belgium, Iran, New Zealand | ❌ Italy not qualified; 1/4 correct (Egypt) |
| H | Belgium, Brazil, Cameroon, Jordan | Cape Verde, Spain, Saudi Arabia, Uruguay | ❌ ALL WRONG |

### Metadata findings (metaTitle / metaDesc)

All 8 group prediction metaTitles listed pre-draw teams that are wrong vs actual draw:
- Group A: "France, USA, Japan, Switzerland" → France is in Group I; USA in Group D
- Group G: "Argentina, Italy, Egypt" → Italy did not qualify; Argentina is in Group J
- All others similarly wrong

---

## Phase 3: Team Page Audit

### `src/lib/wc-all-teams.ts`

| Team | qualified | group | Correct? |
|------|-----------|-------|---------|
| Italy | false | TBD | ✅ Correctly marked non-qualified |
| South Africa | true | A | ✅ Correct |
| Brazil | true | C | ✅ Correct |
| England | true | L | ✅ Correct |
| France | true | I | ✅ Correct |
| Argentina | true | J | ✅ Correct |
| Belgium | true | G | ✅ Correct |
| Norway | **MISSING** | — | ❌ Norway in Group I but no entry in wc-all-teams.ts |

Italy team page FAQ correctly says "No. Italy did not qualify..." — no fix needed.

---

## Phase 4: Structured Data Audit

All structured data (FAQPage, Breadcrumb, SportsEvent) on group pages and team pages pulls from
the authority API via `getWCStandingsCached` and `getWCAuthorityMatchesCached`. No hardcoded
structured data with wrong team names found.

Exception: group prediction pages produce FAQPage structured data from GROUP_PREDICTIONS. The
FAQs reference wrong team names in their question/answer text (e.g. "Will France qualify from
Group A?"). These are editorial predictions — marked as pre-draw analysis — and are lower
SEO risk than title/description metadata.

---

## Phase 5: Metadata Consistency

### Group prediction page metaTitles (pre-fix)

8 of 8 group prediction pages had metaTitles listing wrong teams:
- `"Group G Predictions – Argentina, Italy, Egypt"` — Italy did not qualify

### Schedule / results / standings pages

All use dynamic data from authority API. Metadata is either generic or populated from live data.
No incorrect team names found in metadata outside of group prediction pages.

---

## Phase 6: Production HTML Search

Checked production HTML for key fabricated strings (pre DATA-9 + SEO-7 deploys):

| String | Page | Found? |
|--------|------|--------|
| "Argentina vs Italy" | Schedule | ❌ Not found (DATA-9 cleared it) |
| "Mexico vs Spain" | Schedule | ❌ Not found |
| "Italy" in group standings | Group G | ❌ Not found |
| "Group Group A" | Teams | ❌ Not found (DATA-8 hotfix) |

---

## Summary of Issues Found

| Issue | File | Severity | Status |
|-------|------|----------|--------|
| Italy in Group G COMPACT fixtures | wc-fixtures.ts | P0 | Fixed SEO-7 |
| All 133 pre-draw group fixtures | wc-fixtures.ts | P0 | Fixed SEO-7 |
| Dead group fixture exports | wc-fixtures.ts | MEDIUM | Fixed SEO-7 |
| Wrong team names in metaTitles (8 groups) | wc-predictions.ts | HIGH | Fixed SEO-7 |
| Wrong team names in metaDescs (8 groups) | wc-predictions.ts | HIGH | Fixed SEO-7 |
| No pre-draw disclaimer on prediction pages | WCGroupPredictionsTemplate.tsx | MEDIUM | Fixed SEO-7 |
| Norway missing from wc-all-teams.ts | wc-all-teams.ts | MEDIUM | Deferred DATA-10 |
| GROUP_PREDICTIONS body content has wrong teams | wc-predictions.ts | LOW | Deferred — needs full rewrite |
| FAQ questions reference wrong team names | wc-predictions.ts FAQs | LOW | Deferred — needs full rewrite |
