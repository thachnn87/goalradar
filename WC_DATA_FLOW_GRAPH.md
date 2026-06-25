# WC_DATA_FLOW_GRAPH.md — Complete WC 2026 Data Pipeline
**Sprint:** DATA-18WC.12  
**Date:** 2026-06-25  
**Source files traced:** api.ts, wc-static-groups.ts, wc-qualification.ts, wc-fixtures.ts, cron/orchestrator/route.ts, refresh.ts, authority-cache.ts

---

## Complete Data Flow

```
football-data.org v4 API
        │
        │  /competitions/WC/matches  (bulk, scheduled, finished, recent)
        │  /competitions/WC/standings
        │  /competitions/WC/matches?status=SCHEDULED,TIMED
        │  /matches?dateFrom=T&dateTo=T
        │  /teams/{id}
        │
        ▼
  refreshEndpoint() — src/lib/refresh.ts
  • Calls FD API with rate-safe guard
  • On 429/403: activates RATE-SAFE MODE (all tasks skip)
  • On success: writes raw FD API JSON to KV
  • On error: does NOT write to KV (key remains stale/empty)
        │
        ▼
  Vercel KV (primary store)
  ┌──────────────────────────────────────────────────────┐
  │  goalradar:/competitions/WC/matches          TTL 21600s (6h)  │
  │  goalradar:/competitions/WC/matches?status=… TTL 900s  (15m) │
  │  goalradar:/competitions/WC/standings        TTL 7200s (2h)   │
  │  goalradar:/matches?dateFrom=…               TTL 120s         │
  │  goalradar:live:matches                      TTL 30s          │
  │  goalradar:match:{id}          (snapshot)    TTL 900s         │
  │  goalradar:dr:match:{id}       (DR snapshot) TTL 30d          │
  │  goalradar:wc:authority:v1     (authority)   TTL 30–900s      │
  │  goalradar:/teams/{id}                       TTL 86400s (24h) │
  └──────────────────────────────────────────────────────┘
        │
        ├── STANDINGS PATH ─────────────────────────────────────────┐
        │   readKVOnly('/competitions/WC/standings')                 │
        │   → merge with getStaticWCGroupTables() (wc-all-teams.ts) │
        │   → toGroupKey() normalizes "Group A" → "GROUP_A"         │
        │   → if KV null: return static skeleton (ALL ZEROS)  ◄─────┤
        │                                                    [BROKEN]│
        │                                                            │
        ├── AUTHORITY PATH ─────────────────────────────────────────┤
        │   prewarmWorldCup() → per-match snapshot keys             │
        │   writeAuthorityCache() → goalradar:wc:authority:v1       │
        │   getWCAuthorityMatchesV2() reads authority key            │
        │   overlayMatchStates() applies snapshot overrides          │
        │   classifyMatchState() classifies each match               │
        │                                                            │
        ├── LIVE PATH ──────────────────────────────────────────────┤
        │   refreshLiveMatches() → goalradar:live:matches (30s TTL) │
        │   getCurrentLiveMatches() reads live key                   │
        │   effectiveBucket() demotes stale ghost-live matches       │
        │                                                            │
        └── UPCOMING PATH ──────────────────────────────────────────┤
            readKVOnly('/competitions/WC/matches?status=SCHEDULED…') │
            → filter SCHEDULED/TIMED from authority cache            │
        ─────────────────────────────────────────────────────────────┘
        │
        ▼
  React Server Components (ISR)
  ┌──────────────────────────────────────────────────────────────────┐
  │  /world-cup-2026           revalidate=30s  (hub)                 │
  │  /world-cup-2026/groups    revalidate=3600s (1h)                 │
  │  /world-cup-2026/[group]   revalidate=3600s (1h)                 │
  │  /world-cup-2026/fixtures  revalidate=900s  (15m)                │
  │  /world-cup-2026/results   revalidate=900s  (15m)                │
  │  /world-cup-2026/teams/…   revalidate=3600s (1h)                 │
  │  /world-cup-2026/bracket   revalidate=900s  (15m) [was 21600s]   │
  │  /world-cup-2026/round-of-32 revalidate=900s (15m)               │
  └──────────────────────────────────────────────────────────────────┘
        │
        ▼
  ISR HTML cache (Vercel CDN edge)
        │
        ▼
  Production HTML → Browser
```

---

## Known Breaks

| Break | Location | Impact |
|---|---|---|
| **[BROKEN] Standings KV empty** | `/competitions/WC/standings` never written or expired | All group standing pages show 0 pts for all teams |
| **[BROKEN] Group composition wrong** | `wc-all-teams.ts` (pre-draw guesses) | Static skeleton has wrong teams per group; team pages show wrong group mates |
| **[BROKEN] DR cache poisoned** | `goalradar:dr:match:537412` | Panama vs Croatia shown as FT 0-1; match is CANCELLED |
| **[PARTIAL] Group A count** | Germany→K, Norway→A fixed; Group A now has 5 teams | One Group A team still needs relocating |

---

## Orchestrator Schedule

The cron at `/api/cron/orchestrator` runs every 30 minutes and executes 12 tasks sequentially:

1. `wc-all-matches` — `/competitions/WC/matches`
2. `wc-upcoming` — `/competitions/WC/matches?status=SCHEDULED,TIMED`
3. `wc-finished` — `/competitions/WC/matches?status=FINISHED`
4. `wc-recent` — `/competitions/WC/matches?dateFrom=…&dateTo=today`
5. `today-matches` — `/matches?dateFrom=today&dateTo=today`
6. `live-matches` — live KV write (30s TTL)
7–12. `standings-{PL|PD|BL1|SA|FL1|CL|WC}` — one per competition

Tasks are guarded by RATE-SAFE mode (activated on 429/403) and minIntervalSec (30m for WC/standings).
