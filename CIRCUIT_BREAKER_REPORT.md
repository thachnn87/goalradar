# Circuit Breaker Report — PERF-6 Phase 7
## GoalRadar · Sprint PERF-6

Generated: 2026-06-10

---

## Overview

GoalRadar already had a partial circuit breaker (`rate-safe.ts`) that activated
on 429 and 403 responses. PERF-6 extends it with:

1. **Timeout → circuit open** — after all retry attempts timeout, circuit opens
2. **Early reject in `fetchRaw()`** — active circuit aborts BEFORE queuing in the rate limiter
3. **`'timeout'` reason** in `RateSafeReason` — distinct telemetry from rate-limit events
4. **Configurable duration** via `CIRCUIT_BREAKER_TIMEOUT_MINS` env var

---

## State Machine

```
CLOSED (normal)
   │
   ├─ 429 → enableRateSafeMode('rate_limit', retryAfterMs)
   │         duration: 60s–1h (from Retry-After header)
   │         → OPEN
   │
   ├─ 403 → enableRateSafeMode('disabled', 3_600_000)
   │         duration: min 1h (account-level block)
   │         → OPEN
   │
   └─ TIMEOUT (all retries exhausted) → enableRateSafeMode('timeout', cbMs)
             duration: 15–60min (CIRCUIT_BREAKER_TIMEOUT_MINS env, default 15)
             → OPEN

OPEN
   │
   ├─ fetchRaw() entry check: isRateSafeModeActive() → throw immediately, no queue
   │
   ├─ refreshEndpoint() check: isRateSafeModeActive() → return 'skipped'
   │
   ├─ All page renders: serve KV / snapshots / static fallback (PERF-4, PERF-4.5)
   │
   └─ KV TTL expires → KV key deleted
              └─ readRateSafeFromKV() at next orchestrator start → in-process flag cleared
              └─ isRateSafeModeActive() auto-clears when expiresAt passes
              → CLOSED
```

---

## Changes Made

### `src/lib/rate-safe.ts`

- Added `'timeout'` to `RateSafeReason` union
- Updated clamp logic for `'timeout'` reason: `min 15 min, max 60 min`

```typescript
const clampedMs = reason === 'disabled'
  ? Math.max(retryAfterMs, 3_600_000)
  : reason === 'timeout'
    ? Math.min(Math.max(retryAfterMs, 15 * 60_000), 60 * 60_000)
    : Math.min(Math.max(retryAfterMs, 60_000), 3_600_000);
```

### `src/lib/providers/football-data.ts`

**1. Early-exit circuit check at start of `fetchRaw()`:**

```typescript
if (isRateSafeModeActive()) {
  console.log(`[FD] CIRCUIT-OPEN — rate-safe active, discarding ${endpoint}`);
  throw new ApiUnavailableError('rate_limit');
}
```

This prevents calls from queuing in `footballDataLimiter` when the circuit is open.
Without this, a 429 event would open the circuit, but the already-queued requests
would still drain the 7s-interval queue and potentially fire more 429s.

**2. Timeout → circuit open on final attempt:**

```typescript
if (attempt < MAX_ATTEMPTS) { await sleep(1_000); continue; }
if (isTimeout) {
  const cbMs = timeoutCircuitMs();
  console.warn(`[FD] TIMEOUT ${endpoint} — all ${MAX_ATTEMPTS} attempts failed | opening circuit for ${cbMs / 60_000}min`);
  enableRateSafeMode('timeout', cbMs);
}
throw new ApiUnavailableError(isTimeout ? 'timeout' : 'unknown');
```

`timeoutCircuitMs()` reads `CIRCUIT_BREAKER_TIMEOUT_MINS` env var (default 15, max 60).

---

## During OPEN State: User Experience

All user-facing pages are unaffected:
- **Match pages**: served from KV snapshot (`goalradar:match:{id}`) or DR key (30-day)
- **WC hub, fixtures, standings**: served from KV via `*Cached` variants → static WC fallback
- **Today/schedule**: served from KV or `{ matches: [] }` (empty)
- **Live page**: served from `goalradar:live:matches` KV (30s TTL; last-written value)

**No 5xx errors to users during circuit-open state** — every fallback chain
terminates at static data or an empty array, never throws.

---

## Configuration

| Env Var | Default | Range | Effect |
|---------|---------|-------|--------|
| `CIRCUIT_BREAKER_TIMEOUT_MINS` | 15 | 1–60 | Minutes circuit stays open after timeout |

The 429/403 durations are not configurable — they come from the API's Retry-After
header (429) or are fixed at 1h (403/disabled). Only the timeout window is tunable
because timeouts are transient (network blip) while 429/403 are API-level signals.

---

## Verification Checklist

- [x] `'timeout'` added to `RateSafeReason` type in rate-safe.ts
- [x] `fetchRaw()` rejects immediately when circuit is open (no queue entry)
- [x] Final-attempt timeout opens circuit for `CIRCUIT_BREAKER_TIMEOUT_MINS` minutes
- [x] `refreshEndpoint()` skips on active circuit (unchanged from before, now also covers timeout)
- [x] All page-render paths serve KV/static during circuit-open (PERF-4, PERF-4.5)
- [x] TypeScript: 0 errors
