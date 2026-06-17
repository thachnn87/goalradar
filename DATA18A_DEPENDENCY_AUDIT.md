# DATA-18A Dependency Audit
## Full Match Data Dependency Map — World Cup 2026

Date: 2026-06-17
Status: Audit only — no code changes.

---

## 1. Data Origin Map

Every distinct place where WC Match data enters the system.

### 1.1 External Providers

| Provider | Entry point | Transport | Auth |
|----------|-------------|-----------|------|
| Football-Data.org (FD) | `football-data.ts` `fetchRaw()` | REST, JSON | `X-Auth-Token` header |
| ESPN | `providers/espn.ts` `fetchScoreboard()` / `getEspnMatchEvents()` | REST, public JSON | none |
| ApiFootball (AF) | `providers/api-football.ts` | REST, JSON | `x-rapidapi-key` header |

AF is confirmed dormant for WC 2026 (free-plan restriction: seasons 2022–2024 only).
ESPN is the sole active enrichment provider.

### 1.2 FD API Endpoints Used for WC

| Endpoint | Called by | Purpose |
|----------|-----------|---------|
| `/competitions/WC/matches?status=SCHEDULED,TIMED` | `providerManager.getFixtures('WC')` | Upcoming fixtures |
| `/competitions/WC/matches?status=FINISHED` | `providerManager.getResults('WC')` | Finished results |
| `/competitions/WC/matches` | `providerManager.getAllMatches('WC')` | Full fixture list (knockout) |
| `/matches/{id}` | `providerManager.getMatch(id)` | Single match detail |
| `/competitions/WC/standings` | `providerManager.getStandings('WC')` | Group standings |

---

## 2. Cache Layer Map

### 2.1 Bulk Feed Caches (written by orchestrator cron)

| Cache key | Type | TTL fresh | TTL stale | Written by | Read by |
|-----------|------|-----------|-----------|-----------|---------|
| `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` | `Match[]` | 900s (15 min) | 1800s (30 min) | orchestrator → `getFixtures('WC')` | `getUpcomingMatchesCached('WC')` |
| `goalradar:/competitions/WC/matches?status=FINISHED` | `Match[]` | 21600s (6 h) | 43200s (12 h) | orchestrator → `getResults('WC')` | `getWCResultsCached()` |
| `goalradar:/competitions/WC/matches` | `Match[]` | — | 43200s (12 h) | orchestrator → `getAllMatches('WC')` | `getWCKnockoutMatchesCached()` |
| `goalradar:/competitions/WC/standings` | `StandingTable[]` | 3600s (1 h) | — | orchestrator → `getStandings('WC')` | `getStandingsCached('WC')` |

### 2.2 Live Cache (written by refresh cron, ~30s interval)

| Cache key | Type | TTL | Written by | Read by |
|-----------|------|-----|-----------|---------|
| `goalradar:live:matches` | `KVLiveEntry[]` | 30s | `refreshLiveMatches()` in `refresh.ts` | `getWCLiveMatches()` → `getWCAuthorityMatchesCached()` |
| `goalradar:dr:live:matches` | `KVLiveEntry[]` | 7d | same | DR fallback in `live-cache.ts` |

### 2.3 Per-Match Snapshot Cache (written on demand + prewarm)

| Cache key | Type | TTL (FINISHED) | TTL (UPCOMING) | Written by | Read by |
|-----------|------|----------------|----------------|-----------|---------|
| `goalradar:match:{fdId}` | `MatchSnapshot` | 7d | min(6h, time-to-kickoff + 5min) | `match-snapshot.ts` `buildSnapshot()` | `overlayMatchStates()` + match detail pages |
| `goalradar:dr:match:{fdId}` | `MatchSnapshot` | 30d | — | `match-snapshot.ts` | `readDRSnapshot()` fallback |
| `goalradar:/matches/{fdId}` | `MatchDetail` | SWR-managed | — | `kv-cache.ts` | `match-snapshot.ts` |
| `goalradar:dr:/matches/{fdId}` | `MatchDetail` | 7d | — | `prewarm/worldcup.ts` | DR fallback |

### 2.4 ESPN Enrichment Caches

| Cache key | Type | TTL | Written by | Read by |
|-----------|------|-----|-----------|---------|
| `goalradar:espn:lookup:{fdId}` | ESPN event ID string \| `'__NOT_FOUND__'` | 30d | `espn-id-map.ts` `resolveEspnMatchId()` | `enrichMatchWithEspnEvents()` |
| `goalradar:espn:event:{fdId}` | `CachedEspnEvents` | 12h | `espn-id-map.ts` `enrichMatchWithEspnEvents()` | `match-snapshot.ts` `buildSnapshot()` |

### 2.5 Provider Identity / Mapping Caches

| Cache key | Type | TTL | Written by | Read by |
|-----------|------|-----|-----------|---------|
| `goalradar:af:lookup:WC:2026` | `Record<naturalKey, afFixtureId>` | 24h | `af-id-map.ts` | `resolveAfFixtureId()` (dormant for WC 2026) |
| `goalradar:af:events:{fdId}` | `CachedAFEvents` | 7d | `af-id-map.ts` | `enrichMatchWithAFEvents()` (dormant for WC 2026) |

### 2.6 Infrastructure Caches

| Cache key | Purpose |
|-----------|---------|
| `goalradar:prewarm:match-ids` | seeded prewarm IDs |
| `goalradar:prewarm:metrics` / `goalradar:prewarm:last-run` | prewarm telemetry |
| `goalradar:revalidation:last-run` | ISR revalidation record |
| `goalradar:rate-safe:active` | rate-limit guard flag |
| `goalradar:lock:{logKey}` / `goalradar:lock:snapshot:{id}` | write locks |
| `goalradar:sitemap:matches` / `goalradar:sitemap:teams` | sitemap caches |
| `goalradar:debug:canary:{ts}` | KV health canary |

---

## 3. Composition Layer Map

### 3.1 `getWCAuthorityMatchesCached()` — current merge function (`src/lib/api.ts:536`)

```
getUpcomingMatchesCached('WC')   → SCHEDULED/TIMED matches (STATE_RANK=0)
getWCResultsCached()             → FINISHED matches (STATE_RANK=3)
getWCLiveMatches()               → IN_PLAY/PAUSED matches (STATE_RANK=2)
        ↓
Merge by match ID — forward-only STATE_RANK rule: higher rank wins
        ↓
overlayMatchStates([...byId.values()])
  → kv.mget(goalradar:match:{id}, ...)  per match in merged list
  → snapshot present AND rank(snapshot.status) > rank(current): advance status
  → snapshot present AND FINISHED: copy in score, goals, minute
        ↓
{ matches: Match[] }  — 104 WC matches in best-known state
```

### 3.2 `overlayMatchStates()` — snapshot overlay (`src/lib/match-state-overlay.ts`)

```
Input: Match[]  (from bulk feeds)
For each match:
  1. Read goalradar:match:{id} from KV (mget batch)
  2. If snapshot.status rank > current rank → advance status
  3. If snapshot.status === FINISHED → copy score.fullTime from snapshot
  4. If snapshot.minute present → copy minute
Output: Match[]  (same array, mutated in place)
```

STATE_RANK: `{ SCHEDULED: 0, TIMED: 0, IN_PLAY: 2, PAUSED: 2, FINISHED: 3 }`

### 3.3 `buildSnapshot()` — per-match enrichment (`src/lib/match-snapshot.ts:343`)

```
Input: fdId
1. Read goalradar:/matches/{fdId} (FD match detail)
2. needsEnrichment = FINISHED && WC && goals.length === 0
3. AF_ENRICHMENT_ENABLED? → enrichMatchWithAFEvents() [dormant for WC 2026]
4. ESPN_ENRICHMENT_ENABLED && still goals===0?
     → enrichMatchWithEspnEvents()
         a. Read goalradar:espn:event:{fdId}  → HIT? apply
         b. resolveEspnMatchId()
              → Read goalradar:espn:lookup:{fdId}  → HIT? return
              → findEspnMatch(home, away, utcDate)  [ESPN scoreboard scan]
              → Write goalradar:espn:lookup:{fdId}, 30d
         c. getEspnMatchEvents(espnId)
         d. Write goalradar:espn:event:{fdId}, 12h
5. Write goalradar:match:{fdId}  (TTL: 7d FINISHED, min(6h,tti+5min) UPCOMING)
6. Write goalradar:dr:match:{fdId}, 30d
Output: MatchSnapshot (MatchDetail + espnMatchId + enrichedAt + enrichmentSource)
```

---

## 4. Consumer Map — All WC Pages

| Page | Route | Current fetch function | Cache keys read | classifyMatchState? |
|------|-------|----------------------|-----------------|---------------------|
| Hub | `/world-cup-2026` | `getWCAuthorityMatches()` | SCHEDULED+TIMED, FINISHED, live, snapshots | ✅ |
| Results | `/world-cup-2026-results` | `getWCAuthorityMatches()` | same | ✅ |
| Schedule | `/world-cup-2026-schedule` | `getWCAuthorityMatches()` | same | ✅ |
| Fixtures | `/world-cup-2026/fixtures` | `getWCAuthorityMatches()` | same | ✅ |
| Group detail | `/world-cup-2026/[group]` | `getWCAuthorityMatches()` | same | ✅ |
| Standings | `/world-cup-2026-standings` | `getStandingsCached('WC')` | standings | N/A |
| Groups index | `/world-cup-2026-groups` | `getStandingsCached('WC')` | standings | N/A |
| Live | `/live` | `getLiveMatches()` | `live:matches` | cross-competition |
| Match detail | `/match/[id]` | `getOrBuildMatchSnapshot(id)` | `match:{id}` + `/matches/{id}` + ESPN | N/A |

All WC pages now use `getWCAuthorityMatches()` (DATA-17). The composition layer is centralised.

---

## 5. Data Ownership Summary

| Data domain | Authoritative owner | Notes |
|-------------|---------------------|-------|
| Fixture identity (teams, date, competition) | Football-Data.org | FD match ID is the primary key for everything |
| Status (SCHEDULED/TIMED/FINISHED) | FD bulk feeds + overlay | Live cache can advance to IN_PLAY/PAUSED |
| Score (fullTime home/away) | FD results feed | ESPN never provides score |
| Goals (scorer, minute, type) | ESPN enrichment (WC 2026) | AF dormant; ESPN is sole enricher |
| Cards (booking events) | ESPN enrichment | Same |
| Substitutions | ESPN enrichment | Same |
| Lineups | ESPN enrichment | Same |
| Live minute | Live cache (primary provider) | 30s TTL |
| Team IDs in events | Reconciled in `applyEspnEvents()` | ESPN team IDs ≠ FD team IDs — DATA-14A fix |
| Provider ID mapping (ESPN) | `goalradar:espn:lookup:{fdId}` | Per-match, lazy-resolved, 30d |
| Provider ID mapping (AF) | `goalradar:af:lookup:WC:2026` | Tournament table, dormant |

---

## 6. Replacement Plan (preview — detail in DATA18A_MIGRATION_PLAN.md)

| Current component | Replacement | Stage |
|-------------------|-------------|-------|
| `CanonicalMatch = Match` (type alias) | `CanonicalMatch` real interface | S1 (dormant) |
| `getWCAuthorityMatchesCached()` inline merge | `buildCanonicalMatch()` per-match builder | S1 (dormant) |
| `getWCAuthorityMatches()` delegating to cached | `getWCAuthorityMatches()` returning `CanonicalMatch[]` from authority cache | S3 (opt-in) |
| `overlayMatchStates()` — mutates Match[] | absorbed into `buildCanonicalMatch()` | S4 (cutover) |
| `type CanonicalMatch = Match` export | real `CanonicalMatch` export | S4 |
| Per-page field accesses on `Match` shape | per-page field accesses on `CanonicalMatch` shape | S4 |
| Date-scoped key `?dateFrom=…` | removed in DATA-17; already done | done |
