# DATA-18B.1 Phase 1 — WC Page Inventory & Pilot Selection

**Date:** 2026-06-18  
**Task:** DATA-18B.1 Authority Cache Pilot Migration  
**Phase:** 1 of 6 — Inventory all World Cup listing pages, select pilot

---

## 1. Full WC Listing Page Inventory

### Pages already on authority cache (V2 — `getWCAuthorityMatchesV2`)

| Page | File | Revalidate | Data function | Status |
|---|---|---|---|---|
| WC Hub | `page.tsx` | 30s | `getWCAuthorityMatchesV2` | ✅ On authority cache |
| Results | `results/page.tsx` | 300s | `getWCAuthorityMatchesV2` | ✅ On authority cache |
| Fixtures | `fixtures/page.tsx` | 900s | `getWCAuthorityMatchesV2` | ✅ On authority cache |
| Today's Matches | `matches-today/page.tsx` | 60s | `getWCAuthorityMatchesV2` | ✅ On authority cache |
| Tomorrow's Matches | `matches-tomorrow/page.tsx` | 60s | `getWCAuthorityMatchesV2` | ✅ On authority cache |
| Group detail | `[group]/page.tsx` | dynamic | `getWCAuthorityMatchesV2` | ✅ On authority cache |

All six pages use the same authority cache path with no feature flag. Migration was done unconditionally as part of DATA-18E.

### Pages NOT on authority cache (candidate pool for pilot)

| Page | File | Revalidate | Data function | Match type | Notes |
|---|---|---|---|---|---|
| **Knockout Bracket** | `bracket/page.tsx` | **21600s (6h)** | `getWCKnockoutMatchesCached` | `Match[]` | Direct fetch, try/catch + local fallback |
| Round of 32 | `round-of-32/page.tsx` | 900s | via `WCRoundPage` component | `Match[]` | Shared component — migrating = 6 pages |
| Round of 16 | `round-of-16/page.tsx` | 900s | via `WCRoundPage` component | `Match[]` | Shared component |
| Quarter-finals | `quarter-finals/page.tsx` | 900s | via `WCRoundPage` component | `Match[]` | Shared component |
| Semi-finals | `semi-finals/page.tsx` | 900s | via `WCRoundPage` component | `Match[]` | Shared component |
| Third place | `third-place/page.tsx` | 900s | via `WCRoundPage` component | `Match[]` | Shared component |
| Final | `final/page.tsx` | 900s | via `WCRoundPage` component | `Match[]` | Shared component |
| Watch Live | `watch-live/page.tsx` | 60s | `getWCLiveMatchesCached` + `getUpcomingMatchesCached` | `Match[]` | Live data — authority cache not appropriate |
| Team detail | `teams/[slug]/page.tsx` | 3600s | `getUpcomingMatchesCached` + `getRecentMatchesCached` | `Match[]` | Dynamic route, team-filtered |
| All Matches (SEO) | `matches/page.tsx` | 300s | *(none — static SEO page)* | N/A | No match data fetched |
| Standings | `groups/page.tsx` | 3600s | `getStandingsCached` only | N/A | No match data |

---

## 2. Pilot Elimination Matrix

| Candidate | Reason eliminated |
|---|---|
| Round pages (6 pages) | **Shared `WCRoundPage` component** — any change to `WCRoundPage.tsx` migrates all 6 simultaneously. Violates "Do NOT migrate multiple pages." |
| `watch-live/page.tsx` | **Live data** — this page serves IN_PLAY/PAUSED matches with 60s TTL. Authority cache has 60–120min orchestrator cadence. Architecturally wrong source for real-time live data. |
| `teams/[slug]/page.tsx` | **Dynamic route + team-specific filtering** — authority cache holds 104 matches, but this page shows only matches for a specific team. Filtering by team ID adds complexity; dynamic route means higher blast radius than a fixed page. |
| `matches/page.tsx` | **No match data** — static SEO listing page. No data source to migrate. |
| `groups/page.tsx` | **No match data** — standings only. |

---

## 3. Selected Pilot: `bracket/page.tsx`

**File:** `src/app/world-cup-2026/bracket/page.tsx`  
**Current source:** `getWCKnockoutMatchesCached()`  
**Proposed source:** `readAuthorityCache(builtAt)` filtered to `KNOCKOUT_STAGES`  

### Justification

| Criterion | Assessment |
|---|---|
| **Blast radius** | `revalidate = 21600` (6 hours) — lowest traffic of all candidates. Bracket changes only when knockout results land. Zero user-visible impact if migration is delayed by one orchestrator cycle. |
| **Isolation** | Direct data fetch in `page.tsx` — not a shared component. Migrating this page does not affect any other page. |
| **Authority cache coverage** | Authority cache stores all 104 WC matches including all knockout stages (`LAST_32`, `LAST_16`, `QUARTER_FINALS`, `SEMI_FINALS`, `THIRD_PLACE`, `FINAL`). No new data source needed — just filter by stage. |
| **Graceful degradation** | Page already has a `try/catch` block with `WC_KNOCKOUT_SLOTS` local fallback. If authority cache fails, page falls back to pre-tournament schedule display — same behavior as today. |
| **Rollback** | Feature flag `AUTHORITY_CACHE_PILOT=true` gates the new path. Rollback = set flag to `false` in Vercel dashboard (no redeploy). |
| **Data currency** | Bracket needs knockout results only — these are low-frequency updates (a few per day during knockout rounds). 6-hour revalidate is already aligned to this cadence. Authority cache DR (7-day TTL) is adequate. |

### Authority cache data coverage for bracket

The authority cache at `goalradar:wc:authority:v1` contains all 104 WC 2026 matches. The bracket page only needs knockout stage matches:

```
KNOCKOUT_STAGES = { 'LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL' }
```

In WC 2026: 32 + 16 + 8 + 4 + 1 + 1 = 62 knockout matches are stored in the authority cache. All are available.

---

## 4. Adaptation Scope

`CanonicalMatch` (authority cache type) vs `Match` (current bracket type) — compatibility check:

| Field used in bracket | `Match` | `CanonicalMatch` | Action |
|---|---|---|---|
| `m.id` | `number` | `number` | ✅ Direct |
| `m.utcDate` | `string` | `string` | ✅ Direct |
| `m.stage` | `string` | `string` | ✅ Direct |
| `m.homeTeam.name` | `string` | `string` (CanonicalTeam) | ✅ Direct |
| `m.homeTeam.shortName` | `string \| undefined` | `string` | ✅ Direct |
| `m.homeTeam.crest` | `string` | `string` | ✅ Direct |
| `m.awayTeam.*` | same | same | ✅ Direct |
| `m.score.winner` | via `Score` | `CanonicalScore = Score` | ✅ Direct |
| `m.score.fullTime.home/away` | via `Score` | `CanonicalScore = Score` | ✅ Direct |
| `m.status` | `MatchStatus` string | **ABSENT** — has `state` instead | ⚠️ Needs mapping |
| `m.competition` | `Competition` | **ABSENT** | ✅ Not used in bracket render |

**Only one adaptation required:** `status` → `state` mapping in `ThirdPlaceCard` and `FinalCard` components (inline in `bracket/page.tsx`):

```typescript
// Current (Match-based)
const isLive     = status === 'IN_PLAY' || status === 'PAUSED';
const showScore  = ['FINISHED', 'IN_PLAY', 'PAUSED'].includes(status);

// After migration (CanonicalMatch-based)
const isLive     = match.state === 'live';
const showScore  = match.state === 'live' || match.state === 'finished';
```

`WCBracket` component: also typed as `Match[]`. Will be updated to accept `CanonicalMatch[]` in Phase 3, or receive `Match`-compatible subset — to be decided in Phase 2 when reading `WCBracket` component in full.

**MatchCard** component: used in the bracket page with `Match` type. Phase 2 will audit whether it accesses `status` directly.

---

## 5. Feature Flag Design

```typescript
// Vercel env var: AUTHORITY_CACHE_PILOT
const PILOT_ENABLED = process.env.AUTHORITY_CACHE_PILOT === 'true';

// In WCBracketPage():
if (PILOT_ENABLED) {
  // new path: authority cache
  const { getWCAuthorityMatchesV2 } = await import('@/lib/api');
  const data = await getWCAuthorityMatchesV2(new Date().toISOString());
  allMatches = data.matches.filter(m => KNOCKOUT_STAGES.has(m.stage));
} else {
  // existing path: unchanged
  const data = await getWCKnockoutMatchesCached();
  allWCMatches = data.matches;
}
```

Rollback: set `AUTHORITY_CACHE_PILOT=false` in Vercel dashboard → old path active on next ISR revalidation. No redeploy required.

---

## 6. Phase 1 Summary

**Inventory complete.** 11 WC listing pages audited:
- 6 already on authority cache (no action)
- 5 candidates evaluated — 4 eliminated
- **1 pilot selected: `bracket/page.tsx`**

**Selected pilot justification (one line):** Lowest traffic (6h TTL), isolated data fetch, authority cache has full coverage, built-in `try/catch` fallback, adaptation is minimal (one field mapping).

**Blocking issues for Phase 3:** None. Adaptation scope is known and bounded.

**Next:** Phase 2 — Document current data flow for `bracket/page.tsx` (provider chain, KV reads, render latency).
