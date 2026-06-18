# DATA-18C.2 Burn-In Metrics

Date: 2026-06-18  
Observation window: 10:10–11:18 UTC  
Orchestrator cycles observed: 2 (Cycle 1 manual activation + Cycle 2 restoration)

---

## Orchestrator Cycles

| Field | Cycle 1 | Cycle 2 |
|-------|---------|---------|
| Triggered at | 10:10:29 UTC | 11:17:18 UTC |
| Trigger | Manual (DATA-18C.1 activation) | Manual (DR restore) |
| ok / skipped / failed | 2 / 11 / 0 | 13 / 0 / 0 |
| elapsed | 10237ms | 84558ms |
| authorityCache.builtAt | 2026-06-18T10:10:29.853Z | 2026-06-18T11:17:18.299Z |
| authorityCache.matchCount | 104 | 104 |
| authorityCache.liveCount | 0 | 0 |
| authorityCache.ttlTier | today | today |
| authorityCache.ttlSec | 300 | 300 |

**Cycle 1 note:** `skipped=11` — PERF-6 skip-if-fresh guards were active (data < 30min
old). The orchestrator had run recently so most tasks hit the freshness window. Only 2
tasks (which had expired their guard) actually refreshed. prewarmWorldCup() was still
called and ran to completion.

**Cycle 2 note:** `skipped=0` — all 13 tasks refreshed. Data had aged past the PERF-6
freshness window (~30 min) in the 67-minute gap since Cycle 1.

---

## Authority-Freshness Timeline

| Timestamp (UTC) | source | ageSec | ttlTier | stale | drPresent | verdict |
|----------------|--------|--------|---------|-------|-----------|---------|
| 10:10:42 | primary | 13 | today | false | true | **GREEN** |
| 10:11:58 | primary | 89 | today | false | true | **GREEN** |
| 11:12:59 | dr | 3750 | today | true | true | RED |
| 11:17:32 | primary | 14 | today | false | true | **GREEN** |
| 11:18:21 | primary | 64 | today | false | true | **GREEN** |

### Phase transitions observed

| Event | Time (UTC) | Notes |
|-------|-----------|-------|
| Cycle 1 write | 10:10:29 | primary TTL = 300s |
| Primary expires | ~10:15:29 | primary key evicted by KV after TTL |
| DR takes over | ~10:15:29 | source transitions from primary → dr |
| DR goes stale | ~10:22:59 | ageSec > 450s (300s × 1.5 stale threshold) |
| authority-freshness → RED | ~10:22:59 | expected per TTL design |
| Cycle 2 write | 11:17:18 | primary + DR both refreshed |
| Primary restored | 11:17:32 | source = primary, verdict GREEN |

### TTL tier behavior summary

`ttlTier=today` applies when any WC match is scheduled today UTC. This tier uses
`ttlSec=300` (5 min), which is intended for near-real-time data during match days.

Expected `authority-freshness` GREEN availability at ~1-2h GitHub Actions cadence:
- Primary GREEN window: 0–300s (~8% per 1h cycle)
- DR GREEN window: 300–450s (extending primary window to 450s = ~12% per 1h cycle)
- DR stale (RED): 450s onwards until next orchestrator run

`readAuthorityCache()` (what calling code uses) always returns data from DR for up
to 7 days — the RED verdict in authority-freshness reflects data age, not absence.
Cold rebuild occurs only if both primary and DR are absent (>7 days without orchestrator).

---

## Write Audit Record

`goalradar:authority:last-write` confirmed updated between cycles:

| Cycle | builtAt observed (from orchestrator response) | matchCount | source |
|-------|----------------------------------------------|-----------|--------|
| 1 | 2026-06-18T10:10:29.853Z | 104 | cron:orchestrator |
| 2 | 2026-06-18T11:17:18.299Z | 104 | cron:orchestrator |

Both writes succeeded — `authorityCache` field appeared in orchestrator JSON response
(rather than `{ error: 'write failed' }` or `{ skipped }` fallback).

---

## KV State (data18d-stability — Cycle 2)

```json
{
  "cacheState": {
    "primaryPresent":    true,
    "primaryBuiltAt":    "2026-06-18T11:17:18.299Z",
    "primaryAgeMin":     1,
    "primaryMatchCount": 104,
    "primaryLiveCount":  0,
    "primaryTtlTier":    "today",
    "drPresent":         true,
    "drBuiltAt":         "2026-06-18T11:17:18.299Z",
    "drAgeHours":        0
  }
}
```

Both primary and DR keys present and consistent (`drBuiltAt` matches `primaryBuiltAt`).

Note: `telemetry: { hits: 0, coldRebuilds: 0, writeCount: 0 }` — in-memory counters
always show 0 from `data18d-stability` because each invocation gets a fresh serverless
function instance. This is expected and documented — use KV audit record for persistence.

---

## Burn-In Assessment

| Criterion | Result |
|-----------|:------:|
| authority-freshness stable (no unexpected RED) | ✅ RED is expected between cycles per TTL design |
| authority:last-write updates every cycle | ✅ builtAt advanced 67 min between cycles |
| matchCount stable at 104 | ✅ consistent across both cycles |
| liveCount correct (no live matches during burn-in) | ✅ liveCount=0 both cycles |
| ttlTier correct for today UTC | ✅ today tier applied correctly |
