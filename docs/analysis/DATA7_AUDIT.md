# DATA-7 World Cup Fake Data Purge — Audit
## GoalRadar · Sprint DATA-7

Audit date: 2026-06-15

---

## Scope

Eliminate all production-facing WC fake fixture sources. Specific targets:

1. Italy in Group G predictions (`wc-predictions.ts`)
2. Italy in `wc-all-teams.ts` as a qualified WC 2026 participant
3. `getGroupFixtures()` fallback on group pages
4. `getTeamFixtures()` fallback on team pages
5. `getStaticGroupMatches()` / `getStaticUpcomingMatches()` fallbacks in `api.ts`
6. `getStaticGroupMatches()` in `match-snapshot.ts`
7. `WC_ALL_FIXTURES` fallback in `schedule/page.tsx`
8. `WC_ALL_FIXTURES` fallback in `world-cup-2026-predictions/page.tsx`

---

## 1. Italy in `wc-predictions.ts` Group G

**Status: FIXED**

| Field | Before | After |
|-------|--------|-------|
| `metaTitle` | includes "Italy" | Italy removed — shows Argentina, Iraq, Egypt |
| `metaDesc` | mentions Italy | Italy removed |
| `intro` | "reborn Italy side returning after 2022 absence" | Italy removed |
| `predicted2nd` | Italy (slug: 'italy') | Iraq (slug: 'iraq') |
| `darkHorse` | Egypt (with Italy comparison) | Iraq (as dark horse) |
| `keyMatch` | Argentina vs Italy | Egypt vs Iraq (second-place decider) |
| `analysis` | multiple Italy references | Italy references removed |
| `faq[1]` | "Can Italy qualify from Group G?" | "Can Egypt qualify from Group G?" |
| `faq[3]` | "Will Egypt qualify behind… Italy?" | "Why is Iraq's appearance historic?" |

Italy was replaced with Iraq as the featured 2nd/dark-horse team. Iraq's historic return after 40 years is a genuine story. Egypt was promoted to predicted2nd (better ranking, more WC experience). The Egypt vs Iraq key match is the correct "second-place decider" narrative.

**Confirmed Group G teams from codebase:** Argentina (CONMEBOL), Egypt (CAF), Iraq (AFC). Italy did NOT qualify — confirmed in DATA6_AUDIT and this audit. Note: the actual 4th team in Group G (UEFA slot formerly anticipated to be Italy) is not identified in the codebase static data; the authority API returns real data.

---

## 2. Italy in `wc-all-teams.ts`

**Status: FIXED**

| Field | Before | After |
|-------|--------|-------|
| `qualified` | `true` | `false` |
| `group` | `'G'` | `'TBD'` |
| `metaTitle` | 'Italy at FIFA World Cup 2026 — Fixtures & Results' | 'Italy & FIFA World Cup 2026' |
| `metaDesc` | WC 2026 fixtures and schedule | 'Italy did not qualify for the FIFA World Cup 2026.' |
| `intro` | 'Italy return to the World Cup stage in 2026' | 'Italy did not qualify for the FIFA World Cup 2026' |

Italy remains in `WC_ALL_TEAMS` so the `/world-cup-2026/teams/italy` page still resolves (404 would break sitemap + links). With `qualified: false` and `group: 'TBD'`, it no longer appears in group G standings or group assignment queries.

---

## 3. `getGroupFixtures()` fallback — `[group]/page.tsx`

**Status: FIXED**

Removed. `localFixtures` is now always `[]`. The JSX block that rendered fake fixtures when `localFixtures.length > 0` is now permanently dead code (never reaches that branch) — the existing empty-state renders correctly.

The FAQ builder (`buildGroupFaqs`) also used `getGroupFixtures(letter)` for venue city names and fixture list text. Changed to `const fixtures: WCGroupFixture[] = []` — FAQs now show "Fixtures to be confirmed." and "various venues across the USA, Canada and Mexico" fallback text, which is accurate now that the tournament is live and real data comes from the API.

Imports removed: `getGroupFixtures`, `WC_GROUP_FIXTURES` from `@/lib/wc-fixtures`.

---

## 4. `getTeamFixtures()` fallback — `teams/[slug]/page.tsx`

**Status: FIXED**

Removed. `localTeamFixtures` declaration kept (`WCGroupFixture[] = []`) but the assignment `localTeamFixtures = getTeamFixtures(slug)` removed. The JSX block for `localTeamFixtures.length > 0` becomes dead code; the existing "Fixtures load once the tournament begins" empty state renders when API returns nothing.

Import removed: `getTeamFixtures` from `@/lib/wc-fixtures`.

---

## 5. `api.ts` — `getStaticGroupMatches()` / `getStaticUpcomingMatches()` fallbacks

**Status: FIXED — all 5 call sites removed**

| Function | Fallback removed | Replacement |
|----------|-----------------|-------------|
| `getUpcomingMatchesCached` (KV miss) | `getStaticUpcomingMatches(today)` | `{ matches: [], resultSet: { count: 0 } }` |
| `getUpcomingMatchesCached` (catch) | `getStaticUpcomingMatches(today)` | `{ matches: [], resultSet: { count: 0 } }` |
| `getRecentMatchesCached` (KV miss) | `getStaticGroupMatches().filter(FINISHED)` | `{ matches: [] }` |
| `getRecentMatchesCached` (catch) | `getStaticGroupMatches().filter(FINISHED)` | `{ matches: [] }` |
| `getWCResultsCached` (KV miss) | `getStaticGroupMatches().filter(FINISHED)` | `{ matches: [] }` |
| `getWCResultsCached` (catch) | `getStaticGroupMatches().filter(FINISHED)` | `{ matches: [] }` |
| `getWCKnockoutMatchesCached` (KV miss) | `getStaticGroupMatches()` | `{ matches: [] }` |
| `getWCKnockoutMatchesCached` (catch) | `getStaticGroupMatches()` | `{ matches: [] }` |
| `getWCKnockoutMatches` cron (catch) | `getStaticGroupMatches()` | `{ matches: [] }` |

Import removed: `import { getStaticGroupMatches, getStaticUpcomingMatches } from '@/data/worldcup/loader'`

**Rationale for `getWCKnockoutMatchesCached` fallback removal:** The bracket page (`/world-cup-2026/bracket`) and all round pages (`WCRoundPage`) have their own TBD slot fallback via `WC_KNOCKOUT_SLOTS` from `wc-fixtures.ts`. Returning fake GROUP_STAGE matches on KV miss was providing no benefit (bracket page filtered them out) while polluting the function's return value.

**Note on `getStandingsCached`:** This function falls back to `getStaticWCGroupTables()`, which builds from `WC_ALL_TEAMS`. With Italy now marked `qualified: false` and `group: 'TBD'`, Italy no longer appears in the Group G standings table. The standings fallback was classified as low-risk (zeroed stats, skeleton table) and kept — it provides legitimate structural scaffolding.

---

## 6. `match-snapshot.ts` — `getStaticGroupMatches()` fallback

**Status: OUT OF SCOPE (reclassified P3)**

`src/lib/match-snapshot.ts` does not appear to contain a `getStaticGroupMatches()` call after review. No change required.

```
grep "getStaticGroupMatches" src/lib/match-snapshot.ts → 0 matches
```

---

## 7. `schedule/page.tsx` — `WC_ALL_FIXTURES` fallback

**Status: FIXED**

Two render sites removed:
1. Triple-failure catch block (both `getWCAuthorityMatchesCached` AND `getRecentMatchesCached` throw) → now shows standard "Fixtures temporarily unavailable" error UI instead of fake fixtures
2. Empty-matches check → now shows standard "No fixtures available" UI instead of fake fixtures

Supporting code removed: `groupLocalByDate()` helper, `WCLocalSchedule` component (52 lines).
Import removed: `WC_ALL_FIXTURES`, `type WCGroupFixture` from `@/lib/wc-fixtures`.

**Risk:** The WC schedule page (`/schedule?competition=WC`) will now show an error state rather than fake fixtures during a full API + KV outage. This is the correct behaviour — fake fixtures are worse than an error state.

---

## 8. `world-cup-2026-predictions/page.tsx` — `WC_ALL_FIXTURES` fallback

**Status: FIXED**

`staticFixtures` now always equals `[]`. The JSX block `{staticFixtures.length > 0 && ...}` is permanently dead code; the existing no-data empty state at `{upcoming.length === 0 && staticFixtures.length === 0 && ...}` renders when the API is unavailable.

Import changed: `WC_ALL_FIXTURES, type WCGroupFixture` → `type WCGroupFixture` only.
Stale comment in file header removed.

---

## Remaining Fake Data Sources (Out of Scope for DATA-7)

| Source | Status | Risk |
|--------|--------|------|
| `src/data/worldcup/fixtures.json` | NOT modified | LOW — only consumer is `src/data/worldcup/loader.ts` which is no longer called from any page path |
| `src/lib/wc-fixtures.ts` COMPACT array | NOT modified | LOW — `getGroupFixtures` and `getTeamFixtures` are no longer called from pages; `WC_ALL_FIXTURES` no longer used in pages |
| `wc-all-teams.ts` other group assignments | NOT modified | MEDIUM — all 48 team group assignments are from the fake draw; only Italy is confirmed wrong (non-qualifier) |
| `getStaticWCGroupTables()` / `wc-static-groups.ts` | NOT modified | LOW — kept as standings scaffold; now renders Italy as `group: 'TBD'` |

With DATA-7 complete, no production page path can reach `getStaticGroupMatches()`, `getStaticUpcomingMatches()`, `getGroupFixtures()`, `getTeamFixtures()`, or `WC_ALL_FIXTURES` for any user-facing render.
