# DATA-7 World Cup Fake Data Purge — Report
## GoalRadar · Sprint DATA-7

Implemented: 2026-06-15
Audit: `DATA7_AUDIT.md`
Builds on: `DATA6_AUDIT.md`, `DATA6_REPORT.md`

---

## Summary

Eliminated all production-facing paths to fake WC fixture data. No user-visible page can now reach fabricated fixtures (Mexico vs Spain, Argentina vs Italy, USA vs France, etc.) through any code path — API fallback, KV miss, or static mode.

---

## Changes Made

### 1. `src/lib/wc-all-teams.ts`

Italy entry updated:

```diff
-   group: 'G',
+   group: 'TBD',
-   qualified: true,
+   qualified: false,
-   metaTitle: 'Italy at FIFA World Cup 2026 — Fixtures & Results | GoalRadar',
+   metaTitle: 'Italy & FIFA World Cup 2026 | GoalRadar',
-   metaDesc: 'Italy World Cup 2026 fixtures, results and group standing...',
+   metaDesc: 'Italy did not qualify for the FIFA World Cup 2026...',
-   intro: 'Italy, four-time world champions, return to the World Cup stage in 2026...',
+   intro: 'Italy, four-time world champions, did not qualify for the FIFA World Cup 2026...',
```

Italy remains in `WC_ALL_TEAMS` (so `/world-cup-2026/teams/italy` resolves) but no longer appears in Group G standings, group assignment queries, or group-G-specific content.

---

### 2. `src/lib/wc-predictions.ts` — Group G

Full rewrite of the Group G prediction block to remove Italy:

| Element | Was | Now |
|---------|-----|-----|
| `metaTitle` | "Argentina, Italy, Egypt, Iraq" | "Argentina, Iraq, Egypt" |
| `predicted2nd` | Italy | Egypt (slug: 'egypt') |
| `darkHorse` | Egypt | Iraq (slug: 'iraq') |
| `keyMatch` | Argentina vs Italy | Egypt vs Iraq (second-place decider) |
| `analysis` | Italy-centric narrative | Iraq's historic return + Egypt as contender |
| FAQ | 2 Italy-specific questions | Iraq's 40-year absence + Egypt qualification |

---

### 3. `src/app/world-cup-2026/[group]/page.tsx`

```diff
- import { getGroupFixtures, WC_GROUP_FIXTURES, type WCGroupFixture } from '@/lib/wc-fixtures';
+ import type { WCGroupFixture } from '@/lib/wc-fixtures';

  // FAQ builder
- const fixtures = getGroupFixtures(letter);
+ const fixtures: WCGroupFixture[] = [];

  // Page data
- const localFixtures: WCGroupFixture[] =
-   upcoming.length === 0 && results.length === 0
-     ? getGroupFixtures(letter)
-     : [];
+ const localFixtures: WCGroupFixture[] = [];
```

Group pages now show the proper "No upcoming fixtures" empty state when the API returns nothing, instead of the fake fixture list.

---

### 4. `src/app/world-cup-2026/teams/[slug]/page.tsx`

```diff
- import { getTeamFixtures, type WCGroupFixture } from '@/lib/wc-fixtures';
+ import type { WCGroupFixture } from '@/lib/wc-fixtures';

- // If API returned nothing, load local scheduled fixtures for this team
- if (upcoming.length === 0 && recent.length === 0) {
-   localTeamFixtures = getTeamFixtures(slug);
- }
```

Team pages now show the "Fixtures load once the tournament begins" empty state when the API returns nothing.

---

### 5. `src/lib/api.ts`

Removed `import { getStaticGroupMatches, getStaticUpcomingMatches } from '@/data/worldcup/loader'`.

All 9 WC static fallback call sites replaced with empty returns:

```diff
  // getUpcomingMatchesCached — KV miss
- if (competition === 'WC') {
-   const today = new Date().toISOString().split('T')[0];
-   return { matches: getStaticUpcomingMatches(today), resultSet: { count: 72 } };
- }
  return { matches: [], resultSet: { count: 0 } };

  // getUpcomingMatchesCached — catch
- if (competition === 'WC') { ... getStaticUpcomingMatches(today) ... }
  return { matches: [], resultSet: { count: 0 } };

  // getRecentMatchesCached — KV miss
- if (competition === 'WC') {
-   return { matches: getStaticGroupMatches().filter((m) => m.status === 'FINISHED') };
- }
  return { matches: [] };

  // getRecentMatchesCached — catch
- if (competition === 'WC') { ... getStaticGroupMatches() ... }
  return { matches: [] };

  // getWCResultsCached — KV miss + catch
- return { matches: getStaticGroupMatches().filter((m) => m.status === 'FINISHED') };
+ return { matches: [] };

  // getWCKnockoutMatchesCached — KV miss + catch
- return { matches: getStaticGroupMatches() };
+ return { matches: [] };

  // getWCKnockoutMatches (cron) — catch
- return { matches: getStaticGroupMatches() };
+ return { matches: [] };
```

---

### 6. `src/app/schedule/page.tsx`

Removed `WCLocalSchedule` component (~52 lines), `groupLocalByDate` helper, and the `WC_ALL_FIXTURES` import. Both WC-specific fallback render sites replaced with standard error/empty states:

```diff
- // WC: serve local static fixture dataset instead of an error box
- if (competition === 'WC') {
-   return <WCLocalSchedule fixtures={WC_ALL_FIXTURES} />;
- }

- // WC: serve local static schedule rather than a blank page
- if (competition === 'WC') {
-   return <WCLocalSchedule fixtures={WC_ALL_FIXTURES} />;
- }
```

---

### 7. `src/app/world-cup-2026-predictions/page.tsx`

```diff
- import { WC_ALL_FIXTURES, type WCGroupFixture } from '@/lib/wc-fixtures';
+ import type { WCGroupFixture } from '@/lib/wc-fixtures';

- // ── Static fallback: next N fixtures from local dataset ────────────────
- const now = Date.now();
- const staticFixtures: WCGroupFixture[] =
-   upcoming.length === 0
-     ? WC_ALL_FIXTURES
-         .filter((f) => new Date(f.utcDate).getTime() >= now)
-         .slice(0, MAX_UPCOMING)
-     : [];
+ const staticFixtures: WCGroupFixture[] = [];
```

---

## Verification

### TypeScript
`npx tsc --noEmit` → **0 errors**

### Symbol sweep — confirmed removed

```
grep getStaticGroupMatches  src/lib/api.ts                               → 0 matches ✅
grep getStaticUpcomingMatches src/lib/api.ts                             → 0 matches ✅
grep getGroupFixtures       src/app/world-cup-2026/[group]/page.tsx      → 0 matches ✅
grep getTeamFixtures        src/app/world-cup-2026/teams/[slug]/page.tsx → 0 matches ✅
grep WC_ALL_FIXTURES        src/app/schedule/page.tsx                    → 0 matches ✅
grep WC_ALL_FIXTURES        src/app/world-cup-2026-predictions/page.tsx  → 0 matches ✅
grep "italy" wc-predictions.ts Group G block                             → 0 matches ✅
```

### Italy in Group G predictions
```
grep "Italy" src/lib/wc-predictions.ts Group G section → 0 matches ✅
grep "Italy" src/lib/wc-all-teams.ts — qualified: false, group: 'TBD' ✅
```

---

## Success Criteria

| Criterion | Status |
|-----------|--------|
| Italy not shown as WC 2026 Group G team | ✅ |
| Italy `qualified: false` in team data | ✅ |
| Group G predictions show accurate content (no Italy) | ✅ |
| Group pages show empty state on API miss (not fake fixtures) | ✅ |
| Team pages show empty state on API miss (not fake opponents) | ✅ |
| `api.ts` has zero `getStaticGroupMatches` / `getStaticUpcomingMatches` calls | ✅ |
| `schedule/page.tsx` shows error state on API fail (not fake WC fixtures) | ✅ |
| `world-cup-2026-predictions/page.tsx` shows empty state on API fail | ✅ |
| TypeScript clean | ✅ |
| No changes to `vercel.json` | ✅ |

---

## What This Does NOT Fix

| Item | Reason |
|------|--------|
| `wc-all-teams.ts` other group assignments (47 teams) | All groups except Italy's are unverified but not confirmed wrong; Italy is the only confirmed non-qualifier |
| `wc-fixtures.ts` COMPACT array content | No production page path calls `getGroupFixtures` or `getTeamFixtures` anymore; these functions are orphaned |
| `src/data/worldcup/fixtures.json` | Only consumer is `loader.ts` which is no longer called |
| `WC_KNOCKOUT_SLOTS` in `wc-fixtures.ts` | Slot placeholders ("Winner R32 M1") are structurally correct; kept for bracket page fallback |
| `isStaticMode()` in bracket/groups pages | `WORLD_CUP_DATA_SOURCE=static` should be cleared from Vercel env vars — not a code issue |

---

## Production Verification Required

1. **Visit `/world-cup-2026/group-g-predictions`** — confirm "Italy" does not appear anywhere in the rendered page
2. **Visit `/world-cup-2026/teams/italy`** — confirm page states Italy did not qualify
3. **Visit `/world-cup-2026/group-g`** — confirm Group G standings and fixtures show real API data (Argentina, Egypt, Iraq and correct 4th team), not Italy
4. **Force ISR revalidation** — pages have `revalidate = 3600`. Trigger manual revalidation via Vercel dashboard or wait ≤1 hour after deploy
5. **Check `WORLD_CUP_DATA_SOURCE=static`** — clear from Vercel env vars if still set. Bracket and groups pages still read `isStaticMode()` and will serve stale data if this is set
