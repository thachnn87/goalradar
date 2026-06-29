# Direct API Call Audit — RES-2C

Generated: 2026-06-08  
Auditor: automated grep + manual review  

## Summary

| Status | Count |
|--------|-------|
| ✅ Routed via `providerManager` (failover active) | 5 |
| ⚠️ Direct `football-data.org` only (no failover) | 5 |
| 🔵 Error types only (no data call) | 5 |

---

## ✅ Functions Now Using `providerManager`

These functions in `src/lib/api.ts` delegate to `providerManager`, which provides
automatic failover to `api-football` when `football-data.org` returns 403/429/5xx/timeout.
Cache layers (`withCache` / `withKVCache` / `getCachedLiveMatches`) remain in api.ts.

| Function | Provider method | Cache TTL |
|---|---|---|
| `getMatchDetail(id)` | `providerManager.getMatch(id)` | 1 min (KV SWR) |
| `getUpcomingMatches(competition)` | `providerManager.getFixtures(competition)` | 15 min (KV SWR) |
| `getRecentMatches(competition)` | `providerManager.getResults(competition)` | 15 min (KV SWR) |
| `getStandings(competition)` | `providerManager.getStandings(competition)` | 1 hr (KV SWR) |
| `getLiveMatches()` | `providerManager.getLiveMatches()` | 30 s (live-cache) |
| `getWCLiveMatches()` | `providerManager.getLiveMatches()` | 30 s (live-cache) |

---

## ⚠️ Functions Still Calling `football-data.org` Directly

These functions call `fetchWithKV`/`fetchDirect` (raw `football-data.org`) because
they have no equivalent in the `MatchProvider` interface (no secondary-provider mapping).
Failover is **not active** for these.

| Function | Endpoint | Used by |
|---|---|---|
| `getTodayMatches()` | `/matches?dateFrom=…&dateTo=…` | `src/app/page.tsx` (homepage today's matches) |
| `getTeamMatches(id)` | `/teams/{id}/matches?status=FINISHED&limit=10` | `src/app/predict/[id]/page.tsx`, `src/app/teams/[slug]/page.tsx` |
| `getWCResults()` | `/competitions/WC/matches?status=FINISHED` | `src/app/world-cup-2026-results/page.tsx`, `src/app/world-cup-2026/matches-today/page.tsx`, `src/app/world-cup-2026/results/page.tsx` |
| `getWCKnockoutMatches()` | `/competitions/WC/matches` | `src/app/world-cup-2026-bracket/page.tsx`, `src/app/world-cup-2026/bracket/page.tsx` |
| `getTeam(id)` | `/teams/{id}` | `src/app/team/[id]/page.tsx` |
| `getHeadToHead(id)` | `/matches/{id}/head2head` | `src/lib/match-snapshot.ts` |

---

## Pages → Provider Mapping

### Routes verified via `providerManager`

| Route | Functions called | Provider |
|---|---|---|
| `/match/[id]` | `getMatchDetail`, `getStandings`, `getUpcomingMatches`, `getRecentMatches` | `providerManager` ✅ |
| `/schedule` | `getUpcomingMatches`, `getRecentMatches` | `providerManager` ✅ |
| `/standings` | `getStandings` | `providerManager` ✅ |
| `/live` | `getLiveMatches` | `providerManager` ✅ |
| `/competition/[code]` | `getStandings`, `getRecentMatches`, `getUpcomingMatches` | `providerManager` ✅ |
| `/world-cup-2026/[group]` | `getStandings`, `getUpcomingMatches`, `getRecentMatches` | `providerManager` ✅ |
| `/world-cup-2026-standings` | `getStandings` | `providerManager` ✅ |
| `/world-cup-2026-groups` | `getStandings` | `providerManager` ✅ |
| `/world-cup-2026/groups` | `getStandings` | `providerManager` ✅ |

### Routes partially direct (no failover for some calls)

| Route | Direct functions | Impact |
|---|---|---|
| `/` (homepage) | `getTodayMatches` | Today's matches show error on FD outage |
| `/predict/[id]` | `getTeamMatches` | Team form unavailable on FD outage |
| `/teams/[slug]` | `getTeamMatches`, `getTeam` | Team recent results unavailable |
| `/world-cup-2026-bracket` | `getWCKnockoutMatches` | Bracket unavailable on FD outage |
| `/world-cup-2026-results` | `getWCResults` | Results page unavailable on FD outage |

---

## Failover Log Format

When `football-data.org` fails, `providerManager` emits:

```
[PROVIDER_CALL] provider=football-data | endpoint=getFixtures(WC)
[FAILOVER] football-data -> api-football | reason: disabled | endpoint=getFixtures(WC) | ts: 2026-06-08T…
[PROVIDER_CALL] provider=api-football | endpoint=getFixtures(WC)
```

Health snapshot available at: `GET /api/debug/providers`
