# WC_REPAIR_PLAN — DATA-18WC.6

**Date:** 2026-06-23

## Fixes implemented

| # | Fix | File | Description |
|---|-----|------|-------------|
| 1 | GROUP_TBD | `src/lib/wc-static-groups.ts` | Added `if (team.group === 'TBD') continue;` to filter Italy from static skeleton |
| 2 | /competition/WC redirect | `src/app/competition/[code]/page.tsx` | Added `redirect('/world-cup-2026')` when code === 'WC' |
| 3 | /standings?competition=WC redirect | `src/app/standings/page.tsx` | Added `redirect('/world-cup-2026-standings')` when competition === 'WC' |
| 4 | Authority cache upcoming gap | `src/lib/authority-cache.ts` | `coldRebuild` now uses `readKVOnly` directly instead of `getUpcomingMatchesCached`/`getWCResultsCached`, bypassing `withCache` in-process cache |
| 5 | WCBracket LAST_32 | `src/components/WCBracket.tsx` | Added LAST_32 round (16 matches), updated NUM_L32_SLOTS=16, TOTAL_H=1408, all SLOTS_PER_MATCH values doubled |

## Fix dependencies

- Fix 1 is a prerequisite for correctly counting 47 real groups A-L (not 48 with TBD)
- Fix 4 is independent and takes effect on the next orchestrator cron run (~every 30 min)
- Fixes 2 and 3 take effect immediately on next ISR rebuild (no TTL change needed)
- Fix 5 takes effect when knockout matches arrive from the API (~1 July 2026)

## Non-fixes (pre-existing, non-critical)

1. `wc-all-teams.ts` static group assignments out of sync with actual draw — dead code path (team pages use live standings). Recommend updating before Round of 32.
2. DR key absent for standings KV — non-blocking, recommend adding DR write to `refreshEndpoint`.
3. 3 TIMED matches (Portugal vs Uzbekistan, England vs Ghana, Panama vs Croatia) appear in both FINISHED and UPCOMING feeds — feed-integrity YELLOW, not a rendering bug.
