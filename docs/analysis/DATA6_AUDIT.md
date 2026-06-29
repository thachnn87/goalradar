# DATA-6 Authority Schedule Migration — Audit
## GoalRadar · Sprint DATA-6

Audit date: 2026-06-15
Scope: Repository-wide inventory of fake fixture data sources and remaining consumers

---

## Fixed: /world-cup-2026-schedule (DATA-6 scope)

All three fake-data branches removed from `src/app/world-cup-2026-schedule/page.tsx`:

| Branch | What it was | Status |
|--------|------------|--------|
| A — `isStaticMode()` | `WORLD_CUP_DATA_SOURCE=static` → `getStaticGroupFixtures()` from fixtures.json | ✅ Removed |
| B — `getUpcomingMatchesCached('WC')` | Real API via KV | ✅ Replaced with authority source |
| C — `getUpcomingGroupFixtures()` | Static fallback from wc-fixtures.ts COMPACT array | ✅ Removed |

New single source: `getWCAuthorityMatchesCached()` filtered to `SCHEDULED|TIMED` only.

---

## Fake Fixture String Verification

Checked for hardcoded match strings from fabricated draw:

| String | Still present? | Location | Rendered to users? |
|--------|---------------|----------|--------------------|
| `Mexico vs Spain` | ✅ comment only | `src/lib/wc-fixtures.ts:104` (code comment) | ❌ No — code comment, not rendered |
| `USA vs France` / `United States vs France` | ✅ data only | `src/lib/wc-fixtures.ts:83` (COMPACT array entry) | Only if consumers use COMPACT data (see below) |
| `Canada vs England` | ✅ data only | `src/lib/wc-fixtures.ts:94` (COMPACT array entry) | Only if consumers use COMPACT data |
| `Argentina vs Italy` | ✅ prediction text | `src/lib/wc-predictions.ts:414` | ⚠️ YES — Group G predictions page |

**The `/world-cup-2026-schedule` page no longer surfaces any of these strings.**

---

## Remaining Legacy Consumers

### Tier A: Routes that call `isStaticMode()` directly

| File | Route | Usage | Fake data risk |
|------|-------|-------|---------------|
| `src/app/world-cup-2026-bracket/page.tsx` | `/world-cup-2026-bracket` | `isStaticMode()` guard + `WC_KNOCKOUT_SLOTS` fallback | LOW — knockout slots use TBD slot labels ("Winner R32 M1"), not team names |
| `src/app/world-cup-2026-groups/page.tsx` | `/world-cup-2026-groups` | `isStaticMode()` skips standings API call, uses `STATIC_GROUPS`/`STATIC_TEAMS` | MEDIUM — static group assignments are wrong |

### Tier B: Routes using WC group fixture data as fallback

| File | Route | What it uses | When triggered | Fake data risk |
|------|-------|-------------|----------------|---------------|
| `src/app/world-cup-2026/[group]/page.tsx` | `/world-cup-2026/group-*` | `getGroupFixtures(letter)` from wc-fixtures.ts | API returns no fixtures for that group | HIGH — wrong group assignments shown |
| `src/app/world-cup-2026/teams/[slug]/page.tsx` | `/world-cup-2026/teams/*` (48 pages) | `getTeamFixtures(slug)` from wc-fixtures.ts | API returns no team fixtures | HIGH — wrong group/opponent data |
| `src/app/world-cup-2026-predictions/page.tsx` | `/world-cup-2026-predictions` | `WC_ALL_FIXTURES` from wc-fixtures.ts | API returns no fixtures | HIGH — Italy in Group G shown |
| `src/app/schedule/page.tsx` | `/schedule` | `WC_ALL_FIXTURES` `WCLocalSchedule` component | Both API and KV miss | MEDIUM — last-resort fallback only |

### Tier C: Content-level fake data (always rendered)

| File | Route | Issue |
|------|-------|-------|
| `src/lib/wc-predictions.ts` | `/world-cup-2026-predictions` (Group G section) | Hardcoded Italy as WC 2026 participant — full prediction text, FAQs, analysis. Italy did not qualify for WC 2026. This content renders unconditionally when Group G predictions are viewed. |

### Tier D: Library-level fallbacks (not directly route-rendered)

| File | Usage | Fake data risk |
|------|-------|---------------|
| `src/lib/api.ts` | `getStaticGroupMatches()` in 6 KV-miss fallbacks (`getUpcomingMatchesCached`, `getRecentMatchesCached`, `getWCResultsCached`, `getWCKnockoutMatchesCached`) | MEDIUM — fires only on KV miss, which now surfaces wrong fixtures to all WC pages that use these functions |
| `src/lib/match-snapshot.ts` | `getStaticGroupMatches()` fallback in snapshot builder | MEDIUM — individual match pages could get wrong metadata |

### Tier E: Type-only and non-fixture usage (safe)

| File | Usage | Risk |
|------|-------|------|
| `src/lib/wc-rounds.ts` | `WC_KNOCKOUT_SLOTS` for date derivation only | NONE — reads dates/venue slugs, not team names |
| `src/components/WCRoundPage.tsx` | `type WCKnockoutSlot` import only | NONE — type annotation only |
| `src/app/world-cup-2026/bracket/page.tsx` | `WC_KNOCKOUT_SLOTS` for slot placeholders | NONE — slots use "Winner R32 M1" labels, not team names |

---

## Data Source Correctness Assessment

### `src/lib/wc-fixtures.ts` — COMPACT group data

Contains invented group draw assembled before FIFA announced the real draw.
Known incorrect entries confirmed vs. actual API data:

| Static data | Actual API data (confirmed) |
|-------------|---------------------------|
| Mexico vs Spain (Group C opener) | Mexico vs South Africa (opener, match 537327) |
| Argentina vs Italy (Group G) | Italy did NOT qualify for WC 2026 |
| USA vs France (Group A) | Incorrect — actual Group A is different |
| Canada vs England (Group B) | Incorrect group assignment |
| Sweden vs Tunisia (not in static data at all) | Confirmed real match 537358 |

**Status:** Never updated after real FIFA draw. All 72 GROUP_STAGE entries in COMPACT
are fabricated. The 32 KNOCKOUT entries use slot placeholders ("Winner R32 M1") which
are structurally correct even if dates/venues may have shifted.

### `src/data/worldcup/fixtures.json`

Mirrors `wc-fixtures.ts` COMPACT data exactly. Same fake group assignments.
Only consumer is `src/data/worldcup/loader.ts`.

---

## Priority Ranking for Future Sprints

| Priority | Fix | Affected routes | User impact |
|----------|-----|----------------|-------------|
| 🔴 P1 | Remove Italy from `wc-predictions.ts` Group G | `/world-cup-2026-predictions` | Content misinformation — Italy not in WC 2026 |
| 🔴 P1 | Update COMPACT in `wc-fixtures.ts` with real draw | All Tier B routes | Wrong group assignments shown on fallback |
| 🟡 P2 | Remove `getStaticGroupMatches` KV-miss fallbacks from `api.ts` | All WC pages | Wrong fixtures shown during KV outages |
| 🟡 P2 | Remove `isStaticMode` from bracket and groups pages | `/world-cup-2026-bracket`, `/world-cup-2026-groups` | Static-mode env var no longer safe to set |
| 🟢 P3 | Remove `WC_ALL_FIXTURES` from `/schedule` and `/world-cup-2026-predictions` | `/schedule`, `/world-cup-2026-predictions` | Last-resort fallback cleanup |
