# DUPLICATE LOGIC REPORT
**Phase:** DATA-18WC.RESET Phase 2  
**Date:** 2026-06-25  
**Legend:** KEEP = authoritative copy | MERGE = fold into KEEP | DELETE = remove entirely

---

## D1 — Knockout Data Fetch (CRITICAL)

**Description:** Two places fetch knockout match data independently.

| Instance | Location | Line | Verdict |
|---|---|---|---|
| `buildKnockoutViewModel()` | `src/lib/knockout-vm.ts` | 105 | **KEEP** |
| `getWCKnockoutMatchesCached()` direct call | `src/app/world-cup-2026/page.tsx` | ~8 | **DELETE** → replace with `buildKnockoutViewModel()` |

**Action:** Migrate hub page bracket preview to call `buildKnockoutViewModel()`. Remove direct import of `getWCKnockoutMatchesCached` from hub page. Verified: bracket/page.tsx and all WCRoundPage consumers already use `buildKnockoutViewModel()`.

---

## D2 — `injectKnockoutSlotLabels()` Callers (RESOLVED in Sprint 15)

**Description:** Previously called in two places. Now called only inside `buildKnockoutViewModel()`.

| Instance | Location | Verdict |
|---|---|---|
| Inside `buildKnockoutViewModel()` | `src/lib/knockout-vm.ts:130` | **KEEP** |
| ~~bracket/page.tsx inline assembly~~ | ~~removed Sprint 15~~ | DONE |
| ~~WCRoundPage.tsx inline call~~ | ~~removed Sprint 15~~ | DONE |

**Status:** RESOLVED. No action needed.

---

## D3 — `canonicalToMatch()` Converter (RESOLVED in Sprint 15)

**Description:** Previously defined inline in bracket/page.tsx. Now lives only in knockout-vm.ts.

| Instance | Location | Verdict |
|---|---|---|
| `canonicalToMatch()` | `src/lib/knockout-vm.ts:66` | **KEEP** |
| ~~bracket/page.tsx inline definition~~ | ~~removed Sprint 15~~ | DONE |

**Status:** RESOLVED. No action needed.

---

## D4 — Third-Place Route Duplication

**Description:** Two separate routes exist for the third-place match.

| Instance | Location | Verdict |
|---|---|---|
| `/world-cup-2026/third-place` | `src/app/world-cup-2026/third-place/page.tsx` | **KEEP** (canonical) |
| `/world-cup-2026/third-place-playoff` | `src/app/world-cup-2026/third-place-playoff/page.tsx` | **DELETE** → add redirect to canonical |

**Action:** Delete `third-place-playoff/page.tsx`, add Next.js redirect from `/world-cup-2026/third-place-playoff` → `/world-cup-2026/third-place` in `next.config.js`.

---

## D5 — Bracket SEO Route vs Nested Route

**Description:** Two bracket routes exist with potentially different content.

| Instance | Location | Verdict |
|---|---|---|
| `/world-cup-2026/bracket` | `src/app/world-cup-2026/bracket/page.tsx` | **KEEP** (primary, interactive) |
| `/world-cup-2026-bracket` | `src/app/world-cup-2026-bracket/page.tsx` | Investigate — may be SEO-specific content |

**Action:** Read `world-cup-2026-bracket/page.tsx` to determine if it's a true duplicate or SEO content landing page. If duplicate data fetch: migrate to shared component. If SEO-only content: keep but ensure it uses same data.

---

## D6 — Results Route Duplication

**Description:** Two routes show WC results.

| Instance | Location | Verdict |
|---|---|---|
| `/world-cup-2026-results` | `src/app/world-cup-2026-results/page.tsx` | **KEEP** (SEO slug) |
| `/world-cup-2026/results` | `src/app/world-cup-2026/results/page.tsx` | **INVESTIGATE** — may serve WCPageNav navigation |

**Action:** Determine if `/world-cup-2026/results` is linked from WCPageNav. If so, keep for nav purpose. If content is identical to SEO page, make it a redirect.

---

## D7 — Schedule/Fixtures Semantic Overlap

**Description:** Two routes serve "upcoming fixtures" concept.

| Instance | Location | Cache Call | Verdict |
|---|---|---|---|
| `/world-cup-2026-schedule` | `src/app/world-cup-2026-schedule/page.tsx` | `getUpcomingMatchesCached('WC')` | **KEEP** (SEO) |
| `/world-cup-2026/fixtures` | `src/app/world-cup-2026/fixtures/page.tsx` | `getUpcomingMatchesCached('WC')` | **KEEP** (WCPageNav navigation target) |

**Action:** Both are needed (SEO vs in-app nav). No action required if content is distinct enough. Verify both use identical data source.

---

## D8 — PILOT_ENABLED Gate (RESOLVED in Sprint 15)

**Description:** Previously the AUTHORITY_CACHE_PILOT gate existed in two places.

| Instance | Location | Verdict |
|---|---|---|
| Inside `buildKnockoutViewModel()` | `src/lib/knockout-vm.ts:108` | **KEEP** |
| ~~bracket/page.tsx PILOT_ENABLED check~~ | ~~removed Sprint 15~~ | DONE |

**Status:** RESOLVED. Single gate in knockout-vm.ts.

---

## D9 — Standings Group Table Component

**Description:** Group table rendered differently on two pages.

| Instance | Location | Verdict |
|---|---|---|
| `WCGroupTable` component | `src/components/WCGroupTable.tsx` | **KEEP** |
| `GroupTable` local function | `src/app/world-cup-2026-standings/page.tsx:73` | **INVESTIGATE** — why not use WCGroupTable? |

**Action:** Determine if `WCGroupTable` and local `GroupTable` render the same data. If equivalent, migrate standings page to use `WCGroupTable` to eliminate the duplicate.

---

## D10 — Match Grid Implementations

**Description:** Multiple places render a grid/list of MatchCard components.

| Instance | Location | Verdict |
|---|---|---|
| `MatchGrid` function | `src/app/world-cup-2026/page.tsx` | Context-specific (date grouping for hub) |
| Grid in WCRoundPage | `src/components/WCRoundPage.tsx:236` | Simpler grid — no date grouping needed |
| Grid in bracket/page.tsx R32 section | `src/app/world-cup-2026/bracket/page.tsx:416` | Distinct layout (4-col) |

**Action:** These serve different layouts and don't need merging. No action.

---

## Summary

| # | Description | Priority | Action |
|---|---|---|---|
| D1 | Hub knockout direct fetch | CRITICAL | Migrate hub to buildKnockoutViewModel() |
| D4 | Third-place duplicate route | HIGH | Delete + redirect |
| D5 | Bracket SEO vs nested route | MEDIUM | Investigate then decide |
| D6 | Results dual routes | MEDIUM | Investigate then decide |
| D9 | GroupTable duplicate component | LOW | Investigate then migrate |
| D2, D3, D8 | Sprint 15 resolutions | DONE | No action |
| D7, D10 | Justified parallel implementations | NONE | No action |
