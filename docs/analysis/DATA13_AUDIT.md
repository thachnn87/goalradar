# DATA-13 Audit
## GoalRadar · ESPN Event Enrichment

Date: 2026-06-16
Commit: pending

---

## Objective

Enrich FINISHED World Cup matches with goals, scorers, cards, and substitutions
sourced from ESPN's public API. football-data.org remains the sole authority for
fixtures, standings, groups, kickoff times, match status, and scores.

---

## Files Created / Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/providers/espn.ts` | Created | ESPN API client — `findEspnMatch()`, `getEspnMatchEvents()` |
| `src/lib/espn-id-map.ts` | Created | KV caching + `enrichMatchWithEspnEvents()` |
| `src/lib/match-snapshot.ts` | Modified | Wired ESPN enrichment into `buildSnapshot()` |
| `src/app/api/debug/espn-enrichment/[matchId]/route.ts` | Created | Debug inspection endpoint |

---

## Mapping Strategy

### Cross-ID Problem

football-data.org and ESPN use incompatible integer IDs for the same match.
There is no shared external ID standard between them.

### Solution: Date + Team Name Matching

Rather than building a shared lookup table (the af-id-map.ts approach), ESPN
uses **per-match lazy resolution**:

1. On first enrichment request for a match, query ESPN scoreboard for the
   match date: `GET /scoreboard?dates={YYYYMMDD}`
2. Search returned events for home/away team names that normalise to the same
   string as the FD team names.
3. Store the resolved ESPN event ID at `goalradar:espn:lookup:{fdMatchId}`
   (30-day TTL). Subsequent enrichment reads from KV — no scoreboard query.

### Team Name Normalisation

Both providers use the same normalisation pipeline:
1. Lowercase
2. NFD Unicode normalisation + diacritic stripping (handles Côte d'Ivoire, etc.)
3. Canonical alias table (`ESPN_ALIASES` in `espn.ts`) for known divergences:
   - `"united states"` / `"united states men"` → `"usa"`
   - `"korea republic"` → `"south korea"`
   - `"côte d'ivoire"` / `"cote d'ivoire"` → `"ivory coast"`
   - etc.

Fallback: if `displayName` doesn't match, `shortDisplayName` is tried.

### Why Per-Match Keys (vs. af-id-map Shared Table)

The af-id-map approach requires seeding the entire tournament table upfront
(`POST /refresh-lookup`), which failed because api-football's Free plan
restricts season 2026 access. ESPN is public and free — per-match lazy
resolution is simpler and doesn't require a seed step. Matches are resolved
on first page view and cached for 30 days.

---

## Cache Strategy

### Lookup Cache — `goalradar:espn:lookup:{fdMatchId}`

| Property | Value |
|----------|-------|
| Content | ESPN event ID string (or explicit `null` for confirmed misses) |
| TTL | 30 days |
| Populated | On first enrichment attempt, lazily |
| Invalidation | Expires naturally; can be manually deleted via KV dashboard |
| Null storage | Yes — explicit null stored on miss to suppress repeat scoreboard calls |

Storing null on miss is important: if ESPN doesn't have a match at first
check (e.g., match just finished), the null prevents hammering the ESPN
scoreboard API on every snapshot rebuild for 30 days.

### Event Cache — `goalradar:espn:event:{fdMatchId}`

| Property | Value |
|----------|-------|
| Content | `CachedEspnEvents` — goals, bookings, substitutions, espnMatchId, enrichedAt |
| TTL | 12 hours |
| Populated | On first successful event fetch |
| Rationale | FINISHED match events never change, but 12h vs 7-day (AF) is conservative given ESPN is free and unverified for extended periods |

### KV Read Pattern

`enrichMatchWithEspnEvents()` issues at most **2 sequential KV reads** before
making any ESPN API call:

```
kv.get(goalradar:espn:event:{id})   → HIT → return immediately (0 ESPN calls)
                                      MISS → continue
kv.get(goalradar:espn:lookup:{id})  → HIT → skip scoreboard call
                                      MISS → call ESPN scoreboard
```

In steady state (both caches warm) the enrichment path costs **2 KV reads**
and **0 ESPN API calls** per snapshot build.

---

## Failure Handling

### ESPN Provider (`espn.ts`)

| Failure | Behaviour |
|---------|-----------|
| Network timeout (10s) | `espnFetch()` throws `AbortError` — propagates to caller |
| HTTP non-200 | `espnFetch()` throws with HTTP status — propagates |
| Missing `events` array in scoreboard | `findEspnMatch()` returns null |
| No team name match | `findEspnMatch()` logs warning, returns null |
| Missing `scoringPlays` | `parseGoals()` operates on `[]` → empty array |
| Missing `plays` | `parseBookings()` / `parseSubstitutions()` operate on `[]` |
| Participant without athlete | Skipped (no-crash) |
| Period number missing | Defaults to 1 (conservative — avoids wrong minute offset) |

### Enrichment Orchestrator (`espn-id-map.ts`)

`enrichMatchWithEspnEvents()` wraps its entire body in a try/catch and returns
the **original unenriched match** on any failure. The snapshot always writes.
No error surfaces to the user.

Specific cases:

| Failure | Logged As | Match Returned |
|---------|-----------|----------------|
| `KV_ENABLED = false` | — | unenriched (silent) |
| `ESPN_ENRICHMENT_ENABLED = false` | — | not called |
| KV read throws | error | unenriched |
| `findEspnMatch()` returns null | warn | unenriched |
| `getEspnMatchEvents()` returns null | warn | unenriched |
| `getEspnMatchEvents()` throws | error | unenriched |
| KV write fails (fire-and-forget) | error | enriched (write failure doesn't block) |

---

## Provider Fallback Order

The enrichment chain in `buildSnapshot()` follows this priority:

```
needsEnrichment = FINISHED && WC && goals.length === 0

if needsEnrichment && AF_ENRICHMENT_ENABLED:
    match = enrichMatchWithAFEvents(match)        ← api-football (DATA-11B)

if needsEnrichment && ESPN_ENRICHMENT_ENABLED && goals.length === 0:
    match = enrichMatchWithEspnEvents(match)      ← ESPN (DATA-13)
```

**api-football runs first** (when enabled). ESPN runs only if:
- AF enrichment is disabled (`ENABLE_AF_ENRICHMENT` not set), OR
- AF enrichment ran but produced no goals (lookup-miss from empty table)

This ordering ensures:
1. AF takes precedence when available (paid plan with more structured data)
2. ESPN provides automatic coverage when AF can't (Free plan, lookup-miss)
3. The match page always renders — worst case shows zero events (same as before)

### Current Production State

| Provider | Flag | Status |
|----------|------|--------|
| api-football | `ENABLE_AF_ENRICHMENT=true` (set in Vercel) | Blocked — Free plan cannot access season 2026 → `lookup-miss` on every call |
| ESPN | `ENABLE_ESPN_ENRICHMENT` not set → defaults ON | Active when KV available |

In practice, today all enrichment falls through to ESPN.

---

## Enrichment Trigger Guard

The enrichment block only fires when all three conditions are true:

| Condition | Reason |
|-----------|--------|
| `match.status === 'FINISHED'` | Never enrich live or upcoming matches |
| `match.competition?.code === 'WC'` | WC-only for now — other competitions untested |
| `match.goals?.length === 0` | Respect future FD Tier 2 upgrade; don't overwrite real data |

ESPN is **never called during live polling**. The live pipeline
(`getLiveMatches()`, `/api/live-score/`, `MatchLiveZone`) does not touch
`buildSnapshot()` — it reads from `goalradar:live:matches` directly.

---

## Debug Endpoint

```
GET /api/debug/espn-enrichment/{fdMatchId}?secret={CRON_SECRET}
```

Returns:

```json
{
  "fdMatchId": "537391",
  "espnMatchId": "694428",
  "enrichmentEnabled": true,
  "kvEnabled": true,
  "lookupHit": true,
  "lookupAgeSeconds": null,
  "eventCacheHit": true,
  "eventCacheAgeSeconds": 3600,
  "goalsCount": 3,
  "cardsCount": 2,
  "substitutionsCount": 6,
  "snapshotStatus": "FINISHED",
  "snapshotGoalsCount": 3,
  "enrichmentApplied": true,
  "source": "kv-cache",
  "checkedAt": "2026-06-16T20:00:00.000Z"
}
```

`source` values:

| Value | Meaning |
|-------|---------|
| `kv-cache` | Events served from `goalradar:espn:event:{id}` |
| `espn-fresh` | ESPN ID known, events not yet cached — will fetch on next snapshot build |
| `lookup-miss` | No ESPN event ID found for this match |
| `not-enabled` | `ESPN_ENRICHMENT_ENABLED = false` |
| `not-finished` | Match is not FINISHED |
| `no-snapshot` | No KV snapshot exists yet |

---

## No-Change Boundaries

Per DATA-13 spec, the following are explicitly unchanged:

| Area | Status |
|------|--------|
| football-data.org fixtures | Unchanged |
| football-data.org standings | Unchanged |
| football-data.org kickoff times | Unchanged |
| football-data.org match status | Unchanged |
| football-data.org scores | Unchanged |
| Live polling pipeline | Unchanged |
| UI components | Unchanged |
| Schedule / standings pages | Unchanged |

---

## ESPN API Notes

| Property | Value |
|----------|-------|
| Base URL | `https://site.api.espn.com/apis/site/v2/sports/soccer` |
| Auth | None required (public API) |
| Rate limit | Not documented; treated as best-effort |
| WC 2026 league slug | `fifa.world` (configurable via `ESPN_WC_LEAGUE` env var) |
| Timeout | 10s per request |
| Scoreboard endpoint | `/{league}/scoreboard?dates={YYYYMMDD}` |
| Summary endpoint | `/{league}/summary?event={id}` |

The `ESPN_WC_LEAGUE` env var allows switching the league slug without a
code deploy — useful if ESPN uses a different slug for the 2026 edition
(e.g., `fifa.world.2026`).

---

## TypeScript

`npx tsc --noEmit` — **0 errors** after all changes.
