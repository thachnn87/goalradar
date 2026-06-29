# DATA-6 Authority Schedule Migration — Report
## GoalRadar · Sprint DATA-6

Implemented: 2026-06-15
Audit: `DATA6_AUDIT.md`
Background: `LEGACY_WC_SCHEDULE_AUDIT.md`

---

## Changes Made

**File:** `src/app/world-cup-2026-schedule/page.tsx`

### Imports removed

```diff
- import { getUpcomingMatchesCached } from '@/lib/api';
- import { getUpcomingGroupFixtures, type WCGroupFixture } from '@/lib/wc-fixtures';
- import { isStaticMode, getStaticGroupFixtures } from '@/data/worldcup/loader';
+ import { getWCAuthorityMatchesCached } from '@/lib/api';
```

### Function removed

`groupLocalByDay(fixtures: WCGroupFixture[])` — helper for the static fallback
rendering path. No longer needed.

### Data loading — old (3 branches)

```tsx
let upcoming: Match[] = [];
let localUpcoming: WCGroupFixture[] = [];

if (isStaticMode()) {
  // Branch A: WORLD_CUP_DATA_SOURCE=static → fixtures.json
  localUpcoming = getStaticGroupFixtures().slice(0, 48);
} else {
  try {
    const data = await getUpcomingMatchesCached('WC');
    upcoming = data.matches.slice(0, 48);
  } catch { /* swallowed */ }

  // Branch C: API returned 0 → wc-fixtures.ts COMPACT array
  if (upcoming.length === 0) {
    localUpcoming = getUpcomingGroupFixtures().slice(0, 48);
  }
}
```

### Data loading — new (single authority source)

```tsx
// DATA-6: authority source only. Filter to SCHEDULED/TIMED — never show
// live, paused, or finished matches inside a schedule view.
let upcoming: Match[] = [];
try {
  const data = await getWCAuthorityMatchesCached();
  upcoming = data.matches
    .filter((m) => m.status === 'SCHEDULED' || m.status === 'TIMED')
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
    .slice(0, 48);
} catch { /* empty state renders below */ }
```

### Empty state — old (Branch C static render)

The previous fallback rendered a 48-fixture list from wc-fixtures.ts when the
API returned nothing — showing fake fixtures including Italy and wrong group draws.

### Empty state — new (no data = no fixtures message)

```tsx
{days.length === 0 && (
  <section className="mb-8">
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-3">
      <p className="text-gray-300 text-sm font-semibold">No upcoming fixtures scheduled</p>
      <p className="text-gray-600 text-xs leading-relaxed">
        Fixtures for the next round will appear here once the current round concludes
        and match slots are confirmed.
      </p>
      <div className="flex justify-center gap-4 pt-2 text-sm">
        <Link href="/world-cup-2026">Live scores →</Link>
        <Link href="/world-cup-2026/bracket">Knockout bracket →</Link>
      </div>
    </div>
  </section>
)}
```

---

## Verification

### TypeScript
`npx tsc --noEmit` → **0 errors**

### Symbol sweep — all removed from schedule page

```
grep: isStaticMode               → 0 matches
grep: getStaticGroupFixtures     → 0 matches
grep: getUpcomingGroupFixtures   → 0 matches
grep: WCGroupFixture             → 0 matches
grep: localUpcoming              → 0 matches
grep: localByDay                 → 0 matches
grep: localDays                  → 0 matches
grep: groupLocalByDay            → 0 matches
grep: getUpcomingMatchesCached   → 0 matches
grep: WORLD_CUP_DATA_SOURCE      → 0 matches
```

### Fake fixture strings — schedule page

```
grep "Mexico vs Spain"     src/app/world-cup-2026-schedule/page.tsx → 0 matches ✅
grep "USA vs France"       src/app/world-cup-2026-schedule/page.tsx → 0 matches ✅
grep "Canada vs England"   src/app/world-cup-2026-schedule/page.tsx → 0 matches ✅
grep "Argentina vs Italy"  src/app/world-cup-2026-schedule/page.tsx → 0 matches ✅
```

---

## Success Criteria

| Criterion | Status |
|-----------|--------|
| Zero fabricated fixtures on `/world-cup-2026-schedule` | ✅ |
| Authority source only (`getWCAuthorityMatchesCached`) | ✅ |
| Only SCHEDULED/TIMED matches displayed in schedule | ✅ |
| Empty state when no upcoming fixtures | ✅ |
| No redirects | ✅ |
| No provider call increase | ✅ — `getWCAuthorityMatchesCached` uses same KV-only cached path |
| No SEO regression | ✅ — canonical unchanged, metadata unchanged, JSON-LD preserved |
| TypeScript clean | ✅ |
| No code changes outside target file | ✅ |

---

## Production Verification Required

1. **Clear `WORLD_CUP_DATA_SOURCE=static`** from Vercel environment variables if present.
   This was the primary trigger for the production bug. The schedule page no longer
   reads this variable, but other pages (`/world-cup-2026-bracket`, `/world-cup-2026-groups`)
   still do. Leaving it set will continue to affect those pages.

2. **Force ISR revalidation** after deploy: the page has `revalidate = 3600` (1 hour).
   Either wait ≤1 hour or trigger a manual revalidation via Vercel dashboard to flush
   the poisoned ISR cache.

3. **Confirm real fixtures render**: after deploy + revalidation, visit
   `/world-cup-2026-schedule` and verify upcoming fixtures show real team names
   (e.g., Mexico vs South Africa, Belgium vs Brazil) not fabricated ones.

---

## Remaining Legacy Consumers (Out of Scope for DATA-6)

See `DATA6_AUDIT.md` for full inventory. Summary:

| Priority | Route | Issue |
|----------|-------|-------|
| 🔴 P1 | `/world-cup-2026-predictions` | Italy hardcoded in Group G prediction text — Italy did not qualify |
| 🔴 P1 | `/world-cup-2026/group-*` (12 pages) | `getGroupFixtures()` fallback uses fake group draw |
| 🔴 P1 | `/world-cup-2026/teams/*` (48 pages) | `getTeamFixtures()` fallback uses fake group draw |
| 🟡 P2 | `src/lib/api.ts` | 6 KV-miss fallbacks use `getStaticGroupMatches()` with fake data |
| 🟡 P2 | `/world-cup-2026-bracket`, `/world-cup-2026-groups` | Still read `isStaticMode()` |
| 🟢 P3 | `/schedule`, `/world-cup-2026-predictions` | `WC_ALL_FIXTURES` last-resort fallback |

These were not in scope for DATA-6 (schedule page fix only) and require a separate
sprint to address. The most urgent are the Group G predictions page (Italy never
qualified) and the group/team pages which show wrong opponents on API fallback.
