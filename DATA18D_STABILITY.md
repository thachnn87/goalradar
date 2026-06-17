# DATA-18D Phase 4 — 24-Hour Stability Audit
## Authority Cache Canary Monitoring Protocol

Stability endpoint: `/api/debug/data18d-stability`  
To run: `curl "https://www.goalradar.org/api/debug/data18d-stability?secret=$CRON_SECRET" | jq .`

---

## Monitoring Schedule

| Time | Label | Action |
|------|-------|--------|
| T+0h | Activation | Enable `AUTHORITY_RESULTS_ONLY=true`. Run stability endpoint. Baseline. |
| T+6h | Early check | Run endpoint. Confirm cache HIT. Check poisonedCount=0. |
| T+12h | Mid-point | Run endpoint. Confirm hit rate trend. Check enrichment health. |
| T+18h | Late check | Run endpoint. Check after any new match completions. |
| T+24h | Final | Run endpoint. Full gate check against all criteria. |

---

## Metrics to Collect

### Cache Telemetry (from `getAuthorityTelemetry()`)

Note: telemetry counters are per-process and reset on cold start. Numbers reflect activity since last Vercel cold start, not cumulative.

| Metric | Meaning | Target |
|--------|---------|--------|
| `hits` | Primary KV cache HIT | Should grow monotonically |
| `drHits` | DR cache used (primary missed) | Should be 0 in steady state |
| `coldRebuilds` | Full rebuild triggered | Should be low (1 per cold start) |
| `writeCount` | `writeAuthorityCache()` calls | From cron writes |
| `lastBuildMs` | Most recent cold rebuild duration | < 500ms |
| Cache hit rate | hits / (hits + drHits + coldRebuilds) | > 90% |

### Authority Cache KV State

| Metric | Target |
|--------|--------|
| `primaryPresent` | true |
| `primaryAgeMin` | < 16 min (TTL_NORMAL=900s = 15 min) |
| `primaryMatchCount` | 104 |
| `drPresent` | true |
| `drAgeHours` | < 168h (7-day TTL) |

### Benchmark Snapshots (4 matches)

| Metric | Target |
|--------|--------|
| `poisonedCount` | 0 |
| Each benchmark goals > 0 | true |

### Enrichment Health

| Metric | Target |
|--------|--------|
| `unenriched` | 0 |
| `noSnapshot` | 0 |

---

## Stability Readings

*(Paste output from stability endpoint for each interval)*

### T+0h — Baseline

```json
{ "PASTE_STABILITY_OUTPUT_HERE": true }
```

### T+6h

```json
{ "PASTE_STABILITY_OUTPUT_HERE": true }
```

### T+12h

```json
{ "PASTE_STABILITY_OUTPUT_HERE": true }
```

### T+18h

```json
{ "PASTE_STABILITY_OUTPUT_HERE": true }
```

### T+24h — Final

```json
{ "PASTE_STABILITY_OUTPUT_HERE": true }
```

---

## RED Conditions (Immediate Action Required)

If any of these appear at any reading:
- `gate = "RED"` → disable canary (`AUTHORITY_RESULTS_ONLY=false`), investigate
- `poisonedCount > 0` → run bulk repair endpoint immediately
- `enrichmentHealth.unenriched > 0` → run repair-enrichment cron, then wait 30s and re-check
- Authority compare returns RED → root cause analysis before proceeding

## YELLOW Conditions (Note and Monitor)

- `cacheHitRate < 90%` → check if cold starts are frequent (Vercel function scaling event)
- `primaryPresent = false` → authority cache TTL expired, next request triggers cold rebuild
- `drHits > 0` in steady state → primary key is missing, check TTL configuration
