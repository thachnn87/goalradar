# OPS Disaster Recovery Playbook — GoalRadar

Date: 2026-06-18
Version: DATA-18OPS.1

**Scope:** Full-loss or severe-degradation scenarios requiring structured
recovery. Not for routine incidents (see OPS_RUNBOOKS.md).

---

## Definitions

**RTO (Recovery Time Objective):** Maximum acceptable time from failure
detection to service restoration.

**RPO (Recovery Point Objective):** Maximum acceptable data loss measured
in time (how old the recovered data can be).

---

## Scenario Index

| Scenario | RTO | RPO |
|----------|-----|-----|
| DR-1 Authority Cache Lost | 15 min | 0 (stateless rebuild) |
| DR-2 KV Unavailable | 30 min | 24 hours of repair history |
| DR-3 FD Unavailable | 60 min | Last cached match state |
| DR-4 ESPN Unavailable | 5 min | N/A (enrichment-only) |
| DR-5 World Cup Prewarm Failure | 10 min | 0 (rebuild on demand) |

---

## DR-1 — Authority Cache Lost

### What happened
All KV keys under `goalradar:match:*` prefix are gone. Could be caused by:
- Accidental `FLUSHALL` in Upstash console
- KV database recreation after migration
- Mass TTL expiry (no keys were set with TTL, bulk expiry)
- Upstash database deleted and recreated

**RTO:** 15 minutes  
**RPO:** 0 — cache is derived from FD; no data is lost, only rebuild time

### Impact
- All match pages load via cold-fetch (slow but correct)
- Page load times 300–600ms slower than normal
- Cache hit rate: 0%
- No data loss (FD is the source of truth)

### Manual Steps

**Step 1 — Confirm the loss (< 1 min)**
```bash
# In Upstash console: check key count
# Or via API:
curl "$KV_REST_API_URL/dbsize" -H "Authorization: Bearer $KV_REST_API_TOKEN"
# Expected: ~150 keys; if 0 or near-0, cache is lost
```

**Step 2 — Verify FD is reachable (< 1 min)**
Load any match page. If it renders (slowly), FD is available.
If it errors, go to DR-3 first.

**Step 3 — Prioritise rebuild queue (< 2 min)**
Identify highest-traffic matches:
1. Any currently live (IN_PLAY / PAUSED) match
2. Today's upcoming World Cup fixtures
3. Homepage featured matches

**Step 4 — Trigger prewarm for priority matches (< 5 min)**
```bash
# For each priority match ID:
curl -X GET "$GOALRADAR_URL/api/debug/reliability-governance?action=PREWARM_SNAPSHOT&matchId={id}&dryRun=false" \
  -H "Authorization: Bearer $CRON_SECRET"
```
Trigger these in parallel — different match IDs do not conflict.

**Step 5 — Verify cache rebuilding (< 2 min)**
```bash
curl "$GOALRADAR_URL/api/debug/authority-cache" \
  -H "Authorization: Bearer $CRON_SECRET"
# hitRate should be rising; totalKeys should be > 0
```

**Step 6 — Allow organic warm (ongoing)**
Non-priority matches warm automatically as users visit pages.
Full cache warm: ~15–30 min at normal traffic levels.

### Recovery Validation
- `/api/debug/authority-cache` shows `hitRate > 0.80`
- Match pages loading in < 500ms (not cold-fetch latency)
- No `[Authority] MISS` flood in function logs

### Notes
- Do NOT restore from a KV backup (KV data is ephemeral cache, not source of truth)
- The repair history (`goalradar:repair:history`) is separate — verify it separately
- The confidence history (`goalradar:confidence-history`) is also separate — verify separately

---

## DR-2 — KV Unavailable

### What happened
Upstash KV is unreachable. Could be caused by:
- Upstash region outage
- Vercel-to-Upstash network partition
- Credentials rotated/expired
- Upstash account suspended (billing)

**RTO:** 30 minutes (credential fix) or dependent on Upstash ETA (region outage)  
**RPO:** 24 hours of repair history (confidence calibration events lost for outage duration)

### Impact
- All KV reads return null or throw — pages fall back to FD cold-fetch
- Site is functional but slow (300–600ms additional latency per page)
- Reliability framework cannot record new repair records — evidence accumulation paused
- Confidence calibration cannot run — trust state frozen at last value
- All debug endpoints return 503

### Manual Steps

**Step 1 — Determine root cause (< 5 min)**

Check Upstash status: https://status.upstash.com

Test credentials directly:
```bash
curl "$KV_REST_API_URL/ping" -H "Authorization: Bearer $KV_REST_API_TOKEN"
# Expected: +PONG
# If 401: credentials issue → Step 2a
# If timeout/503: region outage → Step 2b
```

**Step 2a — Credentials issue**
1. Log into Upstash console → Database → Reset token
2. Copy new `KV_REST_API_TOKEN` value
3. In Vercel: Settings → Environment Variables → Update `KV_REST_API_TOKEN`
4. Trigger a new Vercel deployment (env var changes require redeploy)
5. Verify `/api/debug/authority-cache` returns 200

**Step 2b — Region outage**
1. Check Upstash status page for ETA
2. Communicate to TEAM_LEAD: KV is down, site is degraded but functional
3. Do NOT attempt to migrate to a different KV region mid-outage
4. Monitor Upstash status every 5 minutes
5. Once restored: proceed to cache rebuild (DR-1 Step 3 onward)

**Step 3 — During outage (ongoing)**
Site will function without KV. Users see correct data from FD cold-fetch.
No manual intervention required for core functionality.

**Step 4 — Post-recovery reconciliation**
After KV restored:
1. Rebuild authority cache (DR-1 procedure)
2. Verify repair history is intact: `/api/debug/evidence-readiness`
3. Verify confidence history: `/api/debug/prediction-accuracy`
4. If repair records were lost during outage: note the gap in evidence accumulation
   (gap is expected; calibration will resume from next production execution)

### Recovery Validation
- `curl "$KV_REST_API_URL/ping"` returns `+PONG`
- `/api/debug/authority-cache` returns 200 with hitRate data
- Match page load times return to < 300ms

---

## DR-3 — FD (Football-Data.org) Unavailable

### What happened
Football-Data API is unreachable or returning errors for all requests.
This is the authoritative data source for match scores, states, and fixtures.

**RTO:** 60 minutes (dependent on FD SLA)  
**RPO:** Last cached match state in KV (typically 15 min old for live matches,
900s TTL for non-live)

### Impact
- **If KV cache warm:** Site fully functional for all cached matches (scores may be stale)
- **If KV cache cold:** Match pages error or show incomplete data
- Live match scores will freeze as FD is the live score source
- New match fixtures will not appear
- Post-match data (final scores, stats) will not update

### Manual Steps

**Step 1 — Confirm FD outage (< 2 min)**
Check FD status page or make a direct API call:
```bash
curl "https://api.football-data.org/v4/matches?status=LIVE" \
  -H "X-Auth-Token: $FD_AUTH_TOKEN"
# If 503/timeout: FD is down
# If 401: token issue → not an outage, fix token
```

**Step 2 — Assess cache coverage (< 2 min)**
```bash
curl "$GOALRADAR_URL/api/debug/authority-cache" \
  -H "Authorization: Bearer $CRON_SECRET"
# Check: totalKeys, hitRate
# If hitRate > 0.80: cache is warm — users see slightly stale but present data
# If hitRate < 0.50: cache is thin — significant degradation
```

**Step 3 — Extend cache TTL for existing keys**
If FD outage will be extended (> 30 min), existing cache keys will expire.
Temporarily re-prewarm all existing match keys to reset their TTL:
```bash
# For each match currently in cache: re-trigger prewarm
# This will fail to fetch fresh data from FD but will extend TTL of existing keys
# Only do this if KV has a current snapshot to extend
```

**Step 4 — Communicate degraded state**
During a long FD outage:
- Add a status notice to the site (if a CMS/banner mechanism exists)
- Inform TEAM_LEAD
- Do NOT show stale live scores as if they were current → disable live tickers
  or add "scores delayed" notice

**Step 5 — Recovery after FD restores**
Once FD is reachable:
1. Invalidate all KV cache keys (data may be stale)
2. Trigger prewarm for all live and upcoming matches
3. Verify live scores are updating correctly
4. Remove degraded-state notices

### Recovery Validation
- FD API returns 200 for match requests
- KV keys rebuilt with fresh data
- Live match scores updating in real time

---

## DR-4 — ESPN Unavailable

### What happened
ESPN enrichment API is down or returning errors.

**RTO:** 5 minutes (activate FD-only mode)  
**RPO:** N/A — ESPN provides enrichment only (stats, odds, lineups), not core match data

### Impact
- **Core functionality preserved:** Scores, match states, KO times all from FD
- **Degraded:** Odds, player stats, lineups, detailed timeline absent
- Match pages render with reduced data (enrichment sections empty)
- Prediction engine operates on FD-only features (lower confidence)

### Manual Steps

**Step 1 — Confirm ESPN outage (< 1 min)**
Check if ESPN API errors are widespread or match-specific.
If match-specific: this is RF-5 (data quality), not a DR scenario.
If widespread: proceed.

**Step 2 — Activate FD-only mode (< 2 min)**
Trigger SUPPRESS_REFRESH to halt ESPN calls system-wide:
```bash
curl "$GOALRADAR_URL/api/debug/reliability-governance?action=SUPPRESS_REFRESH&dryRun=false" \
  -H "Authorization: Bearer $CRON_SECRET"
```
⚠️ Requires TEAM_LEAD approval in production.

**Step 3 — Monitor ESPN recovery (ongoing)**
Poll ESPN status every 5 minutes. Do not make repeated full-scale ESPN
requests during outage — this wastes rate limit quota on recovery.

**Step 4 — Re-enable ESPN enrichment**
Once ESPN is stable:
```bash
curl "$GOALRADAR_URL/api/debug/reliability-governance?action=SUPPRESS_REFRESH&enabled=false" \
  -H "Authorization: Bearer $CRON_SECRET"
```
Monitor enrichment coverage metric recovering toward > 70%.

### Recovery Validation
- `/api/debug/prediction-accuracy` shows enrichment coverage > 70%
- Match pages showing odds and lineups for current fixtures

---

## DR-5 — World Cup Prewarm Failure (Full)

### What happened
The scheduled prewarm cron job has failed to run, or has run but written no
KV keys, for multiple consecutive WC match days. All upcoming WC fixtures
are unprewarm'd.

**RTO:** 10 minutes  
**RPO:** 0 (cache is rebuildable on demand from FD)

### Impact
- All WC match pages will have cold-load latency spike at kickoff
- With 4 concurrent WC matches: 4x cold-load spike simultaneously
- Peak user traffic coincides with maximum cache coldness
- No data loss — pages render correctly but slowly

### Manual Steps

**Step 1 — Identify all unprewarm'd WC fixtures (< 2 min)**
```bash
curl "$GOALRADAR_URL/api/debug/evidence-readiness" \
  -H "Authorization: Bearer $CRON_SECRET"
# Look at World Cup section — which match IDs have no KV key?
```

Cross-reference today's WC schedule with existing KV keys via authority cache.

**Step 2 — Determine time to next kickoff**
Priority is determined by imminence:
- T > 60 min: diagnose and fix cron; trigger manual prewarm
- T 15–60 min: trigger manual prewarm immediately; diagnose after
- T < 15 min: trigger manual prewarm NOW; notify TEAM_LEAD

**Step 3 — Manual bulk prewarm**
```bash
# All today's WC match IDs in parallel:
for matchId in WC_ID_1 WC_ID_2 WC_ID_3 WC_ID_4; do
  curl -X GET "$GOALRADAR_URL/api/debug/reliability-governance?action=PREWARM_SNAPSHOT&matchId=$matchId&dryRun=false" \
    -H "Authorization: Bearer $CRON_SECRET" &
done
wait
echo "All prewarm requests submitted"
```

**Step 4 — Verify prewarm success**
For each match ID:
```bash
curl "$GOALRADAR_URL/api/debug/authority-cache?matchId={id}" \
  -H "Authorization: Bearer $CRON_SECRET"
# Confirm: key exists, TTL > 0
```

**Step 5 — Diagnose cron failure (after match is prewarm'd)**
Check Vercel cron job logs:
- Did the cron trigger? (check Vercel dashboard → Logs → Cron)
- If cron triggered but wrote no keys: check prewarm function errors
- If cron did not trigger: check cron schedule configuration in vercel.json

### Recovery Validation
- `/api/debug/authority-cache` shows all WC match keys present
- Match page load: `[Snapshot] HIT` for each prewarm'd fixture
- Cache hit rate back to > 80%

---

## DR Recovery Contacts

| Scenario | First Contact | Escalation |
|----------|--------------|------------|
| DR-1 Cache Lost | ONCALL (self-service runbook) | TEAM_LEAD if not resolved in 15 min |
| DR-2 KV Down | ONCALL + notify TEAM_LEAD | Upstash support if region outage |
| DR-3 FD Down | TEAM_LEAD | FD support: support@football-data.org |
| DR-4 ESPN Down | ONCALL (self-service) | TEAM_LEAD if > 30 min |
| DR-5 WC Prewarm | ONCALL (self-service) | TEAM_LEAD if match < 15 min away |

---

## Post-Incident Checklist (all scenarios)

After any DR scenario:
- [ ] Recovery validated against criteria above
- [ ] Incident start time, end time, duration noted
- [ ] Root cause identified (or investigation ticket opened)
- [ ] OPS_INCIDENT_CATALOG.md updated if new failure mode discovered
- [ ] TEAM_LEAD notified of outcome
- [ ] Confidence history gap noted if KV was down (evidence accumulation paused)
- [ ] Prewarm schedule reviewed if DR-5 occurred
