# Provider State Machine Audit — RES-4A

Generated: 2026-06-08  
Files audited: `src/lib/providers/manager.ts`, `football-data.ts`, `api-football.ts`, `types.ts`, `src/lib/api.ts`

---

## 1. Active Provider Selection Logic

**There is no latched circuit-breaker.** Every data request always starts at the primary
provider (`football-data`) regardless of previous failures.

```
withFailover(endpoint, primaryFn, secondaryFn):
  stats['football-data'].requestCount++
  log [PROVIDER] provider=football-data
  try:
    result = await primaryFn()          // always tried first
    recordSuccess('football-data')
    return result
  catch ApiUnavailableError:
    log [FAILOVER] football-data -> api-football
    stats['api-football'].requestCount++
    log [PROVIDER] provider=api-football
    result = await secondaryFn()        // only reached on primary error
    return result
```

The `activeProvider` field in `/api/debug/providers` is computed as:
```js
stats['football-data'].consecutiveErrors === 0 ? 'football-data' : 'api-football'
```
This is a **snapshot metric** — it does NOT gate routing decisions.

---

## 2. Automatic Failover — Code Path

**EXISTS. Per-call, not circuit-breaker.**

Trigger condition: `FootballDataProvider` throws `ApiUnavailableError`

| Reason | Trigger |
|---|---|
| `disabled` | HTTP 403 (account disabled / bad key) |
| `rate_limit` | HTTP 429 after all retries exhausted |
| `http` | HTTP 5xx after all retries exhausted |
| `timeout` | Fetch aborted after 10 s, all retries exhausted |
| `unknown` | Network error (ECONNREFUSED, ENOTFOUND, etc.) |

**NOT a failover trigger:**
- `NotFoundError` (HTTP 404) — resource doesn't exist; retrying on secondary won't help

**Retry behaviour before failover:**
| Error | Retries before failover |
|---|---|
| 403 disabled | 0 — immediate failover |
| 429 rate_limit | 0 after first 429 retry sequence (backs off per `Retry-After`) |
| 5xx | Up to 3 attempts × 1-2 s backoff ≈ 6 s total |
| timeout | Up to 3 attempts × 10 s = 30 s total |
| network | Up to 3 attempts × 1-2 s backoff ≈ 6 s total |

**Exact failover code (manager.ts `withFailover`):**
```ts
} catch (primaryErr) {
  recordError('football-data', primaryErr);
  if (!isFailoverTrigger(primaryErr)) throw primaryErr;  // 404 → no failover

  const event = { fromProvider: 'football-data', toProvider: 'api-football', reason, endpoint, timestamp }
  pushFailoverEvent(event);
  console.log(`[FAILOVER] football-data -> api-football | reason: ${reason} | endpoint: ${endpoint}`);

  stats['api-football'].requestCount++;
  console.log(`[PROVIDER] provider=api-football | endpoint=${endpoint}`);
  return await secondaryFn();
}
```

---

## 3. Automatic Failback — Code Path

**EXISTS (implicit — no circuit-breaker means primary is always tried).**

There is no explicit "stuck in failover" mode. Because `withFailover` always calls
`primaryFn()` first, failback is automatic: if `football-data` returns a successful
response on any request, `recordSuccess('football-data')` sets `consecutiveErrors = 0`
and a `[FAILBACK]` log is emitted.

**Exact failback code (manager.ts `recordSuccess`):**
```ts
function recordSuccess(provider: ProviderName, endpoint: string): void {
  const wasUnhealthy = stats[provider].consecutiveErrors > 0;
  const prevErrors   = stats[provider].consecutiveErrors;
  stats[provider].consecutiveErrors = 0;

  if (wasUnhealthy && provider === 'football-data') {
    const event = { provider, endpoint, errorsBeforeRecovery: prevErrors, timestamp: Date.now() };
    failbackLog.push(event);
    console.log(`[FAILBACK] api-football -> football-data | endpoint: ${endpoint} | recovered after ${prevErrors} error(s)`);
  }
}
```

---

## 4. Traffic Return After Recovery

**Does traffic automatically return to football-data after recovery?**
→ **YES** — on the very next uncached request.

**After how long?**
→ Immediately — the next request not served from cache will try football-data first.
   In practice this is bounded by cache TTLs:
   - Live matches: 30 seconds (L1 + KV TTL)
   - Fixtures:     15 minutes (KV SWR)
   - Standings:    1 hour (KV SWR)
   - Match detail: 1 minute (KV SWR)

**What condition triggers failback?**
→ `primaryFn()` succeeds (returns without throwing) on any call through `withFailover`.

**Implication of no circuit-breaker:**
When football-data is down and returning 403 immediately, every request incurs:
- 1 attempted HTTP call to football-data.org (instant 403 → no retry)
- 1 failover to api-football
Net overhead: ~50–150 ms per request (the 403 round-trip). This is acceptable.

For timeout errors the overhead is much worse: 3 × 10 s = 30 s before failover.
**Recommendation:** Add a circuit-breaker (not in scope for this audit sprint).

---

## 5. Endpoints

### `GET /api/debug/providers`

Returns in-process state snapshot (resets on cold start).

```json
{
  "activeProvider":         "football-data",
  "primaryHealthy":         true,
  "secondaryHealthy":       true,
  "footballDataConfigured": true,
  "apiFootballConfigured":  false,
  "failoverCount":          3,
  "failbackCount":          1,
  "lastFailover":           { "fromProvider": "football-data", "toProvider": "api-football", "reason": "disabled", "endpoint": "getFixtures(WC)", "timestamp": 1749420000000 },
  "lastFailback":           { "provider": "football-data", "endpoint": "getFixtures(WC)", "errorsBeforeRecovery": 5, "timestamp": 1749420600000 },
  "requestsByProvider":     { "football-data": 42, "api-football": 3 },
  "primary":                { "name": "football-data", "requestCount": 42, "errorCount": 3, "consecutiveErrors": 0, "lastError": null, "lastErrorAt": null, "healthy": true },
  "secondary":              { "name": "api-football",  "requestCount": 3,  "errorCount": 0, "consecutiveErrors": 0, "lastError": null, "lastErrorAt": null, "healthy": true },
  "recentFailovers":        [ /* last 10 FailoverEvent objects */ ],
  "generatedAt":            "2026-06-08T22:00:00.000Z"
}
```

Auth: `?token=<DEBUG_TOKEN>` (required in production)

### `GET /api/debug/provider-health`

Makes **live HTTP calls** to both providers and measures latency.

```json
{
  "football-data": { "healthy": false, "latencyMs": 312, "error": "ApiUnavailableError: Data temporarily unavailable" },
  "api-football":  { "healthy": true,  "latencyMs": 487, "matchCount": 12 },
  "testedAt":      "2026-06-08T22:00:00.000Z"
}
```

Auth: same `?token=<DEBUG_TOKEN>` guard.

---

## 6. Log Format

| Event | Log line |
|---|---|
| Primary attempted | `[PROVIDER] provider=football-data \| endpoint=getFixtures(WC)` |
| Secondary attempted | `[PROVIDER] provider=api-football \| endpoint=getFixtures(WC)` |
| Failover triggered | `[FAILOVER] football-data -> api-football \| reason: disabled \| endpoint: getFixtures(WC) \| ts: …` |
| Failback detected | `[FAILBACK] api-football -> football-data \| endpoint: getFixtures(WC) \| recovered after 5 error(s) \| ts: …` |
| Health probe | `[PROVIDER_HEALTH] football-data=FAIL latency=312ms \| api-football=OK latency=487ms` |

---

## 7. Gaps Identified (Not Fixed in This Sprint)

| Gap | Risk | Recommendation |
|---|---|---|
| No circuit-breaker | 30 s timeout overhead per request when FD is down with timeout errors | Add CB with 60s open window after N consecutive errors |
| `consecutiveErrors` is process-local | Multi-instance Vercel deployment: each instance tracks independently | Track failover state in KV for cross-instance visibility |
| `failoverCount` resets on cold start | Metrics lost on every deploy | Persist failover count to KV |
| api-football Free plan: 100 req/day | Will exhaust under WC traffic with FD down | Upgrade plan or add request budget tracking |
| 5 functions still call football-data directly (no failover) | `getTodayMatches`, `getTeamMatches`, `getWCResults`, `getWCKnockoutMatches`, `getTeam`, `getHeadToHead` | Add to ProviderManager interface |
