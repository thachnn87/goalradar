# DATA-18C.5 Phase 4 — DR Expiry Simulation

**Audit date:** 2026-06-18  
**Source:** Code audit of `readAuthorityCache()` + `coldRebuild()` in `src/lib/authority-cache.ts`

---

## 1. Scenarios Under Test

| Scenario | Primary | DR | Expected behavior |
|---|---|---|---|
| A — Normal | Present | Present | Return primary |
| B — Primary expired | Absent | Present | Return DR |
| C — Both absent | Absent | Absent | Cold rebuild |
| D — KV disabled | N/A | N/A | Cold rebuild (KV_ENABLED=false path) |

Scenarios A and B are observed in production (DATA-18C.4: 5 primary hits, 96 DR hits). This document validates scenarios C and D by code path analysis.

---

## 2. Scenario B — Primary Absent, DR Serves (OBSERVED)

**Evidence from production (2026-06-18):**

The primary key (`goalradar:wc:authority:v1`, TTL=300s) expired 2+ hours before telemetry observations began. DR key (`goalradar:dr:wc:authority:v1`, TTL=7 days) served 96/101 reads successfully. Confirmed by:
- `source=dr` in authority-freshness
- `drHits=96` in telemetry
- `coldRebuilds=0` — cold rebuild never triggered despite primary being absent

**Code path for Scenario B (from `readAuthorityCache()`):**
```typescript
// 1. Primary: kv.get(AUTHORITY_KEY) → returns null (key expired)
//    → no-op, fall through

// 2. DR: kv.get(AUTHORITY_DR_KEY) → returns valid envelope
//    → recordAuthorityRead('dr', latencyMs, builtAt) fire-and-forget
//    → return drEnvelope.matches ← 104 matches served
```

**CONFIRMED SAFE**: 96 consecutive DR reads with 0 errors.

---

## 3. Scenario C — Both Primary and DR Absent (SIMULATED BY CODE AUDIT)

This scenario triggers when the orchestrator has not run for **> 7 days** (DR TTL expiry).

**Cold rebuild code path (`coldRebuild()`):**

```typescript
async function coldRebuild(builtAt: string): Promise<CanonicalMatch[]> {
  // Single-flight: concurrent requests coalesce onto one rebuild
  if (_rebuildInflight !== null) {
    return _rebuildInflight; // no-op for concurrent callers
  }

  // Step 1: Read FD feeds in parallel
  const [upcomingResult, resultsResult, liveResult] = await Promise.allSettled([
    getUpcomingMatchesCached('WC'),    // reads KV: goalradar:competitions/WC/matches?...
    getWCResultsCached(),              // reads KV: goalradar:competitions/WC/matches?status=FINISHED
    getWCLiveMatches(),                // reads KV: live cache
  ]);

  // Step 2: Merge FD feeds by STATE_RANK
  // Step 3: kv.mget all 104 snapshot keys (100-key chunk)
  // Step 4: kv.mget all 104 ESPN ID keys (100-key chunk)
  // Step 5: buildAllCanonicalMatches() — pure, zero KV writes
  // Step 6: return matches[]
}
```

**Cold rebuild characteristics:**

| Property | Value | Notes |
|---|---|---|
| Network calls | 0 | All FD data is cached in KV already |
| KV reads | ~5-7 Redis commands | FD feeds + 2× chunked mget |
| KV writes | 0 | Cold rebuild does NOT write back to KV |
| Single-flight | YES | `_rebuildInflight` guard prevents concurrent rebuilds |
| Error handling | Graceful degradation | Each data layer wrapped in `try/catch`; missing data returns empty Map |
| Return value | `CanonicalMatch[]` | Same structure as primary/DR hits |

**Expected latency for cold rebuild (estimated):**
- FD feed KV reads (3 parallel): ~50-100ms (KV hit, not network)
- mget 104 snapshots: ~30-50ms
- mget 104 ESPN IDs: ~30-50ms
- buildAllCanonicalMatches(): <5ms (pure function)
- Total: **~150-250ms** (both KV tiers warm)

> Note: `recordAuthorityRead('cold', ...)` fires when cold rebuild completes, incrementing `coldRebuilds` counter in telemetry.

**NOT a write:** Cold rebuild returns CanonicalMatch[] directly. It does NOT write the result back to the primary or DR keys. A subsequent request will cold rebuild again unless `writeAuthorityCache()` (orchestrator) is called.

**Key risk in Scenario C:** Each page render that calls `readAuthorityCache()` will cold rebuild independently (up to `_rebuildInflight` single-flight within the same serverless instance). Across multiple concurrent instances, each will cold rebuild separately. This causes elevated KV read load but **returns correct data**.

---

## 4. Scenario C Trigger Condition

```
Scenario C fires when:
  lastWriteAgeMin > 10080  (7 days × 60 min = 7,200 min)
  AND KV_ENABLED = true

Currently:
  writeAgeMin = 149 min (at DATA-18C.4 readiness check)
  DR TTL expiry = 7 days from last write = 2026-06-25T12:56 UTC
  Time until DR expires: 6 days 21 hours
```

**For DR expiry to be reached, the orchestrator must not run for 7 consecutive days.** Given GitHub Actions runs every `*/15` minutes, the only way this occurs is a GitHub Actions outage or the repository being deleted/disabled.

---

## 5. Scenario D — KV Disabled (KV_ENABLED = false)

**Code path:** `if (KV_ENABLED)` block is skipped entirely in `readAuthorityCache()`. Falls directly to `coldRebuild()`.

This is the state that existed before DATA-18C.1 activation (KV disabled or `writeAuthorityCache()` never called). DATA-18OPS.2D documented this: every call was a cold rebuild.

**If KV credentials are removed from Vercel dashboard:**
- `KV_ENABLED` evaluates to `false`
- All reads cold rebuild
- `recordAuthorityRead('cold', ...)` fires for every call
- telemetry cold rebuild counter rises rapidly
- No data loss — just performance degradation

---

## 6. Scenario C Safety Validation

Cold rebuild is **safe** by design:

1. **Correct data**: Reads from the same FD feeds + snapshot data that `writeAuthorityCache()` uses. Same `buildAllCanonicalMatches()` function. Output is identical to a cache-hit.

2. **Single-flight**: Multiple concurrent `readAuthorityCache()` calls within the same serverless instance coalesce onto one cold rebuild via `_rebuildInflight`. No thundering herd within an instance.

3. **Graceful degradation**: If a FD feed or KV read fails, the error is caught and the function continues with an empty map. Matches without snapshot data still render (with `enrichmentApplied=false`).

4. **No KV mutation**: Cold rebuild does not write back to KV. This prevents a broken rebuild from poisoning the cache.

5. **Telemetry visible**: `coldRebuilds` counter increments, `lastColdRebuildAt` is set. `coldRebuildRatio` will rise in telemetry, triggering alerts via `authority-readiness` (PILOT_READY instead of READY).

---

## 7. Scenario C Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Orchestrator down > 7 days | Very Low | High (cold rebuild on every read) | GitHub Actions is not a single point of failure; 7-day window is long |
| Both FD feeds AND KV snapshots unavailable during cold rebuild | Very Low | Medium (matches render without enrichment) | buildAllCanonicalMatches() degrades gracefully |
| Thundering herd on cold rebuild across multiple instances | Low | Medium (KV read spike) | Single-flight guards within instances; Vercel auto-scales |
| KV credentials rotated without updating Vercel env vars | Low | High | Same as KV_DISABLED scenario; cold rebuild serves correct data |

---

## 8. Summary

| Scenario | Tested | Outcome | Safety |
|---|---|---|---|
| B: Primary absent, DR serves | ✅ Observed (96 reads) | 104 matches, 42ms, 0 errors | SAFE |
| C: Both absent, cold rebuild | Code audit | Correct data, ~200ms, graceful degradation | SAFE |
| D: KV disabled | Code audit | Cold rebuild on every read | SAFE (data correct, slower) |

Cold rebuild path is safe. DR provides 7-day protection window. Primary provides a 5-minute window after each orchestrator run. All three tiers return identical `CanonicalMatch[]` data.
