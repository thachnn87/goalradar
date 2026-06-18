# DATA-18OPS.2A — Cron Inventory & Scheduling Audit

Date: 2026-06-18
Version: DATA-18OPS.2A

---

## Executive Summary

GoalRadar currently has **4 active cron jobs** (plus 1 deprecated tombstone).
All are scheduled via **external schedulers** (GitHub Actions / EasyCron /
UptimeRobot) — `vercel.json` contains `{}` (no Vercel-native cron configured).

The project uses `maxDuration = 60` in multiple routes, which requires the
**Vercel Pro plan** (Hobby plan caps at 10 seconds). Vercel Pro allows up
to **40 cron jobs** via `vercel.json`. Current native usage: **0 / 40**.

**Recommended schedule for `/api/cron/health-check`: 10 minutes** with
an exception protocol for World Cup match windows (5 minutes).

---

## Section 1 — Cron Job Inventory

### Job 1 — `/api/cron/orchestrator`

| Property | Value |
|----------|-------|
| **Schedule** | Every 30 min (external scheduler: GitHub Actions / EasyCron / UptimeRobot) |
| **Cron expression** | `*/30 * * * *` |
| **Configured in vercel.json** | ❌ No — external only |
| **maxDuration** | Not declared (uses Vercel default: 10s on Hobby, 300s on Pro) |
| **Source** | `src/app/api/cron/orchestrator/route.ts` |
| **Origin** | Replaced `/api/refresh/wc-fixtures` (10 min) + `/api/refresh/standings` (30 min) + `/api/cron/prewarm-worldcup` |

**Purpose:**  
Primary data refresh engine. Runs 12 sequential tasks:
- Phase 1: WC fixture feeds (4 endpoints: all, upcoming, finished, recent)
- Phase 1b: Today's cross-competition matches
- Phase 2: Live match refresh (goalradar:live:matches, 30s TTL, NOT throttled)
- Phase 3: Standings for 7 competitions (WC, PL, PD, BL1, SA, FL1, CL)

Then post-task steps:
- PERF-3: WC match KV seeding (104 match snapshots)
- DATA-9: On-demand ISR revalidation of WC paths (if ≥1 WC task succeeded)
- Writes prewarm record to KV for `/api/debug/prewarm-status`

**Runtime characteristics:**  
12 sequential FD API calls × ~1–2s each + WC seeding (variable) + ISR revalidation.
Estimated total: **15–40 seconds** per run (sequential, rate-limited at 7s/req for FD).
Built-in skip-if-fresh guard (`minIntervalSec`) prevents redundant provider calls.
Rate-safe mode: skips all refresh tasks when FD 429/403 is active.

**Dependencies:**
- Football-Data.org API (`FD_AUTH_TOKEN`)
- Vercel KV (`KV_REST_API_URL`, `KV_REST_API_TOKEN`)
- `CRON_SECRET` for auth
- ISR revalidation requires `REVALIDATE_SECRET`

**Risk if missed (one run):**  
WC fixture data goes stale. Live match scores freeze (live-matches task not running).
Homepage and standings pages served from 30-min-old KV cache. Moderate user impact.

**Risk if duplicated (two instances overlapping):**  
HIGH. Sequential task design assumes single-runner. Duplicate runs cause:
- Double FD API requests (risk of 429 rate limit)
- Race conditions on KV keys written by WC seeding
- Double ISR revalidation (benign but wasteful)
The rate-safe mode mitigates the 429 risk but not the KV race.

---

### Job 2 — `/api/cron/health-archive`

| Property | Value |
|----------|-------|
| **Schedule** | Every 15 min (recommended in code comments) |
| **Cron expression** | `*/15 * * * *` |
| **Configured in vercel.json** | ❌ No — external only |
| **maxDuration** | 60 seconds |
| **Source** | `src/app/api/cron/health-archive/route.ts` |
| **Origin** | DATA-18H Phase 1 |

**Purpose:**  
Persists a health snapshot to `goalradar:health-archive` ZSET for trend analysis.
Fetches 4 monitoring subsystems in parallel:
- `/api/debug/authority-drift`
- `/api/debug/feed-integrity`
- `/api/debug/authority-freshness`
- `/api/debug/enrichment-health`

Computes aggregate verdict (GREEN/YELLOW/RED/ERROR) and appends a
`HealthArchiveRecord`. Prunes records older than 30 days.

**Runtime characteristics:**  
4 parallel debug endpoint fetches (each with 25s timeout) + 1 KV ZADD.
Estimated: **3–10 seconds** per run (parallel fetch, not sequential).

**Dependencies:**
- Vercel KV
- 4 internal debug endpoints (self-calls)
- `CRON_SECRET`

**Risk if missed (one run):**  
LOW. Health archive has a gap. Trend charts may show a missing data point.
No operational impact — this is observability data, not production data.

**Risk if duplicated:**  
LOW. ZADD is idempotent for the same timestamp. Two runs within 1 second may
write duplicate records with slightly different timestamps. Pruning cleans these.

---

### Job 3 — `/api/cron/repair-enrichment`

| Property | Value |
|----------|-------|
| **Schedule** | Daily at 04:00 UTC |
| **Cron expression** | `0 4 * * *` |
| **Configured in vercel.json** | ❌ No — external only |
| **maxDuration** | Not declared |
| **Source** | `src/app/api/cron/repair-enrichment/route.ts` |
| **Origin** | DATA-16 Objective 4 |

**Purpose:**  
Daily repair scan for degraded WC match enrichment. Reads all FINISHED match IDs
from the `goalradar:/competitions/WC/matches?status=FINISHED` KV key, then for
each match where `score > 0 AND goals.length === 0` (enrichment missing): invalidates
the KV snapshot so the next page load re-enriches from ESPN.

Uses `Promise.allSettled` for parallel snapshot reads; sequential invalidation.
Depends on the FINISHED feed being populated by the orchestrator.

**Runtime characteristics:**  
~104 KV reads (parallel) + N KV deletes (N = degraded count, typically 0–5).
Estimated: **5–15 seconds** per run.

**Dependencies:**
- Vercel KV (requires FINISHED feed to be populated)
- ESPN enrichment (indirectly — invalidation triggers re-enrichment on next page load)
- `espnEventKvKey()` for belt-and-suspenders ESPN cache clear

**Risk if missed (one run):**  
LOW-MEDIUM. Degraded matches (score but no goals) stay degraded for another day.
User sees correct score but missing goal timeline on match pages.

**Risk if duplicated:**  
LOW. Invalidation is idempotent (deleting an already-deleted key is a no-op).
Double runs may each fetch the same FINISHED feed, producing identical results.

---

### Job 4 — `/api/cron/drift-scan`

| Property | Value |
|----------|-------|
| **Schedule** | Daily at 04:30 UTC (30 min after repair-enrichment) |
| **Cron expression** | `30 4 * * *` |
| **Configured in vercel.json** | ❌ No — external only |
| **maxDuration** | 60 seconds |
| **Source** | `src/app/api/cron/drift-scan/route.ts` |
| **Origin** | DATA-18F Phase 3 |

**Purpose:**  
Nightly authority-vs-snapshot drift scanner. Reads all FINISHED WC matches from
the authority cache and their KV snapshots. Detects and logs:
- Score drift (RED): authority score ≠ snapshot score
- State drift (RED): authority state ≠ snapshot state
- Enrichment drift (YELLOW): enrichmentApplied flag mismatch
- Goals count drift (YELLOW): goals array length mismatch
- Lineup missing (YELLOW): no lineup in snapshot for a scored match

Logging only — no repairs. Structured logs for Vercel log alerts.

**Runtime characteristics:**  
1 authority cache read + N parallel KV reads (N = finished match count, ~0–104).
Estimated: **3–8 seconds** per run.

**Dependencies:**
- Vercel KV
- `readAuthorityCache()` (authority-cache lib)

**Risk if missed (one run):**  
LOW. Drift goes undetected for one extra day. No user impact.

**Risk if duplicated:**  
NONE. Read-only — no writes. Two runs produce two identical log sets.

---

### Job 5 — `/api/cron/prewarm-worldcup` (DEPRECATED TOMBSTONE)

| Property | Value |
|----------|-------|
| **Schedule** | Unknown — legacy external scheduler config may still be calling it |
| **Status** | ⚠️ DEPRECATED — merged into orchestrator (RATE-3) |
| **Configured in vercel.json** | ❌ No |
| **maxDuration** | Not declared |
| **Source** | `src/app/api/cron/prewarm-worldcup/route.ts` |

**Purpose:**  
Tombstone only. Returns HTTP 200 with `{ deprecated: true, redirect: '/api/cron/orchestrator' }`.
Exists to prevent external scheduler alerts when legacy configs still call the old path.

**Risk if missed:** NONE (no work performed).  
**Risk if duplicated:** NONE (no work performed).

**Action required:** Update any external scheduler configs still pointing to
`/api/cron/prewarm-worldcup` to use `/api/cron/orchestrator` instead.

---

### Deprecated Routes in `vercel-bak.json` (Superseded)

These were in the original `vercel.json` before being superseded by the orchestrator.
`vercel-bak.json` is not active — it has no effect on production.

| Route | Schedule | Status |
|-------|----------|--------|
| `/api/refresh/wc-fixtures` | `*/10 * * * *` (every 10 min) | Superseded by orchestrator |
| `/api/refresh/standings` | `*/30 * * * *` (every 30 min) | Superseded by orchestrator |

---

## Section 2 — Capacity Analysis

### Vercel Plan Assessment

| Evidence | Conclusion |
|----------|-----------|
| `drift-scan/route.ts`: `export const maxDuration = 60` | Requires Pro (Hobby max: 10s) |
| `health-archive/route.ts`: `export const maxDuration = 60` | Requires Pro (Hobby max: 10s) |
| External scheduler used instead of vercel.json | Consistent with Pro plan usage pattern |

**Plan: Vercel Pro** (confirmed by maxDuration usage)  
**Native cron limit: 40 jobs**

### Current Vercel Native Cron Usage

| Source | Crons defined |
|--------|--------------|
| `vercel.json` (active) | **0** — file contains `{}` |
| `vercel-bak.json` (inactive) | 2 (deprecated) |

**Native cron slots used: 0 / 40**  
**Remaining capacity: 40 / 40** (if migrating to native cron)  
**Adding health-check: 1 / 40** — trivial headroom

### External Scheduler Inventory

4 active endpoints are scheduled via external scheduler. If migrating to Vercel
native cron, they would consume:
- orchestrator (30 min) + health-archive (15 min) + repair-enrichment (daily) + drift-scan (daily) = **4 slots**
- health-check (proposed) = **1 additional slot**
- **Total if fully migrated: 5 / 40**

### Does GoalRadar Require Pro Plan Cron Features?

Yes. The `maxDuration = 60` declarations require Pro. Additionally:
- Vercel Pro allows cron schedules down to `*/1 * * * *` (every 1 minute)
- Hobby plan minimum is every 1 day (once per day only)
- The existing health-archive at 15-min frequency and orchestrator at 30-min
  frequency both require Pro-level cron granularity

**The Pro plan is already required and already in use.**

---

## Section 3 — Overlap Analysis

### Schedule Conflict Matrix

| | orchestrator (30m) | health-archive (15m) | repair-enrichment (04:00) | drift-scan (04:30) | health-check (proposed) |
|--|--|--|--|--|--|
| **orchestrator (30m)** | — | Coexist fine | Coexist fine | Coexist fine | Coexist fine |
| **health-archive (15m)** | Coexist fine | — | Coexist fine | Coexist fine | ⚠️ Partial overlap |
| **repair-enrichment (04:00)** | Coexist fine | Coexist fine | — | Sequential (intended) | Coexist fine |
| **drift-scan (04:30)** | Coexist fine | Coexist fine | Sequential (intended) | — | Coexist fine |
| **health-check (proposed)** | Coexist fine | ⚠️ Partial overlap | Coexist fine | Coexist fine | — |

### Overlap Detail: health-check vs. health-archive

**Scenario:** Both proposed at 15 min.

At :00, :15, :30, :45 past each hour:
- health-archive fires → reads 4 debug endpoints → writes KV ZSET record
- health-check fires → reads authority-cache + live match data → may fire Slack alert

**Conflict assessment: LOW RISK**

The two jobs read from overlapping debug endpoints (`/api/debug/authority-cache`)
but neither mutates the same KV keys as the other:
- health-archive writes `goalradar:health-archive` ZSET
- health-check writes `goalradar:alert:dedup:*` keys

No write-write conflict. Concurrent execution is safe. Both will incur
slightly elevated serverless invocation counts at the overlap minutes,
which is negligible at Pro tier.

**Resolution:** At 10-min schedule, health-check overlaps with health-archive
only at :00 and :30 (when both 10m and 15m cycles align, every 30 min). Safe.

### Daily Job Sequencing (04:00–04:30 UTC)

```
04:00 UTC  repair-enrichment fires — scans finished matches, invalidates degraded snapshots
           (~5–15 seconds)
04:30 UTC  drift-scan fires — reads authority cache + fresh snapshots
           (benefits from repair-enrichment having cleared degraded entries first)
```

This sequence is intentional and documented in the drift-scan source comment.
A health-check at any sub-hourly interval does not interfere with this sequence
since health-check reads only KV/cache state without writing to match data.

---

## Section 4 — Schedule Recommendation for `/api/cron/health-check`

### What the health-check cron must detect

| RF | Threshold | Detection requirement |
|----|-----------|----------------------|
| RF-2 Live score frozen | stalenessSeconds ≥ 300 (5 min) | Must detect within RED SLA |
| RF-6 KV unavailable | reachable = false | Any interval sufficient (binary state) |
| RF-3 Cache miss spike | hitRate < 0.60 | 15 min acceptable (degrades gradually) |
| RF-5 ESPN degradation | coverageRate < 0.70 | 15 min acceptable (degrades gradually) |
| RF-7 Repair loop | repairCount > 5 / hour | 10 min acceptable |
| RF-8 WC prewarm failure | failedMatchIds.length > 0 | Depends on kickoff time |

**The binding constraint is RF-2 on a World Cup live match.**

### SLA Analysis per Interval

Detection latency = worst case = cron interval (signal fires just after a cron run).
Total incident duration = detection latency + response time + resolution time.

| Interval | RF-2 detect (worst case) | Total (detect + 2m respond + 3m fix) | RED SLA (15 min) | CRITICAL SLA (10 min) |
|----------|-------------------------|--------------------------------------|------------------|-----------------------|
| **5 min** | 5 min | 10 min | ✅ PASS (5 min buffer) | ✅ PASS (0 min buffer) |
| **10 min** | 10 min | 15 min | ✅ PASS (0 min buffer) | ❌ FAIL (5 min over) |
| **15 min** | 15 min | 20 min | ❌ FAIL (5 min over) | ❌ FAIL (10 min over) |
| **30 min** | 30 min | 35 min | ❌ FAIL (20 min over) | ❌ FAIL (25 min over) |

**15 min and 30 min both fail the RED SLA for RF-2.**  
**10 min passes RED SLA but fails CRITICAL SLA (World Cup live match).**  
**5 min passes both RED and CRITICAL SLAs.**

### Monthly Execution Count

| Interval | Executions/hour | Executions/day | Executions/month (30d) |
|----------|----------------|---------------|----------------------|
| 5 min | 12 | 288 | **8,640** |
| 10 min | 6 | 144 | **4,320** |
| 15 min | 4 | 96 | **2,880** |
| 30 min | 2 | 48 | **1,440** |

At a per-execution runtime of ~2 seconds:
| Interval | Compute-hours/month | vs. Vercel Pro limit (1,000 GB-hrs) |
|----------|--------------------|------------------------------------|
| 5 min | ~4.8 hours | 0.5% of limit |
| 10 min | ~2.4 hours | 0.2% of limit |
| 15 min | ~1.6 hours | 0.2% of limit |
| 30 min | ~0.8 hours | 0.1% of limit |

All intervals are computationally trivial at Pro plan limits.

### Expected Slack Alert Volume per Day

Health-check fires alerts only when thresholds are breached. Under normal
conditions (no active incident), 0 alerts fire (all suppressed or no threshold breach).

| Scenario | Alert fires/day | Notes |
|----------|----------------|-------|
| Normal match day | 0–2 | Only if RF-2/RF-6/RF-8 breach threshold |
| Light ESPN degradation | 1 | RF-5 fires once, then 30-min suppression |
| Active RF-2 incident | ~2–3 (per 5-min) or ~1 (per 10-min) | RED suppression = 5 min; CRITICAL = no suppression |
| KV outage | 1 (RED) | RF-6 fires once; then per 5-min during outage (CRITICAL) |

At **10-min** schedule, an active RF-2 RED incident (non-WC) fires:
- 1 alert at detection
- 1 re-alert after 5-min suppression window (if still active)
= 2 alerts per incident, then 5-min suppression throttles further noise

At **5-min** schedule with a CRITICAL incident (WC live, suppression=0):
- Alert fires on every cron run until resolved
- With 5-min cron: ~2–12 alerts over a 10–60 min incident
= potentially noisy for extended CRITICAL incidents

**Conclusion:** 10-min strikes the better balance between detection speed and alert volume.
For CRITICAL scenarios, the on-call engineer is notified on every run regardless — the
trade-off is acceptable since CRITICAL incidents warrant continuous notification.

### KV Cost (Dedup Operations)

Each health-check run performs:
- 1–5 KV reads (dedup checks) per run
- 0–1 KV writes (dedup set on alert fire)

| Interval | KV reads/month (5 checks/run) | Upstash Free tier (500K) |
|----------|-------------------------------|--------------------------|
| 5 min | 43,200 | 8.6% of free tier |
| 10 min | 21,600 | 4.3% of free tier |
| 15 min | 14,400 | 2.9% of free tier |

All intervals are within Upstash Free tier limits, let alone any paid tier.

---

## Section 5 — Final Answer

### Recommended Schedule: **10 minutes**

**Cron expression:** `*/10 * * * *`

**Quantitative justification:**

1. **RF-2 RED SLA compliance:** 10-min detection + 2-min response + 3-min fix = 15 min total.
   Exactly meets the 15-min RED resolution SLA with zero buffer. This is acceptable for
   non-World Cup live matches. The SLA margin is tight but met.

2. **RF-6 detection:** KV unavailability is a binary state detected within 10 min of
   onset — fully compatible with all SLAs.

3. **Alert volume:** At 10 min, an RF-2 incident generates 2 alerts (first fire + 1
   re-fire after 5-min suppression). This is the appropriate signal without noise.

4. **Resource efficiency:** 4,320 executions/month at ~2s each = 2.4 compute-hours.
   Trivial against Pro plan limits. 21,600 KV reads/month — 4.3% of Upstash free tier.

5. **Overlap:** At 10 min, health-check overlaps with health-archive (15 min) only at
   :00 and :30 every hour. No write conflicts; safe to run concurrently.

6. **Cron slot cost:** 1 slot (native Vercel) out of 40 available on Pro plan.

### Exception Protocol: 5 minutes during World Cup Match Windows

For **World Cup live match windows** (T-60 min before kickoff → final whistle):

| Condition | Schedule |
|-----------|----------|
| Outside WC match windows | `*/10 * * * *` (10 min) |
| During WC match windows | `*/5 * * * *` (5 min) |

**Why:** CRITICAL SLA is "resolve within 10 min." At 10-min cron, detection alone
consumes the full SLA window before a human can act. 5-min detection leaves 5 min for
human response — the minimum viable buffer for a CRITICAL World Cup incident.

**Implementation:** Either configure two overlapping cron entries (one at 10 min, one at
5 min for specific WC kickoff hours) or manually switch the Vercel cron setting on match
days. The simpler operational choice is to run at **5 minutes permanently** and accept
the trivially higher resource cost (8,640 vs. 4,320 executions/month — still <0.5% of
Pro plan compute limit).

### Decision Matrix

| Factor | 5 min | **10 min ✅** | 15 min | 30 min |
|--------|-------|-------------|--------|--------|
| RF-2 RED SLA | ✅ 5m buffer | ✅ 0m buffer | ❌ FAIL | ❌ FAIL |
| RF-2 CRITICAL SLA | ✅ | ❌ FAIL | ❌ FAIL | ❌ FAIL |
| Alert volume (normal day) | 0–2 | 0–2 | 0–1 | 0–1 |
| Alert volume (active incident) | 2–12 | 2–3 | 1–2 | 1 |
| Monthly executions | 8,640 | **4,320** | 2,880 | 1,440 |
| KV ops/month | 43,200 | **21,600** | 14,400 | 7,200 |
| Cron slots used | 1/40 | **1/40** | 1/40 | 1/40 |
| Overlap with health-archive | Every 5m | **Every 30m** | Every 15m | Every 30m |
| Plan required | Pro | **Pro** | Pro | Pro |

**Final recommendation: 10 minutes baseline, 5 minutes on WC match days.**

If operational simplicity is preferred over cost (the cost difference is negligible),
configure permanently at **5 minutes** and accept the always-CRITICAL-SLA-compliant posture.
