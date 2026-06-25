# WC_CACHE_ARCHITECTURE.md — Cache Architecture Audit
**Sprint:** DATA-18WC.12 | **Date:** 2026-06-25

## Cache Inventory

| Cache Name | KV Key Pattern | TTL (s) | Writer | Reader | Revalidation | Issues |
|---|---|---|---|---|---|---|
| Authority Cache | `goalradar:wc:authority:v1` | 30 (live) / 300 (today) / 900 (normal) | `writeAuthorityCache()` via orchestrator | `getWCAuthorityMatchesV2()` | Every orchestrator run (~30m); ISR on WC task ok | **OK** — functional, TTL-tiered correctly |
| Match Snapshot (primary) | `goalradar:match:{id}` | 900s | `prewarmWorldCup()` → snapshot write | `getMatchSnapshotCached()` | Orchestrator prewarm every 30m | **OK** |
| Match Snapshot (DR) | `goalradar:dr:match:{id}` | 30d | DR write in snapshot handler | snapshot read fallback | Manual purge only | **P0: match 537412 poisoned** — DR has FINISHED, actual is CANCELLED. Purge with `/api/debug/purge-match-snapshot?id=537412` |
| WC Standings | `goalradar:/competitions/WC/standings` | 7200s (2h) stale | `refreshEndpoint('/competitions/WC/standings')` via orchestrator | `getStandingsCached('WC')` → `readKVOnly()` | Orchestrator standings-wc task every 30m (if rate-safe inactive) | **BROKEN — key likely empty**. FD API standings endpoint may return restricted/error; on error refreshEndpoint does not write. All consumers fall back to zeroed static skeleton. |
| WC All Matches | `goalradar:/competitions/WC/matches` | 21600s (6h) | `refreshEndpoint('/competitions/WC/matches')` | `getWCKnockoutMatchesCached()` | Orchestrator wc-all-matches task | **OK** |
| WC Upcoming | `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` | 1800s (30m) | `refreshEndpoint(…?status=SCHEDULED,TIMED)` | Upcoming widget | Orchestrator wc-upcoming task | **OK** |
| WC Finished | `goalradar:/competitions/WC/matches?status=FINISHED` | 43200s (12h) | `refreshEndpoint(…?status=FINISHED)` | Results page | Orchestrator wc-finished task | **OK** |
| Live Matches | `goalradar:live:matches` | 30s | `refreshLiveMatches()` | `getCurrentLiveMatches()` | Every orchestrator run (not throttled) | **OK** |
| Today Matches | `goalradar:/matches?dateFrom=T&dateTo=T` | 120s | `refreshEndpoint(/matches?…)` | Cross-competition today feed | Orchestrator today-matches (55s min interval) | **OK** |
| Team Detail | `goalradar:/teams/{id}` | 86400s (24h) | `refreshEndpoint(/teams/{id})` | Team pages | Phase 4 of orchestrator (~6h min interval) | **OK** |
| ISR (Next.js) | Vercel CDN edge per-path | 30–3600s per page | Next.js on request | Browser | `revalidateWCPaths()` after successful WC tasks | **DIVERGENT** — Hub 30s vs Groups 3600s vs Bracket 900s; max divergence window = 3600s |

---

## Cache Poisoning

| Key | Poison Type | Severity | Fix |
|---|---|---|---|
| `goalradar:dr:match:537412` | Status=FINISHED for CANCELLED match (30d TTL, won't auto-expire soon) | **P0** | Call `GET /api/debug/purge-match-snapshot?id=537412&secret=<CRON_SECRET>` |

---

## Stale Caches

| Cache | Staleness Issue |
|---|---|
| `/competitions/WC/standings` | Likely empty — has not been populated since standings data became unavailable. Static fallback (all zeros) served to all consumers. |
| ISR HTML for groups pages | 1-hour TTL means after tonight's group closures, group standings pages won't update for up to 1 hour |

---

## Cache Not Invalidated

| Cache | Issue |
|---|---|
| DR match snapshots | 30-day TTL, no automatic invalidation. A poisoned DR key survives 30 days. Only manual `/api/debug/purge-match-snapshot` purges it. |
| ISR HTML | No on-demand revalidation for individual team pages when match state changes. `revalidateWCPaths()` triggers on WC task success but only covers configured paths. |
