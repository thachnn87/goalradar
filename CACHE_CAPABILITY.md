# CACHE_CAPABILITY — DATA-18WC.PHASE0

**Date:** 2026-06-26
**Status:** VERIFIED ✅

---

## Cache Architecture

```
L1: In-Memory (withCache)
  └─ Per-process, sub-ms, 30s–1h TTL, evicts on process restart

L2: Vercel KV (withKVCache, SWR)
  └─ Redis-backed, ~10ms, cross-instance, SWR semantics (fresh + stale window)

L3: Disaster Recovery (KV, long TTL)
  └─ Written alongside L2, 30-day TTL, last resort when API fails
```

---

## KV Key Registry

### Match Data

| KV Key | Type | Fresh TTL | Stale TTL | Writer | Readers |
|---|---|---|---|---|---|
| `goalradar:match:{id}` | MatchSnapshot | tier-aware | tier-aware | getOrBuildMatchSnapshot | match page, meta |
| `goalradar:dr:match:{id}` | MatchSnapshot | 30 days | — | getOrBuildMatchSnapshot | emergency fallback |
| `goalradar:/matches/{id}` | KVEntry<MatchDetail> | 60s | 120s | refreshEndpoint | snapshot builder |
| `goalradar:live:matches` | Match[] | 30s | 60s | live cache refresh | snapshot overlay, hub |

### Snapshot TTL by Tier

| Match state | Fresh TTL | Stale window | Notes |
|---|---|---|---|
| IN_PLAY / PAUSED | 30s | 60s | Live cache owns; not written to snapshot key |
| SCHEDULED (>24h) | 6h | 12h | May shorten to time-before-kickoff + 5min |
| SCHEDULED (≤24h, PRE_MATCH) | ~time-before-kickoff + 5min | — | |
| PROJECTED (TBD teams, homeTeam.id=0) | 5min | — | Fast rebuild for team resolution |
| FINISHED | 7 days | — | Score immutable |
| POSTPONED / CANCELLED | 15min | — | Status may change |

### Competition Data

| KV Key | Type | Fresh TTL | Stale TTL | Writer | Readers |
|---|---|---|---|---|---|
| `goalradar:/competitions/WC/standings` | KVEntry<Standings> | 6h | 12h | refreshEndpoint (cron) | group pages, standings, qual engine |
| `goalradar:/competitions/PL/standings` | KVEntry<Standings> | 1h | 2h | refreshEndpoint (cron) | league standings |
| `goalradar:/competitions/{code}/matches` | KVEntry<Match[]> | 15min | 30min | refreshEndpoint (cron) | hub, schedule |

### Authority

| KV Key | Type | Fresh TTL | Stale TTL | Writer | Readers |
|---|---|---|---|---|---|
| `goalradar:authority:v1` | CanonicalMatch[] | 5min | — | cron orchestrator | hub, bracket, rounds, schedule, team pages |

### Enrichment / ID Maps

| KV Key | Type | TTL | Writer | Readers |
|---|---|---|---|---|
| `goalradar:espn:lookup:{fdMatchId}` | string (ESPN event ID) | 30 days | espn-id-map | ESPN enrichment |
| `goalradar:espn:event:{fdMatchId}` | EspnMatchEvents | 30 days | espn-id-map | snapshot enrichment |
| `goalradar:af:lookup:WC:2026` | Map<key, afId> | 24h | af-id-map | AF enrichment |
| `goalradar:af:events:{fdMatchId}` | AF events | 7 days | af-id-map | snapshot enrichment |

### Locks (Distributed Coordination)

| KV Key | TTL | Purpose |
|---|---|---|
| `goalradar:lock:snapshot:{id}` | 60s | Cross-instance snapshot build (one writer) |
| `goalradar:repair-lock:{id}` | 30min | Self-heal: unenriched snapshot rebuild |
| `goalradar:team-resolve-lock:{id}` | 5min | TBD knockout team resolution |
| `goalradar:score-drift-lock:{id}` | 30min | Score drift reconciliation |
| `goalradar:rate-safe:active` | Dynamic (15min–1h) | Circuit-breaker (all provider calls blocked) |

---

## What Each Cache Owns

### Matches

| Data | Cache owner | Notes |
|---|---|---|
| All WC match listings | `goalradar:authority:v1` | Canonical; single read for all listing pages |
| Individual match detail | `goalradar:match:{id}` (snapshot) | Full MatchDetail + H2H + standings |
| Live match scores | `goalradar:live:matches` | 30s refresh; overlaid onto snapshots |
| Match KV detail (raw) | `goalradar:/matches/{id}` | Raw provider response; snapshot builder fallback |
| Disaster recovery | `goalradar:dr:match:{id}` | 30-day last resort |

### Standings

| Data | Cache owner | Notes |
|---|---|---|
| WC group standings | `goalradar:/competitions/WC/standings` | 6h TTL; qualification engine reads this |
| League standings | `goalradar:/competitions/{code}/standings` | 1h TTL |
| Qualification status | In-memory (computed per request) | Engine runs on standings KV read |

### Teams

| Data | Cache owner | Notes |
|---|---|---|
| Team profile (FD TeamDetail) | `goalradar:/teams/{id}` | 6h TTL (cron refresh) |
| Team recent matches | Included in TeamDetail KV or computed | |
| Team static data (slug, rank, intro) | Bundle (wc-all-teams.ts) | No KV, build-time |

### Bracket / Knockout

| Data | Cache owner | Notes |
|---|---|---|
| Knockout bracket matches | `goalradar:authority:v1` | Filtered to knockout stages |
| Slot labels | Computed from authority + standings | KnockoutVM, no dedicated KV |

### Venues

| Data | Cache owner | Notes |
|---|---|---|
| All venue data | Bundle (wc-venues.ts) | No KV, build-time |

### Narratives / SEO

| Data | Cache owner | Notes |
|---|---|---|
| Match narrative (article) | Generated per request | No KV; very fast (pure function) |
| FAQs | Generated per request | No KV |
| JSON-LD schemas | Generated per request | No KV |

---

## SWR Semantics

All KV reads use stale-while-revalidate:

```
KV read
  Fresh (age < freshTTL) → return immediately, no background work
  Stale (age < staleTTL) → return immediately + enqueue background revalidate
  Expired (age > staleTTL) → block and rebuild
  Miss → block and build from provider
```

The background revalidate acquires the lock key before calling the provider, preventing thundering herd across Vercel function instances.

---

## Cache Gap Risks

| Risk | Affected Keys | Mitigation |
|---|---|---|
| authority:v1 older than kickoff + group resolution | authority:v1 | 5-min TTL + cron every 1 min |
| Snapshot has unenriched FINISHED WC match | goalradar:match:{id} | Self-heal guard (repair-lock) |
| Score drift between detail KV and snapshot | goalradar:match:{id} | Score drift guard rebuilds once |
| TBD teams block knockout page | goalradar:match:{id} | 5-min rebuild, slot label fallback |
| DR key has unenriched version (downgrade) | goalradar:dr:match:{id} | Downgrade guard: check DR before writing |
| Cold start: no KV entries at all | All | Static WC fixtures as last fallback |
