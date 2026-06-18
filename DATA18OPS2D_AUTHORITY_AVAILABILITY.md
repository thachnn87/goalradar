# DATA-18OPS.2D — Authority Cache Availability Audit

Date: 2026-06-18  
Audit window: 09:47–09:53 UTC  
Constraint: read-only, no code changes, no deployments, production evidence only

---

## Executive Summary

The Authority Cache (`goalradar:wc:authority:v1` and `goalradar:dr:wc:authority:v1`) has
**never been written** in production. Both keys are permanently absent. The write path
(`writeAuthorityCache()`) is a dormant function with zero callers — it requires
`AUTHORITY_CACHE_ENABLED=true` and explicit wiring into the orchestrator cron, neither
of which has been done (DATA-18C not yet activated).

**Operational uptime: 0%** (primary) / **0%** (DR). `authority-freshness` is permanently
RED. This is a known planned state — the cache was designed to remain dormant until
DATA-18C is fully activated.

**World Cup 2026 risk:** If DATA-18B (match listing page reads from authority cache) is
activated before DATA-18C (cache writes), every match listing page load will trigger an
expensive cold rebuild that evaporates immediately, with no warm-up benefit.

---

## Phase 1 — KV State Inspection

### Production evidence — 2026-06-18T09:47:19 UTC

```
GET /api/debug/authority-freshness
Authorization: Bearer ***

{
  "checkedAt":  "2026-06-18T09:47:19.467Z",
  "source":     "absent",
  "builtAt":    null,
  "ageSec":     null,
  "ttlTier":    null,
  "ttlSec":     null,
  "stale":      true,
  "matchCount": 0,
  "liveCount":  0,
  "drPresent":  false,
  "verdict":    "RED",
  "note":       "Authority cache absent from KV — cold rebuild will serve on demand. Non-critical; warm via orchestrator cron."
}
```

**Note on the endpoint's own note:** The inline note says "warm via orchestrator cron."
This is **incorrect** — the orchestrator does NOT call `writeAuthorityCache()` (see Phase 4).
The note was written in anticipation of DATA-18C activation, not current behavior.

### Follow-up confirmation — 2026-06-18T09:52:33 UTC

```
GET /api/debug/authority-freshness (response: 523 ms)

{
  "checkedAt":  "2026-06-18T09:52:33.411Z",
  "source":     "absent",
  "builtAt":    null,
  "ageSec":     null,
  "ttlTier":    null,
  "ttlSec":     null,
  "stale":      true,
  "matchCount": 0,
  "liveCount":  0,
  "drPresent":  false,
  "verdict":    "RED"
}
```

State unchanged 5 minutes after the orchestrator ran at 09:34 UTC. The orchestrator run
made no difference to the authority cache — confirming it does not call `writeAuthorityCache()`.

### KV key state matrix

| Key | Value | Last written | TTL tier |
|-----|-------|-------------|---------|
| `goalradar:wc:authority:v1` | ABSENT | Never | — |
| `goalradar:dr:wc:authority:v1` | ABSENT | Never | — |

---

## Phase 2 — `readAuthorityCache()` Code Path Analysis

`src/lib/authority-cache.ts` — code path when both primary and DR keys are absent:

```
readAuthorityCache(builtAt)
  │
  ├─ kv.get(AUTHORITY_KEY)         → null (primary absent)
  │
  ├─ kv.get(AUTHORITY_DR_KEY)      → null (DR absent)
  │
  └─ coldRebuild(builtAt)          ← ALWAYS EXECUTES
       │
       ├─ single-flight guard (_rebuildInflight)
       ├─ reads KV: FINISHED feed, per-match snapshots × N, ESPN ID map
       ├─ builds CanonicalMatch[] in memory
       │
       └─ returns matches          ← does NOT write to KV
```

**Critical**: `coldRebuild()` reads all required KV data (FD feeds + per-match snapshots)
to build the authority array in memory, then **returns without writing to KV**. The result
evaporates when the serverless function returns. Every subsequent call to `readAuthorityCache()`
when both keys are absent will trigger another full cold rebuild.

### Callers of `readAuthorityCache()`

| Caller | Purpose | Frequency |
|--------|---------|-----------|
| `src/app/api/debug/authority-drift/route.ts` | Debug drift check | On demand |
| `src/app/api/cron/drift-scan/route.ts` | Daily drift scan | Once/day (04:30 UTC) |
| `src/lib/api.ts` (DATA-18B path) | Match listing pages | **DORMANT** — not yet activated |

The match listing page path is currently dormant. When DATA-18B is activated, every
match listing page request when the cache is absent will trigger a cold rebuild.

### Callers of `writeAuthorityCache()`

**Zero callers.** Grep confirmed:

```
$ grep -r "writeAuthorityCache" src/
src/lib/authority-cache.ts:86:   lastWriteMs   // (definition only)
src/lib/authority-cache.ts:361: export async function writeAuthorityCache(...)  ← definition
```

No import of `writeAuthorityCache` exists in any route, lib, or cron file.

---

## Phase 3 — Production Evidence: Three Cache States

### State A — ABSENT (observed)

**Evidence:** Both production queries above. `source: "absent"`, `drPresent: false`,
`verdict: "RED"`. Confirmed at 09:47 and 09:52 UTC, confirmed across all timestamps
from DATA-18OPS.2C (09:32–09:35 UTC), confirmed from earlier sessions.

**Frequency:** 100% of observations. This is the only state ever observed in production.

### State B — COLD REBUILD (demonstrated)

**Evidence:** `GET /api/debug/authority-drift` at 09:52:33 UTC (response: 1149ms):

```json
{
  "checkedAt": "2026-06-18T09:52:33.921Z",
  "total": 24,
  "green": 23,
  "yellow": 1,
  "red": 0,
  "verdict": "YELLOW"
}
```

authority-drift calls `readAuthorityCache()` which, finding both keys absent, performed
a cold rebuild. The rebuild served 24 finished WC matches successfully (23 green, 1 yellow
on lineup-missing only). Round-trip including cold rebuild: **1149ms**.

Baseline KV-only call (authority-freshness, no rebuild): **523ms**.

**Cold rebuild overhead for 24 matches: ~626ms additional latency.**

As WC 2026 progresses to 64 total matches, this overhead will increase proportionally
since coldRebuild reads N per-match snapshots.

### State C — PRESENT (never observed)

This state requires `writeAuthorityCache()` to have been called. Since no caller exists,
the primary and DR KV keys have never been populated in any production deployment.
This state **cannot be observed** under the current codebase without code changes.

---

## Phase 4 — Root Cause of `authority-freshness = RED`

### Cause: `writeAuthorityCache()` is permanently dormant

The file header of `src/lib/authority-cache.ts` documents this explicitly:

```typescript
/**
 * DORMANT until DATA-18C sets AUTHORITY_CACHE_ENABLED=true
 * and wires writeAuthorityCache() into the cron.
 */
```

### Why `authority-freshness` has been RED since initial deployment

1. **Write path not activated.** `writeAuthorityCache()` has zero callers. The function
   exists in `authority-cache.ts` but is never imported or called by any route, cron,
   or library module.

2. **DATA-18C activation incomplete.** DATA-18C requires:
   - Setting `AUTHORITY_CACHE_ENABLED=true` in the production environment
   - Adding a `writeAuthorityCache(builtAt)` call to the orchestrator cron (after the
     prewarm step)
   
   Neither has been done. The orchestrator at `src/app/api/cron/orchestrator/route.ts`
   calls `prewarmWorldCup()` and `refreshEndpoint()` tasks but does NOT call
   `writeAuthorityCache()`.

3. **Orchestrator prewarm does not write authority cache.** `prewarmWorldCup()` in
   `src/lib/prewarm/worldcup.ts` writes per-match keys (`goalradar:/matches/{id}`,
   `goalradar:match:{id}`, etc.) but does NOT write `goalradar:wc:authority:v1` or
   `goalradar:dr:wc:authority:v1`.

4. **No other write path exists.** No debug endpoint, no on-demand route, and no
   background job writes the authority cache keys.

### Root cause classification

| Hypothesis | Verdict | Evidence |
|-----------|---------|---------|
| TTL expiry | ❌ RULED OUT | Keys are ABSENT not stale — they were never set |
| Scheduler gap | ❌ RULED OUT | No scheduler calls writeAuthorityCache() to expire from |
| Cache eviction | ❌ RULED OUT | Cannot evict a key that was never written |
| Rebuild failure | ❌ RULED OUT | coldRebuild() succeeds (authority-drift: 23/24 green) — it just doesn't persist |
| **Write path dormant** | ✅ **CONFIRMED ROOT CAUSE** | writeAuthorityCache() has zero callers; DATA-18C not activated |

---

## Phase 5 — Operational Assessment

### Uptime estimate

| Metric | Value |
|--------|-------|
| Primary key (`goalradar:wc:authority:v1`) uptime | **0%** |
| DR key (`goalradar:dr:wc:authority:v1`) uptime | **0%** |
| `authority-freshness` GREEN observations | **0 / 0** |
| `authority-freshness` RED observations | **all** |
| Days since deployment with absent cache | Entire deployment lifetime |

### Absent frequency

The authority cache is absent **100% of the time**. It has never been present.

### Cold rebuild frequency

| Trigger | Cadence | Rebuilds/day |
|---------|---------|-------------|
| drift-scan cron | Once daily at 04:30 UTC | 1 |
| Debug calls to authority-drift | On demand | Variable |
| DATA-18B listing pages (dormant) | Per page request when activated | High |

### Current operational impact (DATA-18B dormant)

**Low.** While the authority cache is permanently absent, the impact is contained:
- Match listing pages still use the legacy data path — they do not call
  `readAuthorityCache()` (DATA-18B is dormant).
- drift-scan is the only scheduled process that triggers cold rebuild (once/day).
- Cold rebuild takes ~626ms additional latency but only occurs on drift-scan and
  debug calls, not on user-facing page requests.

### World Cup 2026 risk (if DATA-18B activated without DATA-18C)

**HIGH.** If DATA-18B (match listing pages read from authority cache) is activated
before DATA-18C (writeAuthorityCache wired into orchestrator), the degraded state
becomes user-visible:

- Every match listing page request (groups, knockout bracket, standings) when
  the authority cache is absent will trigger a cold rebuild.
- With 64 total WC matches, cold rebuild reads ~64+ KV entries (FD feeds +
  per-match snapshots). Estimated latency: 1–3 seconds added to every listing page.
- The rebuild result evaporates after the serverless function returns —
  no warm-up benefit for subsequent requests.
- The orchestrator refreshes every ~1–2h (GitHub Actions cadence). Without
  `writeAuthorityCache()`, the refresh does not populate the authority cache.
  Every page request in the inter-run window triggers a cold rebuild.

| Scenario | Risk | Impact |
|----------|------|--------|
| DATA-18B OFF, DATA-18C OFF (current) | LOW | debug/cron cold rebuilds only |
| DATA-18B ON, DATA-18C OFF | HIGH | every listing page = cold rebuild + no KV warmth |
| DATA-18B ON, DATA-18C ON | LOW | authority cache warmed every ~1-2h by orchestrator |

### Recommendation

**Activate DATA-18C before DATA-18B.** Specifically:

1. **Add `writeAuthorityCache()` call to the orchestrator cron** (after `prewarmWorldCup()`
   and before `savePrewarmRecord()`). This is the wiring step required by the DATA-18C spec.

2. **Set `AUTHORITY_CACHE_ENABLED=true`** in the production Vercel environment.

3. **Verify** the authority cache is populated after the next orchestrator run using
   `GET /api/debug/authority-freshness` — `source` should change from `absent` to
   `primary` and `verdict` from `RED` to `GREEN`.

4. Only then activate DATA-18B (switch listing pages to read from authority cache).

Do not activate DATA-18B independently. The current order gate (DATA-18C → DATA-18B)
is the correct dependency ordering and should be maintained.

---

## Audit Summary

| Phase | Finding |
|-------|---------|
| Phase 1 — KV state | Both primary and DR keys ABSENT. `drPresent: false` confirmed at 09:47 and 09:52 UTC. |
| Phase 2 — read path | primary → DR → cold rebuild. Cold rebuild fires on every call when both keys absent. Does not write back to KV. |
| Phase 3 — state evidence | ABSENT: confirmed. COLD REBUILD: demonstrated (authority-drift, ~626ms overhead, 24 matches). PRESENT: never observed. |
| Phase 4 — root cause | `writeAuthorityCache()` has zero callers. DATA-18C not yet activated. NOT caused by TTL, scheduler gap, eviction, or rebuild failure. |
| Phase 5 — risk | Current impact LOW (DATA-18B dormant). WC 2026 risk HIGH if DATA-18B activated before DATA-18C. Recommendation: activate DATA-18C first. |
