# Cron Optimisation Report — PERF-6 Phase 3
## GoalRadar · Sprint PERF-6

Generated: 2026-06-10

---

## Problem

`refreshEndpoint()` previously called the provider unconditionally on every
invocation, regardless of how recently the KV entry was written.

With the cron running every 30 minutes and 13 tasks per run:
- **26 provider calls/hour** for non-live data
- Queue depth peaks at 13 during every run
- WC fixtures data refreshed every 30 min despite a 6-hour freshness window

---

## Fix: Skip-if-Fresh Guard

**File:** `src/lib/refresh.ts` — `refreshEndpoint()`

New optional parameter `options.minIntervalSec`: before calling the provider,
check the existing KV entry's `fetchedAt` timestamp. If the data is younger
than `minIntervalSec` seconds, log a `SKIP-FRESH` line and return immediately.

```typescript
// New signature:
refreshEndpoint(
  endpoint:  string,
  freshSec:  number,
  staleSec:  number,
  options?:  { minIntervalSec?: number; caller?: string },
)
```

---

## Per-Task Intervals (PERF-6)

| Task | Endpoint | freshSec | minIntervalSec | Rationale |
|------|----------|----------|----------------|-----------|
| wc-all-matches | `/competitions/WC/matches` | 21600 (6h) | **1800 (30min)** | Match list changes at most every 30min during WC |
| wc-upcoming | `/competitions/WC/matches?status=SCHEDULED,TIMED` | 900 | **1800 (30min)** | Scheduled fixtures don't change more than 30min apart |
| wc-finished | `/competitions/WC/matches?status=FINISHED` | 900 | **1800 (30min)** | FINISHED results are immutable after ~1h post-match |
| wc-recent | `/competitions/WC/matches?dateFrom=…&dateTo=…` | 900 | **1800 (30min)** | Recent results stable between cron windows |
| today-matches | `/matches?dateFrom=…&dateTo=…` | 60 | **55s** | Near-real-time; allow 1 refresh/min max |
| live-matches | `/matches?status=IN_PLAY,PAUSED` | 30 | **no limit** | Live scores must always refresh |
| standings-WC | `/competitions/WC/standings` | 3600 (1h) | **1800 (30min)** | Standings update after match ends |
| standings-PL/PD/BL1/SA/FL1/CL | `/competitions/*/standings` | 3600 (1h) | **1800 (30min)** | Same — league table changes after matches |

---

## Before / After: Provider Calls Per Cron Run

### Before PERF-6

Every run fires all 13 tasks unconditionally:
- 13 provider calls × 7s interval = **91 seconds minimum queue time**
- Queue depth peaks at **13** during each run

### After PERF-6

On a typical 30-min run during active WC period:
- `wc-all-matches`: SKIP-FRESH (data is ~1800s old = 1800s ≥ minInterval; fires once)
- `wc-upcoming`: SKIP-FRESH (same)
- `wc-finished`: SKIP-FRESH (same — last run was 30min ago, meets minimum)
- `wc-recent`: SKIP-FRESH (same)
- `today-matches`: Fires (fresh window = 60s; always >55s old by next cron run)
- `live-matches`: Always fires (no minimum)
- 7 standings: SKIP-FRESH if refreshed in last 30 min

**Typical run: 2 provider calls** (today-matches + live-matches)  
**After kickoff window** (match ending, scores changing): up to 5–6 calls  
**Queue depth: ≤ 2**

---

## Caller Tagging

All orchestrator tasks now pass `caller: 'cron/orchestrator'` to `refreshEndpoint()`.
Every `[Refresh] START`, `SKIP-FRESH`, `OK`, and `FAIL` log line includes
`| caller=cron/orchestrator` for easy log filtering.

---

## Background Revalidation Audit (Phase 6)

- `revalidatePath` / `revalidateTag`: **0 usages** in the entire src/ tree
- SWR bg-revalidation (`revalidateInBackground`): gated by KV NX lock (PERF-4.5)
- Page renders: all use `*Cached` variants (PERF-4.5) — **0 SWR triggers from pages**
- Admin page (`/admin/performance`): uses `withKVCache` directly but is internal/protected

**No queue storms possible from background revalidation.**
