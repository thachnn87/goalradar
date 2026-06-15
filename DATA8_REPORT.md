# DATA-8 World Cup Metadata Authority Migration — Report
## GoalRadar · Sprint DATA-8

Implemented: 2026-06-15
Audit: `DATA8_AUDIT.md`
Builds on: `DATA7_REPORT.md`

---

## Summary

Eliminated `wc-all-teams.ts` as a source of World Cup group truth across all production paths.
Group membership is now derived exclusively from `getStandingsCached('WC')` (authority standings API).
`wc-all-teams.ts` is retained for flag, slug, displayName, intro, ranking — descriptive content only.

---

## Changes Made

### 1. `src/lib/api.ts`

Removed `getStaticWCGroupTables` import. Removed static fallbacks from `getStandingsCached`:

```diff
- import { getStaticWCGroupTables } from '@/lib/wc-static-groups';

  // KV miss — WC:
- return { standings: getStaticWCGroupTables(), competition: wcMeta };
+ return { standings: [], competition: wcMeta };

  // catch — WC:
- return { standings: getStaticWCGroupTables(), competition: wcMeta };
+ return { standings: [], competition: wcMeta };
```

Pages now receive an empty standings array on KV miss, showing their proper empty state rather than fake pre-draw groups.

---

### 2. `src/app/world-cup-2026/[group]/page.tsx`

**a) `generateMetadata`** — replaced static group filter with authority standings call:

```diff
- const groupTeams = WC_ALL_TEAMS.filter((t) => t.group === letter);
- const teamNames  = groupTeams.map((t) => t.displayName).join(', ');
+ const standingsMeta = await getStandingsCached('WC');
+ const groupTableMeta = (standingsMeta.standings ?? []).find(
+   (s) => s.type === 'TOTAL' && s.group === slugToApiGroup(slug)
+ );
+ const teamNames = groupTableMeta?.table.map(...).join(', ') ?? '';
```

SEO descriptions now contain real group teams (e.g., "Group G: Argentina, Egypt, Iraq, …") instead of fake pre-draw assignments.

**b) `buildGroupFaqs`** — accepts `tableEntries: StandingEntry[]` parameter; team data derived from entries + WC_ALL_TEAMS flag/ranking lookup:

```diff
- function buildGroupFaqs(letter: string, label: string): GroupFaq[]
+ function buildGroupFaqs(letter: string, label: string, tableEntries: StandingEntry[]): GroupFaq[]
  // groupTeams now derived from tableEntries, not WC_ALL_TEAMS.filter
```

**c) `QualificationScenarios`** — same pattern: group teams derived from `tableEntries` + WC_ALL_TEAMS lookup for flag/slug/ranking:

```diff
- const groupTeams = WC_ALL_TEAMS.filter((t) => t.group === letter);
+ const groupTeams = tableEntries.map((e) => {
+   const wct = WC_ALL_TEAMS.find(t => t.apiName === e.team?.name || ...);
+   return { displayName, flag, fifaRanking, slug };
+ });
```

**d) Static standings fallback removed**:

```diff
- if (tableEntries.length === 0) {
-   const staticTables = getStaticWCGroupTables();
-   const staticGroup  = staticTables.find((t) => t.group === apiGroup);
-   tableEntries       = staticGroup?.table ?? [];
-   isStaticStandings  = tableEntries.length > 0;
- }
+ const tableEntries: StandingEntry[] = liveGroupTable?.table ?? [];
+ const isStaticStandings = false;
```

Removed `getStaticWCGroupTables` import.

---

### 3. `src/app/world-cup-2026/teams/[slug]/page.tsx`

Fixed group derivation bug and all `team.group` display usages:

```diff
- standingGroupLabel = String.fromCharCode(65 + i);        // index-based — wrong if API returns out-of-order
+ standingGroupLabel = (tables[i].group ?? '').replace('GROUP_', '');  // authoritative

- const groupSlug = team.group !== 'TBD' ? `group-${team.group.toLowerCase()}` : null;
+ const groupSlug = standingGroupLabel ? `group-${standingGroupLabel.toLowerCase()}` : null;

  // FAQ "What group is X in?"
- a: team.group !== 'TBD' ? `...Group ${team.group}...` : '...';
+ a: standingGroupLabel   ? `...Group ${standingGroupLabel}...` : '...';

  // Group badge chip
- {team.group !== 'TBD' && <span>Group {team.group}</span>}
+ {standingGroupLabel && <span>Group {standingGroupLabel}</span>}

  // Related links
- label: `Group ${team.group} Standings`
+ label: `Group ${standingGroupLabel} Standings`
```

---

### 4. `src/app/world-cup-2026-groups/page.tsx`

Removed `isStaticMode()` guard, `STATIC_GROUPS`, `STATIC_TEAMS` imports, and the fallback render that showed wrong team names:

```diff
- import { isStaticMode, STATIC_GROUPS, STATIC_TEAMS } from '@/data/worldcup/loader';

- if (!isStaticMode()) {
-   try {
-     const data = await getStandingsCached('WC');
-     standingTables = (data.standings ?? []).filter((s) => s.type === 'TOTAL');
-   } catch { /* static only */ }
- }
+ try {
+   const data = await getStandingsCached('WC');
+   standingTables = (data.standings ?? []).filter((s) => s.type === 'TOTAL');
+ } catch { /* standings unavailable */ }
```

Fallback render now shows group link cards without team names (instead of wrong static team names):

```diff
- <div>
-   {teamSlugs.map((slug) => { const t = teamMap.get(slug); return <div>{t.flag} {t.name}</div> })}
- </div>
  // replaced with: group link card without team names (clean, not wrong)
```

---

### 5. `src/app/world-cup-2026-standings/page.tsx`

Removed `getStaticWCGroupTables()` from catch and empty-check:

```diff
- import { getStaticWCGroupTables } from '@/lib/wc-static-groups';
- let isStaticData = false;

  } catch {
-   standingTables = getStaticWCGroupTables();
-   isStaticData   = standingTables.length > 0;
+   /* standings unavailable */
  }
- if (standingTables.length === 0) {
-   standingTables = getStaticWCGroupTables();
-   isStaticData   = standingTables.length > 0;
- }

  // Banner and heading
- {isStaticData && <div>⏳ Pre-tournament group lineup...</div>}
- {isStaticData ? 'Group Preview' : 'Live Group Standings'}
+ 'Live Group Standings'   // always (static fallback gone)
```

---

### 6. `src/app/world-cup-2026/groups/page.tsx`

Removed `getStaticWCGroupTables()` from catch:

```diff
- import { getStaticWCGroupTables } from '@/lib/wc-static-groups';

  } catch {
    apiError = true;
-   groupTables = getStaticWCGroupTables();
  }
```

---

### 7. `src/components/WCGroupPredictionsTemplate.tsx`

Removed `WC_ALL_TEAMS.filter(t => t.group === group)`. Derived from prediction data slugs:

```diff
- import { WC_ALL_TEAMS, type WCTeamEntry } from '@/lib/wc-all-teams';
+ import { getWCTeam, type WCTeamEntry } from '@/lib/wc-all-teams';

- const teams = WC_ALL_TEAMS.filter((t) => t.group === group).sort(...);
+ const teams: WCTeamEntry[] = [
+   data.predicted1st.slug,
+   data.predicted2nd.slug,
+   data.darkHorse.slug,
+ ].map((s) => getWCTeam(s)).filter(Boolean).sort(...);
```

Prediction pages now show exactly the teams named in the editorial predictions, not whatever fake pre-draw assignment existed.

---

### 8. `src/app/world-cup-2026/teams/page.tsx`

Made page async. Derived `byGroup` from authority standings API:

```diff
- export default function WCTeamsPage() {
+ export default async function WCTeamsPage() {

- const byGroup = GROUPS.map((g) => ({
-   group: g,
-   teams: WC_ALL_TEAMS.filter((t) => t.group === g),
- })).filter((g) => g.teams.length > 0);
+ let byGroup = [];
+ try {
+   const standingsData = await getStandingsCached('WC');
+   // ... map tables to groups, look up WC_ALL_TEAMS by apiName for flag/slug
+ } catch { /* show confederation view only */ }
```

By-group tab now shows real group assignments. Falls back to empty array (hides the tab) on API miss.

---

## Verification

### TypeScript
`npx tsc --noEmit` → **0 errors**

### Build
`npm run build` → **clean** — all pages compiled, no errors

### Symbol sweep — confirmed removed

```
grep "getStaticWCGroupTables"  src/lib/api.ts                                    → 0 matches ✅
grep "getStaticWCGroupTables"  src/app/world-cup-2026/\[group\]/page.tsx         → 0 matches ✅
grep "getStaticWCGroupTables"  src/app/world-cup-2026-standings/page.tsx         → 0 matches ✅
grep "getStaticWCGroupTables"  src/app/world-cup-2026/groups/page.tsx            → 0 matches ✅
grep "STATIC_GROUPS"           src/app/world-cup-2026-groups/page.tsx            → 0 matches ✅
grep "isStaticMode"            src/app/world-cup-2026-groups/page.tsx            → 0 matches ✅
grep "WC_ALL_TEAMS.*group ==="  src/components/WCGroupPredictionsTemplate.tsx    → 0 matches ✅
grep "WC_ALL_TEAMS.*group ==="  src/app/world-cup-2026/\[group\]/page.tsx        → 0 matches ✅
grep "WC_ALL_TEAMS.*group ==="  src/app/world-cup-2026/teams/page.tsx            → 0 matches ✅
grep "team\.group"             src/app/world-cup-2026/teams/\[slug\]/page.tsx    → 1 match  ✅ (dead-code schedule heading fallback only)
grep "String.fromCharCode"     src/app/world-cup-2026/teams/\[slug\]/page.tsx    → 0 matches ✅
```

---

## Success Criteria

| Criterion | Status |
|-----------|--------|
| Group assignment derived from standings API, not wc-all-teams.ts | ✅ |
| SEO metadata team names from authority API | ✅ |
| FAQ team names from authority standings tableEntries | ✅ |
| Team page group badge from `table.group` field | ✅ |
| Team page group letter from `table.group.replace('GROUP_', '')`, not index | ✅ |
| `getStaticWCGroupTables()` removed from all production paths | ✅ |
| `STATIC_GROUPS`/`STATIC_TEAMS` removed from production pages | ✅ |
| `isStaticMode()` removed from groups page | ✅ |
| `WC_ALL_TEAMS.filter(t => t.group)` removed from all pages | ✅ |
| `wc-all-teams.ts` still used for flag/slug/name/ranking/intro | ✅ |
| TypeScript clean | ✅ |
| Build clean | ✅ |
| No changes to `vercel.json` | ✅ |

---

## Remaining `wc-all-teams.ts` usages (allowed — not group membership)

| Usage | Reason allowed |
|-------|---------------|
| `getWCTeam(slug)` | Slug → descriptive content lookup |
| `WC_ALL_TEAMS.filter(t => t.confederation === ...)` | Confederation is not group membership |
| `WC_ALL_TEAMS.find(t => t.apiName === ...)` | Name → flag/slug lookup for display |
| `t.flag`, `t.intro`, `t.metaTitle`, `t.metaDesc` | Editorial/descriptive content |
| `t.fifaRanking` | Ranking for display sorting |

---

## Production Verification Required

1. **Visit `/world-cup-2026/group-g`** — SEO description should show actual Group G teams (Argentina, Egypt, Iraq + 4th), not Italy
2. **Visit `/world-cup-2026/teams/south-africa`** — Group badge should show real group (C per API), not J (old fake value)
3. **Visit `/world-cup-2026-groups`** — Group cards should show live standings when API is available, clean link cards when not
4. **Visit `/world-cup-2026-standings`** — No "Pre-tournament lineup" banner; shows "Live Group Standings"
5. **Visit `/world-cup-2026/teams`** → By Group tab — should show real group assignments from API
6. **Force ISR revalidation** — all affected pages have `revalidate = 3600`. Trigger manual revalidation via Vercel dashboard after deploy.
7. **Clear `WORLD_CUP_DATA_SOURCE=static`** from Vercel env vars if still set
