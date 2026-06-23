# WC_GROUPS_VALIDATION — DATA-18WC.4

**Date:** 2026-06-23

---

## Source consistency across routes

All three target routes use the identical path:

```
page → getStandingsCached('WC') → readKVOnly('/competitions/WC/standings')
```

| Route | Calls | KV key | Post-fix status |
|-------|-------|--------|----------------|
| `/world-cup-2026-standings` | `getStandingsCached('WC')` | `goalradar:/competitions/WC/standings` | ✅ live data |
| `/competition/WC` | `getStandingsCached('WC')` (aliased as `getStandings`) | same | ✅ live data |
| `/world-cup-2026#groups` | `getStandingsCached('WC')` | same | ✅ live data |

No divergence possible — single KV key, single merge function.

---

## Group key format consistency (post-fix)

After the fix, `getStandingsCached` always returns `"GROUP_A"` format regardless of
what football-data.org sends. Page-level extraction code for each route:

| Route | Extraction | Handles `"GROUP_A"` |
|-------|-----------|---------------------|
| `/world-cup-2026-standings` | `.replace(/^GROUP_/, '')` | ✅ → `"A"` |
| `/world-cup-2026-groups` | `.replace('GROUP_', '').replace(/^Group\s+/i, '').trim()` | ✅ → `"A"` |
| `/world-cup-2026/groups` | `slug = g.toLowerCase().replace(/[\s_]+/g, '-')` | ✅ → `"group-a"` |
| `/world-cup-2026/[group]` | `normalizeGroupLetter` handles both forms | ✅ |
| `/world-cup-2026` hub | `g.toLowerCase().replace(/[\s_]+/g, '-')` | ✅ → `"group-a"` |
| `WCGroupTable` component | `raw.replace(/_/g, ' ').replace(/^GROUP /, 'Group ')` | ✅ → `"Group A"` |

All pages produce correct labels with the normalized key.

---

## Group assignment: real standings vs static seed

Pre-fix: all 12 groups showed static seed teams (P=0, PTS=0) from `wc-static-groups.ts`.
Post-fix: API data overrides all 12 groups where football-data.org returned standings.

Static seed teams (from `WC_ALL_TEAMS`) are still the tournament draw assignment.
After fix, the API's `table[]` entries replace static entries — real crests, real IDs.

Group letter ordering: `getStaticWCGroupTables()` sorts A→L alphabetically, and
the merged array preserves that order (staticTables drives the map iteration).

---

## Qualification status labels

| Page | Logic | Correct post-fix |
|------|-------|-----------------|
| `WCGroupTable` (hub, groups) | `i < 2` → green border | ✅ position from sorted live table |
| `/world-cup-2026-standings` | `i < 2` → bg-green | ✅ |
| `/world-cup-2026/[group]` | `rank <= 2` → "Advancing" | ✅ |
| `/world-cup-2026-groups` | `j < 2` → bg-green | ✅ |

Positions are from football-data.org's sorted `table[]` — no re-sorting needed.
