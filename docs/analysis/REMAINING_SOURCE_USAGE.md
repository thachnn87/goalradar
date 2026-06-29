# REMAINING SOURCE USAGE
**Sprint:** DATA-18WC.CONSOLIDATE — Phases 1 & 2  
**Date:** 2026-06-25  
**Method:** Full-repo grep of every source function + per-consumer categorization

---

## Categories

| Category | Meaning |
|---|---|
| **Canonical** | Reads the single source `goalradar:wc:authority:v1` (directly via V2, as a Match-shaped view, or through the knockout ViewModel) |
| **Canonical (standings)** | Reads the standings owner `goalradar:wc:standings:v1` — a separate dataset with its own owner, not WC match collections |
| **Generic** | Multi-competition pipeline used by non-WC pages; correct for those pages (takes a `competition` param) |
| **Infra** | Writer/enrichment side (snapshot builder) — not a display surface consuming match collections |
| **Deleted** | Removed this sprint |
| **Orphaned** | Exported but no remaining caller (dead code) |

Every consumer below belongs to exactly one category.

---

## 1. `getWCAuthorityMatchesV2()` — raw authority:v1 → `CanonicalMatch[]`

| Consumer | Category |
|---|---|
| `lib/knockout-vm.ts` (buildKnockoutViewModel) | Canonical |
| `app/world-cup-2026/page.tsx` (hub) | Canonical |
| `app/world-cup-2026/fixtures/page.tsx` | Canonical |
| `app/world-cup-2026/matches-today/page.tsx` | Canonical |
| `app/world-cup-2026/matches-tomorrow/page.tsx` | Canonical |
| `app/world-cup-2026/results/page.tsx` | Canonical |
| `app/world-cup-2026/[group]/page.tsx` | Canonical |
| `app/world-cup-2026/teams/[slug]/page.tsx` | Canonical *(migrated this sprint)* |
| `app/world-cup-2026-schedule/page.tsx` | Canonical *(migrated in VERIFY)* |
| `api/debug/authority-compare`, `data18d-perf-benchmark`, `live-consistency` | Canonical (debug) |

## 2. `getWCAuthorityMatchesCached()` — Match-shaped **view** of authority:v1

> Redefined this sprint: was a 3-bucket merge (window-limited). Now reads
> authority:v1 via `readAuthorityCache()` + the one `canonicalToMatch` adapter.
> Not a second pipeline — same source, Match return shape.

| Consumer | Category |
|---|---|
| `app/page.tsx` (homepage WC branch) | Canonical |
| `app/schedule/page.tsx` (WC branch) | Canonical |
| `app/world-cup-2026/watch-live/page.tsx` | Canonical *(migrated this sprint)* |
| `app/world-cup-2026-predictions/page.tsx` | Canonical *(migrated this sprint)* |
| `components/WCTeamPageContent.tsx` | Canonical *(migrated this sprint)* |
| `getWCAuthorityMatches()` public alias (api.ts) | Canonical |

## 3. `buildKnockoutViewModel()` — knockout ViewModel over authority:v1

> Pilot gate removed this sprint — reads authority:v1 unconditionally.

| Consumer | Category |
|---|---|
| `app/page.tsx` (homepage bracket preview) | Canonical *(migrated this sprint)* |
| `app/world-cup-2026/page.tsx` (hub) | Canonical |
| `app/world-cup-2026/bracket/page.tsx` | Canonical |
| `app/world-cup-2026-bracket/page.tsx` (SEO) | Canonical |
| `components/WCRoundPage.tsx` (6 round pages) | Canonical |

## 4. `getStandingsCached('WC')` — standings owner `goalradar:wc:standings:v1`

| Consumer | Category |
|---|---|
| hub, [group], groups, world-cup-2026-groups, world-cup-2026-standings, teams, teams/[slug], WCTeamPageContent | Canonical (standings) |
| homepage (WC branch) | Canonical (standings) |
| `standings/page.tsx`, `team/[id]/page.tsx`, `standings-audit` debug | Generic / debug (non-WC or audit) |

## 5. `getUpcomingMatchesCached(competition)` / `getRecentMatchesCached(competition)` — generic multi-competition feeds

| Consumer | Category |
|---|---|
| `app/schedule/page.tsx` (non-WC branch, `competition` param) | Generic |
| `lib/match-snapshot.ts` (per-match snapshot enrichment) | Infra |
| `competition/[code]`, `[alias]`, `teams/[slug]` (non-WC), `sitemap.ts` | Generic |

> **No WC surface** calls these for WC match collections anymore *(predictions, WCTeamPageContent, teams/[slug], watch-live migrated this sprint)*.

## 6. `getWCResultsCached()` — FINISHED feed

| Status | Detail |
|---|---|
| **Orphaned** | Was only used inside the old `getWCAuthorityMatchesCached` merge (removed). No remaining caller. Safe to delete in a follow-up; left in place this sprint to avoid touching unrelated exports. |

## 7. `getWCKnockoutMatchesCached()` — legacy knockout pipeline

| Status | Detail |
|---|---|
| **Deleted** | Removed this sprint. Was the second knockout pipeline (KV `/competitions/WC/matches`, 6 h TTL). Replaced by `buildKnockoutViewModel()` → authority:v1. Enforced by `scripts/check-wc-architecture.mjs` R1. |

---

## Result

Every World Cup **match-collection** consumer now traces to `goalradar:wc:authority:v1`
through exactly one of: `getWCAuthorityMatchesV2` (raw), `getWCAuthorityMatchesCached`
(Match view), or `buildKnockoutViewModel` (knockout). Standings trace to their own
single owner. The only non-authority feed readers left are the **generic
multi-competition** pipeline (correct for non-WC pages) and the **snapshot-writer infra**.
