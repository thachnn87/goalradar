# DATA-18C.5 Phase 2 — Telemetry Retention Audit

**Audit date:** 2026-06-18  
**Source:** Code audit of `src/lib/authority-telemetry.ts` and `src/lib/health-archive.ts`

---

## 1. Authority Telemetry Archive

**Module:** `src/lib/authority-telemetry.ts`  
**Key pattern:** `goalradar:authority:telemetry:daily:YYYY-MM-DD` (Redis Hash)

### Retention

```typescript
const RETENTION_SEC = 30 * 24 * 3_600; // 30 days = 2,592,000 seconds
```

TTL is refreshed on **every write** (`kv.expire(key, RETENTION_SEC)`). A day with zero reads will retain until 30 days after the last read was recorded on that key.

### Pruning mechanism

Automatic via Redis TTL — no manual pruning required. When the last write to a day's key was 30+ days ago, Redis evicts it automatically.

### Storage growth

One hash key per calendar day. Each hash contains up to 9 fields:

| Field | Type | Max size |
|---|---|---|
| `primaryHits` | integer string | ~8 bytes |
| `drHits` | integer string | ~8 bytes |
| `coldRebuilds` | integer string | ~8 bytes |
| `totalReads` | integer string | ~8 bytes |
| `totalLatencyMs` | integer string | ~10 bytes |
| `latencyCount` | integer string | ~8 bytes |
| `lastPrimaryHitAt` | ISO-8601 string | 25 bytes |
| `lastDrHitAt` | ISO-8601 string | 25 bytes |
| `lastColdRebuildAt` | ISO-8601 string | 25 bytes |

Estimated per-key size: ~180 bytes raw data + Redis hash overhead (~200-300 bytes) ≈ **~500 bytes per day**.

30-day window: 30 × 500 bytes = **~15 KB total**. Negligible.

### Read pattern

`getAuthorityTelemetry()` reads 30 keys in parallel via `Promise.allSettled`. Failed reads degrade gracefully (null → empty DailyMetrics). No data loss risk from partial reads.

---

## 2. Health Archive

**Module:** `src/lib/health-archive.ts`  
**Key:** `goalradar:health:archive` (Redis Sorted Set, scored by epoch ms)

### Retention

```typescript
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
```

### Pruning mechanism

Active pruning on every write:
```typescript
const cutoff = rec.ts - RETENTION_MS;
const pruned = await kv.zremrangebyscore(HEALTH_ARCHIVE_KEY, 0, cutoff);
```

Records older than 30 days are removed atomically on each `appendHealthRecord()` call.

### Storage growth

Each `HealthArchiveRecord` contains: timestamps, 4 subsystem verdicts, 15 numeric fields, 3 string fields.  
Estimated JSON size per record: **~550-650 bytes**.

Health archive cron schedule: `every 15 minutes` (GitHub Actions `*/15`, throttled to ~1-2h effective).

| Scenario | Records/day | Growth/day |
|---|---|---|
| GitHub Actions throttled (~1h) | 24 | ~15 KB/day |
| GitHub Actions unthrottled (~15min) | 96 | ~60 KB/day |

30-day steady state:
- Throttled (1h): 720 records × 600 bytes = **~432 KB**
- Unthrottled (15min): 2880 records × 600 bytes = **~1.73 MB**

**Max 30-day ZSET size: ~2 MB.** Well within Vercel KV limits.

---

## 3. Incident Archive

**No incident archive exists in the codebase.** A search for `incident` in `src/lib/` and `src/app/api/` found no dedicated incident storage module. The health archive (`goalradar:health:archive`) serves as the primary audit trail for operational events.

---

## 4. Write Audit Record

**Key:** `goalradar:authority:last-write` (String)  
**TTL:** 10 days (`10 * 24 * 3_600 = 864,000 seconds`)

Contains one `AuthorityWriteRecord` JSON object. Single record (no accumulation), ~200 bytes. Overwritten on every orchestrator run.

If orchestrator stops running, this key expires after 10 days — providing a secondary signal that the cache subsystem has been inactive.

---

## 5. Summary

| Archive | Mechanism | Retention | Pruning | Max Size |
|---|---|---|---|---|
| Telemetry (daily hash) | Redis TTL | 30 days | Automatic (TTL expiry) | ~15 KB |
| Health archive (ZSET) | Active ZREMRANGEBYSCORE | 30 days | On every write | ~2 MB |
| Write audit record | Redis TTL | 10 days | Automatic (TTL expiry) | ~200 bytes |
| Primary cache | Redis TTL | 30–900s | Automatic (TTL expiry) | ~200 KB |
| DR cache | Redis TTL | 7 days | Automatic (TTL expiry) | ~200 KB |
| Match snapshots | Redis TTL | 900s | Automatic (TTL expiry) | ~1 KB each |

**All archives have bounded retention. No unbounded growth risk through WC2026.**

---

## 6. Retention Gaps / Risks

| Risk | Assessment |
|---|---|
| Telemetry key for day X evicted too early | Low: TTL refreshed on every write. Only at risk if 30+ days pass with zero reads on a specific past date. |
| Health archive ZSET exceeds KV limits | Low: bounded by pruning to 30 days. Max ~2 MB at 15min cadence. |
| Write record expires before orchestrator recovers | Low: 10-day TTL. Orchestrator gap >10 days would require DR TTL (7 days) to have already expired. |
| Data loss from KV eviction policy | Low: Vercel KV (Upstash) uses `noeviction` by default; keys are never evicted before TTL. |
