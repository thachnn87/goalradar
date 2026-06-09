# GoalRadar — KV Cache Key Map
## Sprint PERF-3 Phase 1

Generated: 2026-06-09

All keys use the `goalradar:` prefix.
Disaster-recovery counterparts use `goalradar:dr:` prefix.

---

## 1. World Cup Hub & Page Routes

| KV Key | TTL (fresh/stale) | Source function | Routes served |
|--------|-------------------|-----------------|---------------|
| `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` | 15 min / 30 min | `getUpcomingMatches('WC')` | `/world-cup-2026`, `/world-cup-2026/fixtures` |
| `goalradar:/competitions/WC/matches?status=FINISHED` | 15 min / 30 min | `getRecentMatches('WC')` | `/world-cup-2026`, `/world-cup-2026/results` |
| `goalradar:/competitions/WC/standings` | 1 h / 2 h | `getStandings('WC')` | `/world-cup-2026`, `/world-cup-2026/groups` |
| `goalradar:/competitions/WC/matches` | 6 h / 12 h | `getWCKnockoutMatches()` → `getAllMatches('WC')` | `/world-cup-2026`, `/world-cup-2026/bracket` |
| `goalradar:/competitions/WC/matches?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD` | 15 min / 30 min | `getRecentMatches('WC')` (date-scoped) | `/world-cup-2026/results` |

---

## 2. Live Matches

| KV Key | TTL | Source function | Routes served |
|--------|-----|-----------------|---------------|
| `goalradar:live:matches` | 30 s | `getCachedLiveMatches()` / `getCachedWCLiveMatches()` | `/live`, `/world-cup-2026` |
| `goalradar:dr:live:matches` | 7 days | DR copy of above | Fallback for all live routes |

---

## 3. Match Pages

| KV Key | TTL (fresh/stale) | Source function | Routes served |
|--------|-------------------|-----------------|---------------|
| `goalradar:/matches/{id}` | 60 s / 120 s | `getMatchDetail(id)` | `/match/[id]` score hero |
| `goalradar:/matches/{id}/head2head` | 60 s / 120 s | `getHeadToHead(id)` | `/match/[id]` H2H section |
| `goalradar:match:{id}` | 900 s (15 min) | `getOrBuildMatchSnapshot(id)` | `/match/[id]` H2H + WC group sections |
| `goalradar:dr:/matches/{id}` | 7 days | Disaster-recovery for match detail | `/match/[id]` fallback |
| `goalradar:dr:match:{id}` | 30 days | Disaster-recovery snapshot | `/match/[id]` fallback |

---

## 4. Standings (All Competitions)

| KV Key | TTL (fresh/stale) | Source function | Routes served |
|--------|-------------------|-----------------|---------------|
| `goalradar:/competitions/WC/standings` | 1 h / 2 h | `getStandings('WC')` | `/world-cup-2026/groups`, match H2H |
| `goalradar:/competitions/PL/standings` | 1 h / 2 h | `getStandings('PL')` | `/standings` |
| `goalradar:/competitions/PD/standings` | 1 h / 2 h | `getStandings('PD')` | `/standings` |
| `goalradar:/competitions/BL1/standings` | 1 h / 2 h | `getStandings('BL1')` | `/standings` |
| `goalradar:/competitions/SA/standings` | 1 h / 2 h | `getStandings('SA')` | `/standings` |
| `goalradar:/competitions/FL1/standings` | 1 h / 2 h | `getStandings('FL1')` | `/standings` |
| `goalradar:/competitions/CL/standings` | 1 h / 2 h | `getStandings('CL')` | `/standings` |

---

## 5. Schedule / General Fixtures

| KV Key | TTL (fresh/stale) | Source function | Routes served |
|--------|-------------------|-----------------|---------------|
| `goalradar:/competitions/{CODE}/matches?status=SCHEDULED,TIMED` | 15 min / 30 min | `getUpcomingMatches(code)` | `/schedule`, `/world-cup-2026/fixtures` |
| `goalradar:/competitions/{CODE}/matches?status=FINISHED` | 15 min / 30 min | `getRecentMatches(code)` | `/results`, `/world-cup-2026/results` |
| `goalradar:/teams/{id}/matches?status=FINISHED&limit=10` | 15 min / 30 min | `getTeamMatches(id)` | Team stats in match H2H |

---

## 6. Prewarm / Orchestrator

| KV Key | TTL | Written by | Purpose |
|--------|-----|-----------|---------|
| `goalradar:prewarm:last-run` | 7 days | `savePrewarmRecord()` | `/api/debug/prewarm-status` — last run metadata |
| `goalradar:prewarm:match-ids` | 7 days | `prewarmWorldCup()` | `/api/debug/cache-health` — seeded match ID manifest |

---

## 7. Key Format Summary

| Pattern | Module | Format |
|---------|--------|--------|
| `goalradar:{endpoint}` | `kv-cache.ts withKVCache()` | `{ data: T, fetchedAt: number, freshUntil: number }` |
| `goalradar:dr:{endpoint}` | `kv-cache.ts` (disaster recovery) | Same as above, TTL 7 days |
| `goalradar:live:matches` | `live-cache.ts` | `{ matches: Match[], fetchedAt: number }` |
| `goalradar:dr:live:matches` | `live-cache.ts` (DR) | Same as above, TTL 7 days |
| `goalradar:match:{id}` | `match-snapshot.ts` | `MatchSnapshot` (no wrapper), TTL 900 s |
| `goalradar:dr:match:{id}` | `match-snapshot.ts` (DR) | `MatchSnapshot` (no wrapper), TTL 30 days |
| `goalradar:prewarm:*` | `refresh.ts` / `prewarm/worldcup.ts` | Prewarm metadata |

---

## 8. SWR Timing Constants

| Constant | Fresh | Stale (KV TTL) | Used for |
|----------|-------|----------------|---------|
| `SWR.LIVE` | 30 s | 60 s | Live match data |
| `SWR.MATCH` | 60 s | 120 s | Match detail, H2H |
| `SWR.FIXTURES` | 900 s | 1 800 s | Fixtures, results, team matches |
| `SWR.STANDINGS` | 3 600 s | 7 200 s | Standings, team info |
| `SWR.WC` | 21 600 s | 43 200 s | WC all-matches, bracket |
| Snapshot TTL | — | 900 s | `goalradar:match:{id}` |
| Snapshot DR TTL | — | 30 days | `goalradar:dr:match:{id}` |

---

## 9. PERF-3 Seeding Coverage

After one orchestrator run (`/api/cron/orchestrator`):

| Cache area | Keys seeded | Method |
|-----------|-------------|--------|
| WC fixtures | 1 | `refreshEndpoint` |
| WC results | 1 | `refreshEndpoint` |
| WC standings | 1 | `refreshEndpoint` |
| WC all-matches / bracket | 1 | `refreshEndpoint` |
| Live matches | 1 | `refreshLiveMatches` |
| All 7 league standings | 7 | `refreshEndpoint` |
| WC match detail (all 104) | 104 | `prewarmWorldCup()` — derived from getAllMatches, 0 extra API calls |
| WC match snapshots (all 104) | 104 | `prewarmWorldCup()` — derived from getAllMatches + standings |
| DR copies of match detail | 104 | `prewarmWorldCup()` — 7-day TTL |
| DR copies of snapshots | 104 | `prewarmWorldCup()` — 30-day TTL |

**Total API calls per orchestrator run:** 14 + 2 (PERF-3) = **16** (down from previous 12, +4 for seeding)

**Total KV keys populated:** ~429 per full run (104 matches × 4 keys + 5 WC endpoints + 7 standings + 3 misc)
