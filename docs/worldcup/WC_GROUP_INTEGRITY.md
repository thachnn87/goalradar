# WC_GROUP_INTEGRITY — DATA-18WC.6

**Date:** 2026-06-23

## Summary

Group integrity audit for WC 2026 static team data and group table generation.

## Finding: GROUP_TBD root cause

Italy (`group: 'TBD'`, `qualified: false`) exists in `src/lib/wc-all-teams.ts` at line 284-296.

`getStaticWCGroupTables()` in `src/lib/wc-static-groups.ts` iterates ALL `WC_ALL_TEAMS` including Italy. Before the fix, line 51 had no TBD filter, so `const groupKey = \`GROUP_TBD\`` was created and pushed into the groups object. This static GROUP_TBD entry has no live counterpart from the API (the API only returns 12 groups A–L), so the merge in `getStandingsCached('WC')` always includes it.

**Fix applied:** Added `if (team.group === 'TBD') continue;` on line 52 of `wc-static-groups.ts`.

## Team count

| Source | Count | Notes |
|--------|-------|-------|
| WC_ALL_TEAMS total | 48 | 47 assigned to A-L + Italy (TBD) |
| Groups A-L static teams | 47 | Group G has 3 (pre-draw Argentina mismatch) |
| Italy (TBD) | 1 | `qualified: false`, excluded by fix |
| Live API teams per group | 4 each | Correct for all 12 groups |

## Static group assignment mismatch

`wc-all-teams.ts` was seeded before the tournament draw. Static `.group` fields do not match the actual draw. This is non-critical: team pages use live standings for group badges (dead code path for static `.group`).

## Verdict

**GROUP_INTEGRITY: FIXED** — `GROUP_TBD` removed by TBD filter. 12 clean groups A–L produced from static skeleton. Live data overrides skeleton for all 12 groups.
