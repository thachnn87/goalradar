# WC_STANDINGS_FIX_PLAN — DATA-18WC.4

**Date:** 2026-06-23
**Status:** FIX DEPLOYED in commit `82b072a`

---

## Root cause

`getStandingsCached('WC')` in `src/lib/api.ts` built its live-group lookup map using
the raw group key from football-data.org (`"Group A"`), but the static skeleton
(`getStaticWCGroupTables()`) uses `"GROUP_A"` format. The `Map.get("GROUP_A")` call
never found `"Group A"` → all 12 groups fell through to the static seed (P=0, PTS=0).

KV contained correct live data the whole time; the bug was purely in the merge path.

---

## Fix applied (minimal, safe)

**File:** `src/lib/api.ts` — `getStandingsCached` (line ~424)

```diff
+         const toGroupKey = (g: string | null | undefined) =>
+           (g ?? '').startsWith('GROUP_') ? (g ?? '') :
+           'GROUP_' + (g ?? '').replace(/^Group\s*/i, '').trim().toUpperCase();
          const liveByGroup = new Map(
-           data.standings.filter(s => s.type === 'TOTAL').map(s => [s.group, s]),
+           data.standings.filter(s => s.type === 'TOTAL').map(s => [toGroupKey(s.group), s]),
          );
          const staticTables = getStaticWCGroupTables();
-         const merged: StandingTable[] = staticTables.map(
-           staticEntry => liveByGroup.get(staticEntry.group) ?? staticEntry,
-         );
+         const merged: StandingTable[] = staticTables.map(staticEntry => {
+           const live = liveByGroup.get(staticEntry.group ?? '');
+           return live ? { ...live, group: staticEntry.group } : staticEntry;
+         });
```

### Why this approach

1. **Normalise on write into the map** — `toGroupKey` converts `"Group A"` → `"GROUP_A"` before
   the map key is stored.
2. **Re-key live entry on read** — `{ ...live, group: staticEntry.group }` ensures all callers
   receive the canonical `"GROUP_A"` key, even though the raw API data says `"Group A"`.
   This preserves backwards-compatibility with all six pages' group-letter extraction code.
3. **No change to static fallback path** — KV miss still returns `getStaticWCGroupTables()` unchanged.
4. **No provider, no cron, no KV schema change** — read path only, deployed via ISR revalidation.

---

## Cache invalidation

No explicit cache invalidation needed.

- The L1 in-memory cache (`withCache`) has a 1 h TTL for standings.
- Vercel ISR will revalidate on next request after deploy.
- The fix takes effect when the page's ISR revalidate window expires (1 h for standings pages).
- If immediate display is needed: Vercel dashboard → Deployments → Redeploy, which purges ISR.

The KV entry is already correct (live data). Only the merge layer was broken.

---

## Backfill strategy

None required. football-data.org standings are current tournament standings computed from
all played matches — no historical backfill is needed. The KV entry was last written at
`2026-06-23T06:10:25.816Z` (fresh, TTL 4635 s at audit time). Standings will continue to
be refreshed every 30–60 min by the orchestrator.

---

## No-op paths (verified safe)

- `/world-cup-2026/[group]` already had a `normalizeGroupLetter` function handling both formats.
- Hub slug derivation already used `replace(/[\s_]+/g, '-')` covering both formats.
- `WCGroupTable` already used `replace(/_/g, ' ')` covering `GROUP_A` → `Group A`.
- No code change to these pages needed.

---

## Recommendations (non-blocking)

1. Add `isStaticFallback()` check to `/api/debug/standings-audit` response — single boolean
   for monitoring: if all `playedGames === 0` after tournament start, alert immediately.
2. Update the DR key: `refreshEndpoint` writes main KV but not the DR key
   (`goalradar:dr:/competitions/WC/standings`). The DR key is only written by `withKVCache`.
   Consider writing it in `refreshEndpoint` too so DR is available after a cron refresh.
3. Periodic smoke test: after each orchestrator run, assert `playedGames > 0` for at least
   one group — catches future merge regressions before users see P=0.
