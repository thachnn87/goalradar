# DATA-18H Phase 1 — Health Archive Layer

Date: 2026-06-17

---

## Purpose

Move from point-in-time monitoring (DATA-18G) to a persisted evidence trail.
Every health snapshot is recorded so reliability can be **proven** over 24h /
7d / 30d windows, not merely observed in the moment.

No changes to Authority Cache, CanonicalMatch, snapshot generation, AF/ESPN
enrichment, or listing page logic. Archive layer only.

---

## Storage model

| Property | Value |
|----------|-------|
| KV key | `goalradar:health:archive` |
| Type | Redis sorted set (ZSET) |
| Score | epoch milliseconds (`ts`) |
| Member | JSON-serialised `HealthArchiveRecord` |
| Retention | 30 days (pruned on every write via `zremrangebyscore`) |

Sorted-set scoring by timestamp gives O(log N) range reads for any window
(`zrange ... byScore`) and self-pruning without a separate sweep job.

---

## Record schema (`HealthArchiveRecord`)

```ts
{
  ts:          number;   // epoch ms (ZSET score)
  capturedAt:  string;   // ISO
  overall:     'GREEN' | 'YELLOW' | 'RED';
  worldcupHealth: SubsystemVerdict;
  drift:      { verdict, total, green, yellow, red };
  feed:       { verdict, redCount, yellowCount };
  freshness:  { verdict, source, ageSec, stale };
  enrichment: { verdict, totalFinished, unenriched, rate /* 0..1 */ };
}
```

All fields are flat scalars so a window can be reduced (SLO %, incident runs)
without re-fetching the source endpoints.

---

## Capture path

`GET /api/cron/health-archive`

1. Fetch 4 subsystems in parallel (own API, base URL derived from request):
   - `/api/debug/authority-drift`
   - `/api/debug/feed-integrity`
   - `/api/debug/authority-freshness`
   - `/api/debug/enrichment-health`
2. Normalise each verdict (`PASS→GREEN`, `WARN→YELLOW`, `FAIL→RED`, else `ERROR`).
3. Compute `overall` (RED if any RED/ERROR, else YELLOW if any YELLOW, else GREEN).
4. `appendHealthRecord()` → `zadd` + prune older than 30 days.
5. Structured log: `[HealthArchive] captured overall=… pruned=…`.

Returns `{ capturedAt, overall, record, pruned }`.

---

## Schedule

| Path | Recommended schedule | Why |
|------|---------------------|-----|
| `/api/cron/health-archive` | every 15 min | Matches Authority Freshness SLO granularity (<15 min). 96 records/day → ~2,880/30d. |

Wire in the Vercel dashboard (or external scheduler) alongside the existing
crons (`orchestrator`, `repair-enrichment`, `drift-scan`). Auth via
`CRON_SECRET`.

> A 15-min cadence yields ~2.9k ZSET members at steady state — negligible for
> Vercel KV. Hourly is acceptable if cron slots are constrained, at the cost of
> coarser incident-duration resolution.

---

## Read API

`readHealthRecords(sinceMs, nowMs)` → `HealthArchiveRecord[]` (oldest → newest).
Handles both string members and KV auto-deserialised objects; skips corrupt
members defensively.

Consumers:
- `/api/debug/incident-history` (Phase 2)
- `/api/debug/slo-compliance` (Phase 3)
- `/api/debug/reliability` (Phase 4)

---

## Guarantees & non-goals

- **Append-only, self-pruning** — no unbounded growth, no manual cleanup.
- **No remediation** — the archive records, it never acts.
- **Empty-archive safe** — all consumers treat zero records as 100% / no
  incidents, so endpoints are usable from the first deploy.
- **Degraded-capture safe** — if a subsystem fetch fails, its verdict is
  `ERROR` and the record still persists (counted against SLO, never dropped).
