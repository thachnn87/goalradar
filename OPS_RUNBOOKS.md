# OPS Runbooks — GoalRadar

Date: 2026-06-18
Version: DATA-18OPS.1

**Target:** A new engineer can recover GoalRadar in < 15 minutes using
these runbooks. Each runbook is self-contained — no prior context required.

**Auth note:** Debug endpoints require `Authorization: Bearer $CRON_SECRET`
or `?secret=$CRON_SECRET`. In development, auth is bypassed automatically.

---

## Index

| Incident | Runbook | Est. Recovery Time |
|----------|---------|-------------------|
| RF-1 Match Not Found | [→ RB-1](#rb-1--match-not-found--stale-identity) | 5–10 min |
| RF-2 Live Score Frozen | [→ RB-2](#rb-2--live-score-not-updating) | 3–8 min |
| RF-3 Authority Cache Miss | [→ RB-3](#rb-3--authority-cache-miss-spike) | 5–10 min |
| RF-4 Match State Wrong | [→ RB-4](#rb-4--match-state-classification-error) | 5–10 min |
| RF-5 ESPN Data Quality | [→ RB-5](#rb-5--espn-data-quality-degradation) | 5–15 min |
| RF-6 KV Unavailable | [→ RB-6](#rb-6--kv-unavailable--degraded) | 10–30 min |
| RF-7 Elevated Repair Freq. | [→ RB-7](#rb-7--elevated-repair-frequency) | 10–20 min |
| RF-8 WC Prewarm Failure | [→ RB-8](#rb-8--world-cup-prewarm-failure) | 5–10 min |

---

## RB-1 — Match Not Found / Stale Identity

**Symptom:** Match page 404 or wrong fixture data. Direct links broken.

### Step 1 — Immediate Response (< 2 min)
```
GET /api/debug/authority-cache
Authorization: Bearer $CRON_SECRET
```
Look for: `missRate > 0.15` or specific matchId returning null.

### Step 2 — Diagnosis (< 3 min)
```
GET /api/debug/authority-cache?matchId={affected_id}
```
- If response is `null`: key missing from KV → go to Recovery
- If response has wrong data: stale record → go to Recovery
- If response is correct but page shows 404: check Vercel routing config

### Step 3 — Recovery
**Option A — Key missing:**
```
GET /api/debug/reliability-governance?action=PREWARM_SNAPSHOT&matchId={id}&dryRun=false
Authorization: Bearer $CRON_SECRET
```
Wait 10 seconds, then verify.

**Option B — Wrong canonical ID:**
```
GET /api/debug/reliability-governance?action=REBUILD_DR&matchId={id}&dryRun=false
Authorization: Bearer $CRON_SECRET
```
This rebuilds the match's Data Record from authoritative sources.

### Step 4 — Validation
Load the match page directly in a browser. Confirm:
- Page renders (no 404)
- Match title and teams are correct
- `[Snapshot] HIT` appears in Vercel function logs

### Step 5 — Rollback
If PREWARM_SNAPSHOT or REBUILD_DR made things worse:
- Delete the KV key manually via Upstash console: `DEL goalradar:match:{id}`
- The next page load will do a cold fetch from FD (always authoritative)

**Escalate to TEAM_LEAD if:** > 3 matches affected simultaneously, or a
World Cup fixture is 404 during live play.

---

## RB-2 — Live Score Not Updating

**Symptom:** Score frozen > 5 minutes for a match in IN_PLAY or PAUSED state.

### Step 1 — Immediate Response (< 1 min)
Confirm the match is actually live:
- Check FD directly (external: Football-Data.org API) for current score
- If FD shows same score → GoalRadar may be correct; ESPN might be ahead
- If FD shows different score → GoalRadar is stale

### Step 2 — Diagnosis (< 2 min)
```
GET /api/debug/reliability-governance
Authorization: Bearer $CRON_SECRET
```
Check: `riskFactors` — is RF-2 (stale score) listed as active?

Check ESPN rate limiting:
```
GET /api/debug/prediction-accuracy?window=1h
```
If `worstPredictions` includes `REFRESH_ESPN_CACHE` → ESPN is the issue.

### Step 3 — Recovery
**If ESPN rate-limited:**
```
# Wait 60 seconds, then:
GET /api/debug/reliability-governance?action=REFRESH_ESPN_CACHE&matchId={id}&dryRun=false
Authorization: Bearer $CRON_SECRET
```

**If ESPN lookup broken (no match mapping):**
```
GET /api/debug/reliability-governance?action=RESOLVE_ESPN_LOOKUP&matchId={id}&dryRun=false
Authorization: Bearer $CRON_SECRET
```

**If live match being served from KV cache (should not happen):**
- Check KV key: `goalradar:match:{id}` — live matches should bypass KV
- If key exists for a live match: `DEL goalradar:match:{id}` in Upstash console
- Live match bypass is controlled by `matchState` field — verify `IN_PLAY` is set

### Step 4 — Validation
Reload the match page. Confirm:
- Score matches FD/ESPN
- `lastUpdated` timestamp is within 2 minutes
- Live ticker shows recent events

### Step 5 — Rollback
If ESPN refresh made data worse (e.g., returned empty payload):
- Disable ESPN enrichment temporarily for this match
- Fall back to FD-only data (score available, stats unavailable)
- Re-enable when ESPN recovers

**Escalate IMMEDIATELY if:** Live World Cup match score frozen > 10 minutes
→ EMERGENCY protocol, notify TEAM_LEAD.

---

## RB-3 — Authority Cache Miss Spike

**Symptom:** Latency spike across all match pages; cache miss rate > 20%.

### Step 1 — Immediate Response (< 1 min)
```
GET /api/debug/authority-cache
Authorization: Bearer $CRON_SECRET
```
Check:
- `hitRate` — normal is > 0.80
- `totalKeys` — sudden drop means keys expired or were evicted

### Step 2 — Diagnosis (< 3 min)
Determine root cause:
- **Planned TTL expiry:** Keys expired after 900s TTL — normal; prewarm cron may have missed
- **KV eviction:** Memory pressure caused early eviction — check Upstash memory usage
- **Unexpected invalidation:** Code change or deployment caused mass invalidation

### Step 3 — Recovery
**Prewarm top-traffic matches:**
```
# Run for each high-traffic match (homepage featured + WC fixtures)
GET /api/debug/reliability-governance?action=PREWARM_SNAPSHOT&matchId={id}&dryRun=false
Authorization: Bearer $CRON_SECRET
```
For bulk prewarm, the scheduled prewarm cron can be triggered manually.

**If KV memory pressure:**
- Review key count in Upstash console
- Identify keys without TTL set (they never expire)
- Set TTL on any permanent keys via Upstash console

### Step 4 — Validation
```
GET /api/debug/authority-cache
```
Confirm `hitRate` returning to > 0.80 within 10 minutes.

### Step 5 — Rollback
Cache miss does not require rollback — pages degrade gracefully (slower but correct).
If prewarm wrote wrong data: `DEL goalradar:match:{id}` for affected keys.

---

## RB-4 — Match State Classification Error

**Symptom:** Match showing wrong state (e.g., countdown for live match, or
live ticker for completed match).

### Step 1 — Immediate Response (< 1 min)
Check match state in KV:
```
GET /api/debug/authority-cache?matchId={id}
```
Note the `matchState` field value.

Check FD for authoritative state:
```
GET /api/debug/reliability-governance?matchId={id}
```

### Step 2 — Diagnosis (< 3 min)
Compare:
- KV `matchState` vs. FD `status` field
- If diverged: KV is stale (FD is always authoritative)

Common causes:
- Match kicked off but prewarm snapshot not invalidated
- `classifyMatchState()` received stale input data
- Timezone edge case near kickoff time

### Step 3 — Recovery
Force invalidation and re-fetch:
```
# Delete stale KV key (match will cold-fetch on next load)
# Via Upstash console: DEL goalradar:match:{id}
```
Or trigger a fresh snapshot:
```
GET /api/debug/reliability-governance?action=PREWARM_SNAPSHOT&matchId={id}&dryRun=false
Authorization: Bearer $CRON_SECRET
```

### Step 4 — Validation
Reload match page. Confirm:
- Correct state-dependent UI renders (countdown vs live vs post-match)
- `matchState` in page data matches FD source

### Step 5 — Rollback
Deleting the KV key is inherently safe — cold fetch always returns
fresh FD data. No further rollback needed.

---

## RB-5 — ESPN Data Quality Degradation

**Symptom:** Match pages missing stats, odds, or lineups. Enrichment sparse.

### Step 1 — Immediate Response (< 2 min)
Assess scope:
```
GET /api/debug/prediction-accuracy?window=1h
```
Check: how many matches affected? Is this isolated or widespread?

Check ESPN directly (if you have direct access) — determine if ESPN
API is globally degraded or only affecting specific matches.

### Step 2 — Diagnosis (< 3 min)
- **Single match missing data:** ESPN lookup failure for that match ID
- **Multiple matches missing odds only:** ESPN odds feed issue
- **All enrichment missing:** ESPN rate-limit or API outage
- **Enrichment present but stale:** ESPN returning cached response

### Step 3 — Recovery
**Single match ESPN lookup failure:**
```
GET /api/debug/reliability-governance?action=RESOLVE_ESPN_LOOKUP&matchId={id}&dryRun=false
Authorization: Bearer $CRON_SECRET
```

**High request rate triggering rate limit:**
```
GET /api/debug/reliability-governance?action=SUPPRESS_REFRESH&dryRun=false
Authorization: Bearer $CRON_SECRET
```
⚠️ SUPPRESS_REFRESH is system-wide. Requires TEAM_LEAD approval.
This halts ALL ESPN enrichment for the suppression window.

**ESPN globally down:**
- Activate FD-only mode (scores available, stats/odds unavailable)
- Add status banner to site indicating reduced data
- Do not attempt repeated ESPN calls — respect rate limits

### Step 4 — Validation
```
GET /api/debug/prediction-accuracy
```
Check enrichment coverage is recovering toward > 70%.

### Step 5 — Rollback
SUPPRESS_REFRESH auto-expires. To re-enable ESPN enrichment:
```
GET /api/debug/reliability-governance?action=SUPPRESS_REFRESH&enabled=false
Authorization: Bearer $CRON_SECRET
```

---

## RB-6 — KV Unavailable / Degraded

**Symptom:** All pages slow; debug endpoints returning 503; KV reads failing.

### Step 1 — Immediate Response (< 2 min)
**Check Upstash status:** https://status.upstash.com
Is this a region outage or GoalRadar-specific?

**Check KV credentials:**
- Verify `KV_REST_API_URL` is set in Vercel → Settings → Environment Variables
- Verify `KV_REST_API_TOKEN` is set and not expired

### Step 2 — Diagnosis (< 5 min)
Test KV connectivity directly:
```bash
curl -X GET "$KV_REST_API_URL/get/test-key" \
  -H "Authorization: Bearer $KV_REST_API_TOKEN"
```
- HTTP 200: KV is up — issue is in GoalRadar code
- HTTP 401: Credentials wrong or expired
- HTTP 503/timeout: KV genuinely unavailable

### Step 3 — Recovery
**Credentials rotated/expired:**
1. Regenerate token in Upstash console
2. Update `KV_REST_API_TOKEN` in Vercel environment variables
3. Redeploy (env var changes require redeployment in Vercel)

**Region outage:**
1. Check Upstash for ETA on recovery
2. Site continues to function without cache (degraded performance)
3. Do NOT attempt to switch KV regions mid-incident (too risky)
4. Once KV restored: trigger prewarm for top-10 matches

**Quota exceeded:**
1. Check Upstash usage dashboard
2. Upgrade plan or delete expired keys
3. Review key TTLs — ensure nothing is set to permanent when it should expire

### Step 4 — Validation
```
GET /api/debug/authority-cache
Authorization: Bearer $CRON_SECRET
```
Confirm `hitRate` > 0 and no 503 response.

### Step 5 — Rollback
KV recovery is self-restoring — once connectivity is re-established,
the cache warms organically. Prewarm the top matches to accelerate.

**Escalate IMMEDIATELY if:** KV is down during World Cup match day.

---

## RB-7 — Elevated Repair Frequency

**Symptom:** Same repair action triggering > 5 times in 1 hour for one match.

### Step 1 — Immediate Response (< 2 min)
```
GET /api/debug/evidence-readiness
Authorization: Bearer $CRON_SECRET
```
Identify which action + matchId is looping.

### Step 2 — Diagnosis (< 5 min)
```
GET /api/debug/prediction-accuracy?window=1h
```
Check `worstPredictions` — which action has lowest accuracy / highest failure rate?

Review repair records for the affected match:
- Are `verificationChecks[]` consistently failing the same check?
- Is the root issue upstream (FD/ESPN) or in GoalRadar logic?

### Step 3 — Recovery
**If upstream data issue (FD or ESPN returning bad data):**
1. Disable `AUTONOMOUS_RELIABILITY_ENABLED` temporarily
2. Open upstream incident ticket
3. Monitor manually until upstream recovers

**If GoalRadar verification logic too strict:**
1. Do NOT modify verification thresholds — escalate to TEAM_LEAD
2. TEAM_LEAD can adjust success conditions in `action-outcomes.ts`

**If repair loop consuming resources:**
```
# Trigger orchestrator escalation (requires TEAM_LEAD + EMERGENCY_ONLY governance)
GET /api/debug/reliability-governance?action=TRIGGER_ORCHESTRATOR&dryRun=false
Authorization: Bearer $CRON_SECRET
```

### Step 4 — Validation
Monitor repair frequency over next 30 minutes. Rate should drop below 1/hour.

### Step 5 — Rollback
If disabling the feature flag stopped the loop:
- Keep flag OFF until root cause identified and resolved
- Re-enable only after TEAM_LEAD review
- Failed repair records are retained in history; do not delete them
  (they are evidence for calibration)

---

## RB-8 — World Cup Prewarm Failure

**Symptom:** Prewarm job completed but KV keys absent before kickoff.

### Step 1 — Immediate Response (< 1 min)
**Check how much time until kickoff.** This determines urgency:
- T > 30 min: time to diagnose and retry
- T 5–30 min: execute recovery immediately, diagnose after
- T < 5 min: execute recovery right now, no time for diagnosis

### Step 2 — Diagnosis (< 3 min)
```
GET /api/debug/evidence-readiness
Authorization: Bearer $CRON_SECRET
```
Check `blockedActions` — is `PREWARM_SNAPSHOT` blocked by governance?

Check cron job logs in Vercel for the prewarm schedule:
- Did the cron trigger?
- Did it write KV keys?
- Did verification pass?

### Step 3 — Recovery
Manual prewarm trigger (fastest path):
```bash
# For each affected match ID
curl -X GET "$GOALRADAR_URL/api/debug/reliability-governance?action=PREWARM_SNAPSHOT&matchId={id}&dryRun=false" \
  -H "Authorization: Bearer $CRON_SECRET"
```

If multiple matches need prewarm, trigger in parallel (different match IDs
do not conflict).

### Step 4 — Validation
For each match:
```
GET /api/debug/authority-cache?matchId={id}
Authorization: Bearer $CRON_SECRET
```
Confirm KV key exists with TTL > 0.

Load match page — confirm `[Snapshot] HIT` in logs.

### Step 5 — Rollback
If prewarm wrote stale data (e.g., pre-kickoff lineup changed):
```
# Delete key — next load will cold-fetch fresh from FD
DEL goalradar:match:{id}  # via Upstash console
```
For live matches: KV bypass is automatic (`IN_PLAY` state skips cache entirely).

---

## Quick Reference — Debug Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/debug/authority-cache` | Cache hit rate, key inventory |
| `/api/debug/reliability-governance` | Risk assessment, action execution |
| `/api/debug/prediction-accuracy` | Confidence levels, worst predictions |
| `/api/debug/evidence-readiness` | Trust gates, READY status, ETA |
| `/api/debug/trust-candidates` | Actions closest to READY |
| `/api/debug/evidence-dashboard` | Full evidence summary per action |

All endpoints require `Authorization: Bearer $CRON_SECRET` in production.
