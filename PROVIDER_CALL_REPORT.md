# Provider Call Report — PERF-6 Phase 2
## GoalRadar · Sprint PERF-6

Generated: 2026-06-10

---

## Runtime Instrumentation Added

PERF-6 enhances the logging in `src/lib/refresh.ts` and `src/lib/providers/football-data.ts`
to capture every provider call with full context.

---

## New Log Lines (after PERF-6)

### `src/lib/refresh.ts` — refreshEndpoint()

```
[Refresh] SKIP-FRESH /competitions/WC/matches | age=412s < minInterval=1800s | caller=cron/orchestrator
[Refresh] START /competitions/WC/standings | caller=cron/orchestrator | minInterval=1800s
[Refresh] OK    /competitions/WC/standings | fresh 3600s | stale 7200s | caller=cron/orchestrator | 1243ms
[Refresh] SKIP  /competitions/WC/standings | rate-safe active | caller=cron/orchestrator
```

### `src/lib/providers/football-data.ts` — fetchRaw()

```
[FD] CIRCUIT-OPEN — rate-safe active, discarding /competitions/WC/matches call
[FD] TIMEOUT /matches/12345 (attempt 2/2): 10s exceeded
[RATE_SAFE] MODE ENABLED | reason=timeout | retryAfterMs=900000 | expiresAt=...
```

### `src/lib/match-snapshot.ts` — getOrBuildMatchSnapshot()

```
[Snapshot] LOCK-MISS match:12345 — another instance building, waiting 3s
[Snapshot] LOCK-MISS match:12345 — found snapshot after wait
[Snapshot] KV-LOCK match:12345 — acquired build lock
```

---

## Key Metrics to Watch

Monitor these log patterns in Vercel function logs to track queue health:

| Log Pattern | What it means | Target |
|-------------|---------------|--------|
| `[QUEUE] football-data \| depth=N` | N-1 calls waiting in queue | depth ≤ 1 |
| `[Refresh] SKIP-FRESH` | Skip-if-fresh guard fired | Most orchestrator tasks should show this |
| `[Refresh] START` | Actual provider call initiated | ≤ 3 per cron run |
| `[RATE_SAFE] MODE ENABLED` | Circuit opened | Should only appear on 429/403/timeout |
| `[Snapshot] LOCK-MISS` | Cross-instance snapshot coalescing | Rare |

---

## Provider Calls Per Hour (Before vs After PERF-6)

| Source | Before | After |
|--------|--------|-------|
| Orchestrator (30min cron = 2/h) | 13 × 2 = **26/h** | ~2/h (only stale tasks) |
| prewarmWorldCup (with orchestrator) | 0–4 × 2 = **0–8/h** | 0–4/h (priority matches) |
| Sitemap generation (est. 2/h Googlebot) | 20 × 2 = **40/h** | **0/h** (KV-only) |
| Snapshot builds (page-render) | **0/h** (PERF-4.5) | **0/h** |
| Snapshot builds (KV miss) | 2–5 per miss | 0–1 (global lock) |
| **Total** | **66–74/h** | **~2–6/h** |

Reduction: **>91%**

---

## Logging Added in PERF-6

Changes to `refreshEndpoint()`:
1. Logs `caller` on every START and SKIP-FRESH line
2. Logs `minInterval` when skip guard fires
3. Logs `queue depth` via `footballDataLimiter.getSnapshot().queuedRequests` at task start

Changes to `fetchRaw()` in `football-data.ts`:
1. Checks `isRateSafeModeActive()` at entry — logs `[FD] CIRCUIT-OPEN` and returns without queuing
2. On final-attempt timeout: calls `enableRateSafeMode('timeout', TIMEOUT_CB_MS)` and logs

Changes to `getOrBuildMatchSnapshot()`:
1. Logs `[Snapshot] KV-LOCK` when lock acquired
2. Logs `[Snapshot] LOCK-MISS` when another instance holds lock
