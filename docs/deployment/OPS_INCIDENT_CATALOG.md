# OPS Incident Catalog — GoalRadar

Date: 2026-06-18
Version: DATA-18OPS.1

This catalog covers every known failure mode in the GoalRadar reliability
framework (RF-1 through RF-8). Each entry defines symptoms, impact, detection,
recovery path, and escalation level.

---

## RF-1 — Match Not Found / Stale Identity

### Symptoms
- `/match/[id]` returns 404 or renders with wrong match data
- `canonicalMatchId` resolves to a different fixture than expected
- Match page shows "Match not found" despite the fixture existing in FD
- Authority Cache HIT but resolved to deprecated match record
- Redirect loop: old slug → canonical slug → old slug

### Business Impact
- **User:** Cannot find a specific match; direct links break
- **SEO:** 404s on indexed match pages erode organic ranking
- **Revenue:** Missed page impressions on high-value fixtures (WC final, etc.)
- **Severity:** HIGH during World Cup; MEDIUM in regular season

### Affected Pages
- `/match/[id]` (match detail)
- `/` (homepage featured matches)
- Sitemap entries for deprecated slugs

### Detection Source
- HTTP 404 spike in Vercel analytics
- Authority Cache miss rate exceeds 15% threshold
- Sentry `MATCH_NOT_FOUND` error burst
- User report: "match page broken"

### Recovery Path
1. Identify the mismatched `canonicalMatchId` via `/api/debug/authority-cache`
2. Determine if FD has renamed/remapped the fixture
3. If FD mapping changed: trigger `PREWARM_SNAPSHOT` for affected match
4. If Authority Cache stale: `REBUILD_DR` for the affected match ID
5. Verify redirect chain resolves correctly
6. Monitor for 5 minutes — 404 rate should return to baseline

### Escalation Level
**WARNING → YELLOW** if >3 matches affected simultaneously  
**RED** if World Cup fixture page is 404 during live match

---

## RF-2 — Live Score Not Updating

### Symptoms
- Match in `IN_PLAY` or `PAUSED` state but score frozen >5 minutes
- `lastUpdated` timestamp in match detail is stale
- ESPN feed returning cached/stale response
- KV snapshot for live match has TTL > 0 (should bypass cache)
- Score on homepage differs from match detail page

### Business Impact
- **User:** Core product value lost — GoalRadar is a live scores product
- **Trust:** Users stop returning if scores are wrong
- **Severity:** CRITICAL during live World Cup match; HIGH otherwise

### Affected Pages
- `/match/[id]` (match detail live ticker)
- `/` (homepage live score widget)
- Any embedded widget consuming live match data

### Detection Source
- `lastUpdated` age alert (>5 min for IN_PLAY match)
- ESPN API response cache-control header analysis
- Match state = IN_PLAY but `goalCount` unchanged for >10 minutes
- User reports on social channels

### Recovery Path
1. Check ESPN API directly: `GET /api/debug/reliability-governance?action=REFRESH_ESPN_CACHE`
2. If ESPN rate-limited: wait 60 seconds, retry
3. If ESPN returning stale data: trigger `REFRESH_ESPN_CACHE` for the match
4. If ESPN lookup failing (no match mapping): trigger `RESOLVE_ESPN_LOOKUP`
5. Verify live match KV key `goalradar:match:{id}` is NOT cached (live bypass)
6. Confirm score updates within 2 minutes

### Escalation Level
**RED** if live World Cup match score frozen >10 minutes  
**YELLOW** if non-WC live match  
**INFO** if match completed (score no longer live)

---

## RF-3 — Authority Cache Miss Spike

### Symptoms
- `/api/debug/authority-cache` shows miss rate > 20%
- Increased latency on all match pages (cold KV reads on every request)
- Multiple `[Authority] MISS` log entries per minute
- Reduced page performance scores (Core Web Vitals regression)
- Cache keys in KV returning null/expired

### Business Impact
- **Performance:** 200–400ms latency increase per page load
- **Reliability:** Pages still render but slower; resilience margin reduced
- **Cost:** Increased KV read operations billed
- **Severity:** MEDIUM (degraded but functional)

### Affected Pages
- All match pages (universal dependency on Authority Cache)
- Homepage match cards
- Tournament bracket pages

### Detection Source
- `[Authority] MISS` log frequency in Vercel function logs
- KV dashboard showing TTL expiry spike
- Latency p95 increase in Vercel analytics
- Authority Cache hit rate metric dropping below 80%

### Recovery Path
1. Identify which keys are missing via `/api/debug/authority-cache?detail=true`
2. Determine cause: planned TTL expiry, KV eviction, or unexpected invalidation
3. If TTL expiry: trigger `PREWARM_SNAPSHOT` for top-traffic matches
4. If KV eviction (memory pressure): review key count, remove stale entries
5. If unexpected invalidation: check for concurrent write conflicts
6. Monitor hit rate recovery for 10 minutes

### Escalation Level
**WARNING** if hit rate 60–80%  
**YELLOW** if hit rate < 60% sustained >5 minutes  
**RED** if hit rate drops to 0% (KV unavailable — see RF-6)

---

## RF-4 — Match State Classification Error

### Symptoms
- Live match showing as `SCHEDULED` (missed kickoff detection)
- Completed match showing as `IN_PLAY`
- `classifyMatchState()` returning wrong tier for a match
- Countdown timer visible on a match already in progress
- Post-match stats not rendered (depends on `FINISHED` state)

### Business Impact
- **UX:** Wrong UI rendered for the match state (countdown vs. live ticker)
- **Data:** Incorrect state propagated to homepage, widgets
- **Severity:** HIGH during live matches; MEDIUM otherwise

### Affected Pages
- `/match/[id]` (state-dependent UI rendering)
- `/` (live indicator badge on homepage)
- Tournament bracket (round advancement logic)

### Detection Source
- Match kickoff time passed but state still `SCHEDULED` in KV
- Manual observation: score visible but countdown still showing
- `classifyMatchState()` output diverges from ESPN feed status
- FD match status field and GoalRadar internal state disagree

### Recovery Path
1. Compare FD `status` field vs. GoalRadar KV `matchState` via debug endpoint
2. If FD has correct state but KV is stale: invalidate KV key, force re-fetch
3. If ESPN has different state than FD: trust FD as authority (FD = source of truth)
4. Trigger `PREWARM_SNAPSHOT` to rebuild the match record from canonical sources
5. Verify state renders correctly on the match page
6. Check related matches (same group/round) for the same error pattern

### Escalation Level
**WARNING** if non-live match  
**YELLOW** if live match state wrong during group stage  
**RED** if knockout round match state wrong

---

## RF-5 — ESPN Data Quality Degradation

### Symptoms
- ESPN API returning partial lineups (missing substitutes, bench)
- Odds data absent or significantly stale (>6 hours for live match)
- Event timeline missing goals/cards that occurred
- Player stats (shots, passes) zeroed out mid-match
- ESPN returning 200 OK with empty `data` payload
- Enrichment coverage < 70% for matches in the current window

### Business Impact
- **Data completeness:** Match pages missing stats, odds, lineups
- **User trust:** Incomplete data erodes perceived reliability
- **Severity:** MEDIUM (pages render; data is incomplete)

### Affected Pages
- `/match/[id]` enrichment sections: odds, lineups, player stats, timeline
- Prediction engine (confidence degraded due to reduced feature set)

### Detection Source
- ESPN enrichment coverage metric < 70% threshold
- `DATA18C0_ENRICHMENT_COVERAGE` style metric alert
- Specific fields null in match detail (odds=null, lineup=[])
- ESPN API response time > 3 seconds (sign of degradation)

### Recovery Path
1. Check ESPN API status independently (is it a GoalRadar-specific issue?)
2. If ESPN rate-limited: trigger `SUPPRESS_REFRESH` to halt high-frequency calls
3. If ESPN returning empty payloads: trigger `RESOLVE_ESPN_LOOKUP` for affected matches
4. If ESPN partially available: prioritise live match enrichment over historical
5. If ESPN fully down: activate FD-only mode (match scores still available)
6. Monitor enrichment coverage; recover above 70% before closing incident

### Escalation Level
**INFO** if coverage 70–85%  
**WARNING** if coverage 50–70%  
**YELLOW** if coverage < 50% sustained  
**RED** if ESPN down during live World Cup match

---

## RF-6 — KV Unavailable / Degraded

### Symptoms
- All Authority Cache reads returning null
- `readRepairRecords()` throwing or returning empty array
- Confidence history read/write failing silently
- All match pages loading slowly (no cache layer)
- `/api/debug/*` endpoints returning 503

### Business Impact
- **Performance:** Every match page does full cold-fetch from FD + ESPN
- **Reliability:** Confidence calibration cannot persist; evidence lost
- **Availability:** Pages still load but at degraded performance
- **Severity:** HIGH (functional but fragile)

### Affected Pages
- All pages (KV is universal cache layer)
- All `/api/debug/*` endpoints

### Detection Source
- Upstash KV dashboard: connection errors or latency > 500ms
- `KV_REST_API_URL` health check failing
- Vercel function logs: `ECONNREFUSED` or `timeout` on KV calls
- 503 responses from `/api/debug/evidence-readiness`

### Recovery Path
1. Check Upstash dashboard — is KV reachable from Upstash console?
2. If KV region outage: check Upstash status page
3. If KV quota exceeded: review key count and TTL settings
4. If credentials rotated: update `KV_REST_API_URL` and `KV_REST_API_TOKEN` in Vercel env
5. Once KV restored: trigger `PREWARM_SNAPSHOT` for top-10 matches to rebuild cache
6. Verify hit rate recovery via `/api/debug/authority-cache`
7. Replay any missed confidence records from in-flight repair operations

### Escalation Level
**YELLOW** if KV degraded (high latency, intermittent failures)  
**RED** if KV fully unavailable  
**EMERGENCY** if KV unavailable during World Cup final

---

## RF-7 — Elevated Repair Frequency

### Symptoms
- Repair history shows > 5 repair attempts in a 1-hour window
- Same action being triggered repeatedly for the same match
- `goalradar:repair:history` ZSET growing faster than expected
- Reliability scoring showing same match with persistent high risk
- Repair loop: action executes → verificationPassed=false → re-triggers

### Business Impact
- **Operational:** System is fire-fighting; reliability margin consumed
- **Performance:** Repair operations add latency to affected match reads
- **Evidence:** Repeated failed repairs pollute confidence calibration data
- **Severity:** HIGH (indicator of underlying unresolved issue)

### Affected Pages
- Whatever match triggered the repair loop
- Repair history and reliability dashboard

### Detection Source
- `goalradar:repair:history` read showing >5 entries in 1 hour for one match
- Same action + same matchId appearing repeatedly in repair log
- `verificationPassed=false` on consecutive repair records
- `TRIGGER_ORCHESTRATOR` being invoked (emergency escalation path)

### Recovery Path
1. Identify the recurring action + matchId from repair history
2. Determine why verification is failing (check `verificationChecks[]` on RepairRecordV2)
3. If root cause is upstream (FD or ESPN returning bad data): open upstream incident
4. If root cause is GoalRadar logic (wrong success condition): disable flag temporarily
5. Trigger `MONITOR_SELF_HEAL` to establish a monitoring baseline
6. If repair loop persists > 30 minutes: escalate to TEAM_LEAD, trigger `ESCALATE_INCIDENT`
7. Once root cause resolved, revert any temporary flag changes

### Escalation Level
**WARNING** if repair frequency 3–5/hour  
**YELLOW** if same match triggering > 5 repairs  
**RED** if repair loop consuming all available repair budget

---

## RF-8 — World Cup Prewarm Failure

### Symptoms
- `PREWARM_SNAPSHOT` action completing but `verificationPassed=false`
- Scheduled prewarm job not writing KV entries before match kickoff
- Authority Cache cold on match page load despite prewarm having run
- KV key `goalradar:match:{id}` absent at T-5 minutes before kickoff
- Prewarm audit showing coverage < 80% of scheduled WC fixtures

### Business Impact
- **Performance:** First-load latency spike at kickoff (no warm cache)
- **Scale:** With 3–4 concurrent WC matches, cold load multiplied
- **User experience:** Slowest experience precisely at highest-traffic moment
- **Severity:** HIGH during group stage; CRITICAL during knockouts/final

### Affected Pages
- All WC match pages scheduled for prewarm
- Homepage during prewarm window (prewarm job consumes request budget)

### Detection Source
- Prewarm cron job logs: `PREWARM_SNAPSHOT` `verificationPassed=false`
- KV key absent check at T-5 minutes
- Match page cold-load time >2 seconds at kickoff
- Vercel function cold-start spike in analytics at match start times

### Recovery Path
1. Identify which match IDs failed prewarm via repair history
2. Manually trigger `PREWARM_SNAPSHOT` for each failed match ID
3. Verify KV key written: check `/api/debug/authority-cache?matchId={id}`
4. If KV write succeeds but verification fails: check TTL (should be 900s)
5. If repeated prewarm failures: check whether live match is bypassing cache correctly
6. Verify the fix: load match page and confirm `[Snapshot] HIT` in logs
7. Add affected match IDs to next prewarm window if kickoff >30 min away

### Escalation Level
**WARNING** if prewarm coverage 70–90% of scheduled fixtures  
**YELLOW** if prewarm coverage < 70%  
**RED** if prewarm fails for World Cup final or semifinal
