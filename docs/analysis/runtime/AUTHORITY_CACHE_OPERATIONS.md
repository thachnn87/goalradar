# Authority Cache Operations Runbook

**Version:** DATA-18C.5  
**Last updated:** 2026-06-18  
**Production domain:** `https://www.goalradar.org`  
**Scope:** `goalradar:wc:authority:v1`, `goalradar:dr:wc:authority:v1`, `goalradar:authority:last-write`

---

## Quick Reference

| State | Indicator | Action |
|---|---|---|
| Normal | authority-freshness: GREEN | None |
| DR serving | authority-freshness: RED, drPresent=true | Monitor orchestrator |
| Cold rebuild | telemetry: coldRebuilds > 0 | Check KV + orchestrator |
| Orchestrator gap | writeAgeMin > 240 | Check GitHub Actions |
| Kill-switch | AUTHORITY_CACHE_ENABLED=false | Re-enable in Vercel dashboard |

---

## 1. Normal Operation

### What normal looks like

```json
// authority-freshness
{
  "source": "primary",
  "ageSec": 0–300,
  "stale": false,
  "verdict": "GREEN"
}

// authority-telemetry (steady-state ttlTier=today)
{
  "primaryHitRatio": 4–8%,
  "drHitRatio": 92–96%,
  "coldRebuildRatio": 0%,
  "availability": 100%
}
```

### Why DR shows 92–96% even in normal operation

This is **expected behavior**. The primary key TTL is 300s (`today` tier during WC match days). The orchestrator runs every ~60-120 minutes. Primary serves reads for 5 minutes after each orchestrator run; DR serves the rest. This is the design: DR is the steady-state serving layer, not a fallback of last resort.

### Key metrics to watch

| Metric | Normal | Warning | Critical |
|---|---|---|---|
| `coldRebuildRatio` | 0% | > 0% | > 1% |
| `availability` | 100% | 99-99.9% | < 99% |
| `writeAgeMin` | 0–120 | 120–240 | > 240 |
| `drPresent` | true | — | false |
| authority-drift `red` count | 0 | — | > 0 |

---

## 2. DR Operation

### Trigger condition

Primary key (`goalradar:wc:authority:v1`) has expired (TTL elapsed). DR key (`goalradar:dr:wc:authority:v1`, 7-day TTL) is serving.

### Indicators

```json
// authority-freshness
{
  "source": "dr",
  "stale": true,
  "drPresent": true,
  "verdict": "RED",
  "note": "Primary evicted — serving from DR (Ns old)"
}
```

Note: `authority-freshness` returns `verdict: RED` during normal DR operation. This is misleading — RED does NOT mean the system is broken. DR serving is expected behavior between orchestrator runs.

### Is this an incident?

Check `writeAgeMin` in `/api/debug/authority-readiness`:
- `writeAgeMin < 120`: Not an incident. Normal inter-cron window.
- `writeAgeMin 120-240`: Monitor. Orchestrator may be delayed.
- `writeAgeMin > 240`: Investigate orchestrator cron.
- `writeAgeMin > 10080` (7 days): DR will expire soon. Emergency action needed.

### Recovery

DR resolves automatically when the next orchestrator run completes `writeAuthorityCache()`. No manual intervention needed for normal DR windows.

### Manual orchestrator trigger (if needed)

```
curl -X GET "https://www.goalradar.org/api/cron/orchestrator" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Expected response: `200 OK` with `authorityCache.matchCount: 104`. After this, primary will be live for 300s (today tier) or 30s (live tier) or 900s (normal tier).

---

## 3. Cold Rebuild Operation

### Trigger condition

Both primary AND DR keys are absent. Occurs if:
1. Orchestrator has not run for > 7 days (DR TTL expiry)
2. KV credentials are invalid (`KV_ENABLED = false`)
3. Manual deletion of both keys (should never happen)

### Indicators

```json
// authority-telemetry
{
  "coldRebuilds": 1,
  "coldRebuildRatio": > 0,
  "lastColdRebuildAt": "2026-XX-XXTXX:XX:XX.XXXZ"
}
```

### What cold rebuild does

`coldRebuild()` reads FD feeds from KV cache (no external network calls), reads 104 snapshot keys via `kv.mget`, reads 104 ESPN ID keys via `kv.mget`, then calls `buildAllCanonicalMatches()`. Returns `CanonicalMatch[]` identical to what primary/DR would return.

**Cold rebuild does NOT write back to KV.** Each serverless instance that needs the authority cache will cold rebuild independently until the orchestrator runs.

### Performance impact

- Expected cold rebuild latency: ~150-250ms (KV reads only)
- Concurrency protection: `_rebuildInflight` single-flight guard within each serverless instance
- Data quality: same data as primary/DR hits

### Recovery steps

1. **Immediate**: Cold rebuild serves correct data — no user-visible error.
2. **Trigger orchestrator** (see curl command in §2): Writes primary + DR + audit record. Restores normal operation.
3. **If orchestrator unavailable**: Cold rebuild continues to serve correctly until orchestrator recovers.
4. **Check**: After orchestrator runs, `telemetry.coldRebuilds` should stop incrementing.

---

## 4. Failure Diagnosis

### Symptom: authority-freshness verdict RED + note "Primary evicted"

**Normal** — check `writeAgeMin`. If < 120, this is routine inter-cycle DR serving. No action needed.

### Symptom: coldRebuilds > 0 in telemetry

```
1. Check authority-readiness verdict:
   - READY: anomaly, investigate slowly
   - PILOT_READY: degraded, trigger orchestrator
   - NOT_READY: critical, immediate action

2. Check writeAgeMin:
   - < 10080: DR still valid; orchestrator gap only
   - > 10080: DR expired, cold rebuild active permanently
```

### Symptom: authority-readiness verdict NOT_READY

Check `blockers` array in the response:
- `"Authority cache absent"`: writeAuthorityCache() never called. Check AUTHORITY_CACHE_ENABLED env var (should not be 'false').
- `"DR key absent"`: writeAuthorityCache() write to DR key failed. Check KV credentials.
- `"Cold rebuild rate > 1%"`: Both tiers absent. Orchestrator must be triggered manually.

### Symptom: authority-drift shows RED matches

RED matches indicate `score`, `state`, or `enrichment` mismatch between authority cache and individual match snapshot. This is a data accuracy issue, not a cache availability issue.

Steps:
1. Check if RED match was recently updated (FD feed data lag)
2. Trigger orchestrator to refresh authority cache
3. If RED persists, check per-match snapshot: `authority-drift` detail section shows which field drifted

### Symptom: authority-slo overall FAIL

The `authority-slo` endpoint will show FAIL under normal operation due to the miscalibrated DR Usage SLO (≤20% target vs 92-96% actual). **This is not an incident.** 

Check these instead:
- `slo.availability.verdict` — should be PASS
- `slo.coldRebuildRate.verdict` — should be PASS
- `authority-readiness.verdict` — should be READY

### Symptom: writeAgeMin > 240 (orchestrator gap > 4h)

```
1. Check GitHub Actions: .github/workflows/orchestrator-cron.yml
   - Is the cron workflow running?
   - Are there workflow failures?

2. If GitHub Actions down: trigger orchestrator manually (see §2)

3. DR serves correctly for 7 days from last write.
   Current DR expiry: writeAgeMin × 60 + lastWriteTimestamp
```

---

## 5. Kill-Switch

The authority cache can be disabled without a code deployment:

**To disable:**
1. Go to Vercel dashboard → Project → Settings → Environment Variables
2. Add: `AUTHORITY_CACHE_ENABLED = false` for Production
3. Redeploy (or wait for next deployment)

**Effect:** `writeAuthorityCache()` is skipped in the orchestrator. `readAuthorityCache()` falls through to cold rebuild for every call (data quality unaffected, performance slightly higher latency).

**To re-enable:**
1. Delete or set `AUTHORITY_CACHE_ENABLED` to any value other than `false`
2. Redeploy
3. Trigger orchestrator manually to restore primary + DR immediately

---

## 6. Monitoring Endpoints

All endpoints require `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`.

| Endpoint | Purpose | Normal verdict |
|---|---|---|
| `/api/debug/authority-freshness` | Primary/DR key age + source | GREEN (primary) or RED (DR) — RED is NORMAL |
| `/api/debug/authority-telemetry` | Hit/miss counters by day | GREEN |
| `/api/debug/authority-slo` | SLO compliance | FAIL (DR SLO miscalibrated) — ignore DR SLO |
| `/api/debug/authority-readiness` | Migration gate score | READY (100/100) |
| `/api/debug/authority-drift` | Data accuracy (score/state drift) | GREEN or YELLOW (lineup only) |
| `/api/debug/worldcup-health` | Full system health snapshot | GREEN or YELLOW |

**Primary operational check (one call):**
```
GET /api/debug/authority-readiness?secret=<CRON_SECRET>
→ "verdict": "READY", "blockers": [], "evidence.coldRebuildRatio30d": 0
```

---

## 7. TTL Reference

| Key | TTL (live tier) | TTL (today tier) | TTL (normal tier) |
|---|---|---|---|
| Primary `goalradar:wc:authority:v1` | 30s | 300s | 900s |
| DR `goalradar:dr:wc:authority:v1` | 7 days (all tiers) | 7 days | 7 days |
| Write record `goalradar:authority:last-write` | 10 days | 10 days | 10 days |
| Telemetry `goalradar:authority:telemetry:daily:*` | 30 days (refreshed on write) | 30 days | 30 days |

**TTL tier selection** (in priority order):
1. `live` — if any match is currently IN_PLAY or PAUSED
2. `today` — if any match kicks off today (UTC)
3. `normal` — no live or today matches
