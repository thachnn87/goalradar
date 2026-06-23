# WC_STANDINGS_SOURCE_MAP — DATA-18WC.4

**Date:** 2026-06-23

---

## Pages that display WC standings

| Page | Route | Function | Cache key | Provider |
|------|-------|----------|-----------|---------|
| WC Standings | `/world-cup-2026-standings` | `getStandingsCached('WC')` | `goalradar:/competitions/WC/standings` | football-data.org → KV |
| WC Hub | `/world-cup-2026` (§ groups) | `getStandingsCached('WC')` | same | same |
| WC Groups | `/world-cup-2026/groups` | `getStandingsCached('WC')` | same | same |
| WC Groups (legacy) | `/world-cup-2026-groups` | `getStandingsCached('WC')` | same | same |
| Group detail | `/world-cup-2026/[group]` | `getStandingsCached('WC')` | same | same |
| Competition page | `/competition/WC` | `getStandingsCached('WC')` (aliased) | same | same |

All six routes go through a single function → single KV key → single provider.

---

## Data flow

```
football-data.org /v4/competitions/WC/standings
       ↓  (cron orchestrator, 30-min minimum interval)
refreshEndpoint('/competitions/WC/standings', freshSec=3600, staleSec=7200)
       ↓  writes KVEntry<standings>
KV key: goalradar:/competitions/WC/standings
       ↓  readKVOnly() in getStandingsCached
getStandingsCached('WC')
       ↓  merge with static skeleton
pages
```

---

## getStandingsCached merge logic

```
KV hit →
  liveByGroup = Map<normalizedGroupKey, StandingTable>   ← DATA-18WC.4 fix
  staticTables = getStaticWCGroupTables()                ← 12 groups, P=0
  merged[] = staticTables.map(s =>
    liveByGroup.get(s.group) ?? s                        ← live overrides static
  )
  nonTotal = KV standings not of type TOTAL
  return { merged + nonTotal, competition }

KV miss →
  return { getStaticWCGroupTables(), wcMeta }            ← all P=0
```

---

## Static fallback: getStaticWCGroupTables()

File: `src/lib/wc-static-groups.ts`

Generates 12 `StandingTable` entries (one per group A–L) from `WC_ALL_TEAMS`.
Group keys: `"GROUP_A"` through `"GROUP_L"` plus `"GROUP_TBD"`.
All stats zeroed: P=0, W=0, D=0, L=0, GF=0, GA=0, GD=0, PTS=0.

Shown when:
- KV miss (orchestrator never ran, or ran and failed)
- **[BUG prior to fix]** Group key mismatch — live data present but merge map lookup always missed

---

## Orchestrator refresh schedule

| Setting | Value |
|---------|-------|
| Task label | `standings-wc` |
| Phase | Phase 3 (among 7 competition standings) |
| freshSec (KV TTL) | 3600 s (1 h) |
| staleSec (KV TTL) | 7200 s (2 h) |
| minIntervalSec | 1800 s (30 min) |
| Cron fire rate | every 30 min |

---

## KV key schema

```json
{
  "data": {
    "standings": [ { "stage": "ALL", "type": "TOTAL", "group": "Group A", "table": [...] } ],
    "competition": { "name": "FIFA World Cup", "emblem": "..." }
  },
  "fetchedAt":  1750661425816,
  "freshUntil": 1750665025816
}
```

Note: `group` in the API response is `"Group A"` format; all callers now receive the
normalised `"GROUP_A"` format after the DATA-18WC.4 fix in `getStandingsCached`.
