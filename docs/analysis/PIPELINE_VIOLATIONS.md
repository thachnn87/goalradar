# PIPELINE VIOLATIONS
**Sprint:** DATA-18WC.CONSOLIDATE — Phases 3–6  
**Date:** 2026-06-25

---

## Definition

A **violation** = a World Cup surface (`/world-cup-2026*` route or `WC*` component)
that obtains WC match collections from anything other than the single source
`goalradar:wc:authority:v1` (directly, as a Match view, or via the knockout ViewModel).

Standings (own owner) and generic multi-competition router pages (`/`, `/schedule`,
`/competition/[code]`) are **not** WC-only surfaces and are scoped accordingly — but
per the Full-Collapse decision, even the **WC branches** of `/` and `/schedule` were
collapsed onto authority:v1.

---

## Violations found and resolved

| # | Surface | Was | Now | Phase |
|---|---|---|---|---|
| V1 | `lib/knockout-vm.ts` | Dual path: `AUTHORITY_CACHE_PILOT` gate → V2 **or** legacy `getWCKnockoutMatchesCached` | Reads authority:v1 unconditionally; gate + legacy branch removed | 4 |
| V2 | `app/page.tsx` (homepage) | `getWCKnockoutMatchesCached()` direct | `buildKnockoutViewModel()` | 4 |
| V3 | `app/page.tsx` (homepage) | `getWCAuthorityMatchesCached()` = 3-bucket merge | Same call, now an authority:v1 view (function body collapsed) | 4 |
| V4 | `app/schedule/page.tsx` (WC branch) | `getWCAuthorityMatchesCached()` = merge | authority:v1 view (function body collapsed) | 4 |
| V5 | `app/world-cup-2026-predictions/page.tsx` | `getUpcomingMatchesCached('WC')` + `getRecentMatchesCached('WC')` | `getWCAuthorityMatchesCached()` + `classifyMatchState` split | 4 |
| V6 | `components/WCTeamPageContent.tsx` | `getUpcomingMatchesCached('WC')` + `getRecentMatchesCached('WC')` | `getWCAuthorityMatchesCached()` + `classifyMatchState` split | 4 |
| V7 | `app/world-cup-2026/teams/[slug]/page.tsx` | `getUpcomingMatchesCached('WC')` + `getRecentMatchesCached('WC')` (with authority fallback) | `getWCAuthorityMatchesV2()` as primary; duplicate fallback block deleted | 4 |
| V8 | `app/world-cup-2026/watch-live/page.tsx` | `getUpcomingMatchesCached('WC')` | `getWCAuthorityMatchesCached()` + `classifyMatchState` | 4 |

---

## Phase 4 — Source removal

- **Deleted** `getWCKnockoutMatchesCached()` (legacy knockout pipeline).
- **Collapsed** `getWCAuthorityMatchesCached()` body onto authority:v1 (`readAuthorityCache` + `canonicalToMatch`). Eliminates the window-limited 3-bucket merge that VERIFY identified as the schedule-page root cause.
- **Removed** the `AUTHORITY_CACHE_PILOT` gate from `buildKnockoutViewModel()`.
- **Orphaned** `getWCResultsCached()` (no caller left) — flagged for follow-up deletion.

## Phase 5 — ViewModel normalization

| Feature | ViewModel / single accessor |
|---|---|
| Knockout (R32→Final, bracket tree, round pages) | `buildKnockoutViewModel()` → `KnockoutViewModel` |
| All WC matches (Match shape) | `getWCAuthorityMatchesCached()` (view of authority:v1) |
| All WC matches (Canonical shape) | `getWCAuthorityMatchesV2()` |
| Upcoming / finished splitting | `classifyMatchState(m, todayUTC)` — the one classifier, reused everywhere (predictions, team content, watch-live, teams/[slug], schedule) |
| Standings | `getStandingsCached('WC')` → `goalradar:wc:standings:v1` |

No page assembles WC match arrays by merging feeds inline anymore. The two
remaining inline transforms (filter-by-team in WCTeamPageContent / teams/[slug])
operate **on** the single source — they select, they don't assemble.

## Phase 6 — Component normalization

| Dataset | Component |
|---|---|
| Match row/card | `MatchCard` |
| Group table | `WCGroupTable` |
| Bracket tree | `WCBracket` |
| Round page | `WCRoundPage` |
| Homepage bracket preview | `BracketPreview` (local to `/`, distinct purpose — compact preview, not the full interactive bracket) |

The one canonical type adapter `canonicalToMatch` was **moved** from `knockout-vm.ts`
to `canonical-match.ts` (its natural home) so both `api.ts` and `knockout-vm.ts` reuse
it without a circular import. It is now defined in exactly one place (enforced by
`check-wc-architecture.mjs` R4).

No duplicate renderers were found that fork UI logic for the same dataset.

---

## Out-of-scope (correctly NOT a violation)

| Surface | Why allowed |
|---|---|
| `app/schedule/page.tsx` non-WC branch | Generic multi-competition page; `getUpcomingMatchesCached(competition)` is the correct shared pipeline for non-WC competitions |
| `lib/match-snapshot.ts` | Snapshot **writer**/enrichment infra — reads feeds to build per-match snapshots; not a display surface |
| `getStandingsCached('WC')` consumers | Standings are a separate dataset with their own single owner |
