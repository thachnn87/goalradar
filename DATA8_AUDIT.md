# DATA-8 World Cup Metadata Authority Migration — Audit
## GoalRadar · Sprint DATA-8

Audit date: 2026-06-15
Builds on: DATA7_AUDIT.md, DATA7_REPORT.md

---

## Scope

Eliminate `wc-all-teams.ts` as a source of World Cup group truth.
Replace all `team.group` / `WC_ALL_TEAMS.filter(t.group)` / `getStaticWCGroupTables()` / `STATIC_GROUPS` / `STATIC_TEAMS` usages in production logic with authority-derived data.
Keep `wc-all-teams.ts` only for: slug, country name, flag, ranking, descriptive content.

---

## Consumers Identified

### A. `WC_ALL_TEAMS.filter(t => t.group === ...)` — group membership queries

| File | Location | Usage | Risk |
|------|----------|-------|------|
| `src/app/world-cup-2026/[group]/page.tsx` | `generateMetadata` line 64 | SEO description with team names | WRONG — all 47 other team groups unverified |
| `src/app/world-cup-2026/[group]/page.tsx` | `buildGroupFaqs` line 344 | FAQ team list, favourite team calc | WRONG |
| `src/app/world-cup-2026/[group]/page.tsx` | `QualificationScenarios` line 470 | Pre-tournament overview with flag/links | WRONG |
| `src/components/WCGroupPredictionsTemplate.tsx` | line 342-344 | Predicted standings preview | WRONG |
| `src/app/world-cup-2026/teams/page.tsx` | line 105-108 | By-group tab in teams listing | WRONG |

### B. `team.group` field direct usage

| File | Location | Usage |
|------|----------|-------|
| `src/app/world-cup-2026/teams/[slug]/page.tsx` | line 333 | `String.fromCharCode(65 + i)` — group letter from standings table INDEX, not `table.group` |
| `src/app/world-cup-2026/teams/[slug]/page.tsx` | line 352 | `groupSlug` from `team.group` |
| `src/app/world-cup-2026/teams/[slug]/page.tsx` | line 383-384 | FAQ "What group is X in?" uses `team.group` |
| `src/app/world-cup-2026/teams/[slug]/page.tsx` | line 434-436 | Group badge chip uses `team.group` |
| `src/app/world-cup-2026/teams/[slug]/page.tsx` | line 574 | Schedule section heading uses `team.group` |
| `src/app/world-cup-2026/teams/[slug]/page.tsx` | line 661 | Related links use `team.group` |

### C. `getStaticWCGroupTables()` fallbacks

| File | Location | Usage |
|------|----------|-------|
| `src/lib/api.ts` | lines 425, 431 | `getStandingsCached` KV miss + catch |
| `src/app/world-cup-2026/[group]/page.tsx` | lines 656-661 | Group page standings fallback |
| `src/app/world-cup-2026-standings/page.tsx` | lines 131, 137 | Standings page catch + empty check |
| `src/app/world-cup-2026/groups/page.tsx` | line 85 | Groups page catch |

### D. `STATIC_GROUPS` / `STATIC_TEAMS` + `isStaticMode()`

| File | Location | Usage |
|------|----------|-------|
| `src/app/world-cup-2026-groups/page.tsx` | lines 75-80, 176-200 | Static mode guard + fallback render with team names |

---

## Authority Source

`getStandingsCached('WC')` returns `StandingTable[]` where each table has:
- `table.group = 'GROUP_A'...'GROUP_L'` (authoritative)
- `table.table: StandingEntry[]` with real API team names

Group letter derived as: `table.group.replace('GROUP_', '')` — NOT `String.fromCharCode(65 + i)`.

---

## Allowed uses of `wc-all-teams.ts` (NOT changed)

- `getWCTeam(slug)` — slug → WCTeamEntry for flag, displayName, intro, ranking, confederation
- `getWCTeamByApiName(name)` — API name → WCTeamEntry for flag/slug lookup
- `WC_ALL_TEAMS.find(t => t.apiName === ...)` — name-based lookups for flag/slug
- `WC_ALL_TEAMS.filter(t => t.confederation === ...)` — confederation grouping (valid)
- `t.flag`, `t.slug`, `t.displayName`, `t.intro`, `t.metaTitle`, `t.metaDesc` — descriptive content
- `t.fifaRanking` — editorial ranking (not group membership)

---

## Status after DATA-8

All items above: **FIXED** — see DATA8_REPORT.md.
