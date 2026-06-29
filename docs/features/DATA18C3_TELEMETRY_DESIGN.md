# DATA-18C.3 — Authority Cache Telemetry Design

**Phase 1 artifact.** Documents metric capture points, key schema, aggregation logic, and SLO definitions for the authority cache telemetry system added by commit `6e93402`.

---

## 1. Objective

Provide measurable SLO evidence for the authority cache subsystem so that DATA-18B listing-page migration can be gated on quantitative readiness (not just visual inspection). Every `readAuthorityCache()` call is measured and persisted without changing any cache decision logic.

---

## 2. Read-Path Instrumentation

### Source: `src/lib/authority-cache.ts` → `readAuthorityCache()`

Three return points, each now calls `recordAuthorityRead(path, latencyMs, timestamp)`:

| Return point | Path | Condition |
|---|---|---|
| Primary KV hit | `'primary'` | `kv.get(AUTHORITY_KEY)` returns a valid envelope |
| DR KV hit | `'dr'` | Primary absent; `kv.get(AUTHORITY_DR_KEY)` returns a valid envelope |
| Cold rebuild | `'cold'` | Both KV keys absent or KV disabled |

`latencyMs` is computed as `Date.now() - _readStart` at entry. `timestamp` is the `builtAt` string already available as the caller-supplied argument. These two values ensure `recordAuthorityRead` never needs to call `Date.now()` itself (stateless measurement).

**Invariant preserved**: `recordAuthorityRead` is fire-and-forget (`void` return). `readAuthorityCache` does not `await` it and its Promise rejection is caught internally. No latency added to the hot path.

---

## 3. Telemetry Storage

### Module: `src/lib/authority-telemetry.ts`

#### Key schema

```
goalradar:authority:telemetry:daily:YYYY-MM-DD   (Redis Hash)
```

One key per calendar day (UTC). Date derived from `timestamp.split('T')[0]`.

#### Hash fields

| Field | Type | Written by |
|---|---|---|
| `primaryHits` | integer counter | HINCRBY +1 on primary hit |
| `drHits` | integer counter | HINCRBY +1 on DR hit |
| `coldRebuilds` | integer counter | HINCRBY +1 on cold rebuild |
| `totalReads` | integer counter | HINCRBY +1 on every read |
| `totalLatencyMs` | integer sum | HINCRBY +latencyMs on every read |
| `latencyCount` | integer counter | HINCRBY +1 on every read |
| `lastPrimaryHitAt` | ISO-8601 string | HSET on primary hit |
| `lastDrHitAt` | ISO-8601 string | HSET on DR hit |
| `lastColdRebuildAt` | ISO-8601 string | HSET on cold rebuild |

#### Write strategy

`Promise.all([hincrby × 4, hset × 1, expire × 1])` — all atomic Redis commands dispatched in parallel. `.catch()` swallows errors; never throws to caller.

#### Retention

TTL = 30 days (2,592,000 s). Re-set on every write, so active days stay alive.

---

## 4. Aggregation Logic

`getAuthorityTelemetry()` fetches 30 daily hash keys in parallel (`Promise.allSettled`), then aggregates:

- **`today`**: `daily[0]` — current UTC day raw record
- **`last7d`**: `aggregate(daily.slice(0, 7))` — rolling 7-day sum
- **`last30d`**: `aggregate(daily)` — rolling 30-day sum

`aggregate()` sums raw counters across days, then derives ratios:

```
availability     = (primaryHits + drHits) / totalReads × 100
primaryHitRatio  = primaryHits / totalReads × 100
drHitRatio       = drHits / totalReads × 100
coldRebuildRatio = coldRebuilds / totalReads × 100
avgLatencyMs     = totalLatencyMs / latencyCount
```

Empty days (no KV record) contribute zero to all counters and don't distort averages. `availability` defaults to 100% on zero-read days (no evidence of degradation).

---

## 5. SLO Definitions

Defined in `src/app/api/debug/authority-slo/route.ts`:

| SLO | Target | Direction | WARN zone |
|---|---|---|---|
| Availability | ≥ 99.9% | `>=` | 89.9%–99.9% |
| Cold rebuild rate | ≤ 1.0% | `<=` | 1.0%–1.1% |
| DR usage rate | ≤ 20.0% | `<=` | 20.0%–22.0% |

WARN threshold = 10% slack from target (e.g. 99.9 × 0.9 = 89.9 for availability).

Evaluated across three windows: 24h (today), 7d, 30d. Per-SLO verdict: `PASS | WARN | FAIL | NO_DATA`. Overall window verdict: `FAIL` if any FAIL, `WARN` if any WARN, `PASS` if all PASS.

---

## 6. Readiness Scoring

`/api/debug/authority-readiness` produces a 0–100 score and `READY / PILOT_READY / NOT_READY` verdict.

| Dimension | Points | Condition |
|---|---|---|
| Cache active | 30 | Primary or DR present in KV |
| DR functioning | 20 | DR key present |
| Cold rebuild free | 0–25 | 0 cold rebuilds=25, <1%=20, <5%=10, ≥5%=0; no data=20 |
| Telemetry coverage | 15 | At least 1 read recorded in 30d |
| Write record present | 10 | `goalradar:authority:last-write` key exists |

**READY** = score ≥ 85 AND no SLO FAIL  
**PILOT_READY** = score ≥ 60 OR (cacheActive AND coldRebuildRatio = 0)  
**NOT_READY** = otherwise or any explicit blocker

---

## 7. Debug Endpoints

All three endpoints: auth via `CRON_SECRET` Bearer token or `?secret=`.

| Endpoint | Purpose |
|---|---|
| `GET /api/debug/authority-telemetry` | Raw hit/miss counters + GREEN/YELLOW/RED verdict |
| `GET /api/debug/authority-slo` | PASS/WARN/FAIL per SLO × window |
| `GET /api/debug/authority-readiness` | Scored migration gate for DATA-18B |

---

## 8. What Is NOT Changed

Per DATA-18C.3 constraints — none of the following were modified:

- `CanonicalMatch` type
- `buildAllCanonicalMatches()`
- `writeAuthorityCache()` cache contents or TTL
- `readAuthorityCache()` decision logic (fallback chain unchanged)
- Snapshot generation or enrichment
- World Cup pages
- DATA-18B migration code
- Reliability intelligence framework
