# WC_PROPAGATION_MAP — DATA-18WC.5

**Date:** 2026-06-23

---

## All consumers of `getStandingsCached('WC')`

| Route | Alias | Revalidate | KV key | Notes |
|-------|-------|-----------|--------|-------|
| `src/app/world-cup-2026-standings/page.tsx` | direct | 3600 | `goalradar:/competitions/WC/standings` | primary standings page |
| `src/app/competition/[code]/page.tsx` | `getStandings` | 300 | same | code=WC |
| `src/app/world-cup-2026/page.tsx` (hub) | direct | 30 | same | line 286 |
| `src/app/world-cup-2026/groups/page.tsx` | direct | default | same | group list page |
| `src/app/world-cup-2026-groups/page.tsx` | direct | default | same | alt groups page |
| `src/app/world-cup-2026/[group]/page.tsx` | direct | 3600 | same | individual group page |
| `src/app/world-cup-2026/teams/[slug]/page.tsx` | `getStandings` | 3600 | same | all 48 team pages |

**Total: 7 routes.** All use the single KV key `goalradar:/competitions/WC/standings`.

---

## Non-standings consumers (Phase 4 reference)

| Component | Source | Standings dependency |
|-----------|--------|---------------------|
| `src/components/WCBracket.tsx` | `matches: Match[]` prop | None — fully independent |
| Hub page bracket section | `getWCKnockoutMatchesCached()` → KV | None — reads knockout matches, not standings |

---

## Merge function: single path

All 7 routes ultimately call:
```
getStandingsCached('WC')
  → readKVOnly('/competitions/WC/standings')
  → merge with getStaticWCGroupTables()
```

Post-DATA-18WC.4 fix: `toGroupKey()` normalises `"Group A"` → `"GROUP_A"` before map lookup.
All callers receive canonical `"GROUP_A"` format → no divergence possible between routes.

---

## Static group assignment note

`src/lib/wc-all-teams.ts` contains `group: 'A'...'L'` fields for all 48 teams.
These were set before the final draw and **do not match** the actual API tournament groups for many teams (e.g. USA static=A but API Group D, Mexico static=C but API Group A).

**Impact assessment:**
- Team pages do NOT use `team.group` for the group badge — they find the team by `apiName` in the live standings and use THAT group key. Group badge is live-data-driven. ✅
- The `team.group` field is only used as a fallback label in the fixtures schedule section (`standingGroupLabel || team.group`, line 579), which renders only when `localTeamFixtures.length > 0`. Since `localTeamFixtures` is always `[]` (never populated), this code path never executes. ✅
- `getStaticWCGroupTables()` uses the wrong pre-draw skeleton for the static fallback, but post-fix the live data overrides all 12 groups. ✅
