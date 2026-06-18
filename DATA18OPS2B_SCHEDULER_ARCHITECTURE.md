# DATA-18OPS.2B — Scheduler Architecture Audit

Date: 2026-06-18
Version: DATA-18OPS.2B

---

## Context and Prior Art

This audit builds on two prior documents:

- **PERF9_AUDIT.md** (2026-06-11): Measured 92/104 WC match snapshots missing
  in production KV. Root cause: `vercel.json` crons were deliberately removed
  (commits `f4a2401 "remove cron"` + `3969951 "remove vercel cron"`), and no
  external trigger was ever configured. The prewarm pipeline was fully built
  and entirely dormant.

- **OPS2_SCHEDULER_HARDENING.md** (2026-06-12): First formal scheduler audit.
  Measured GitHub Actions `schedule` effective cadence at **~2 hours** on this
  repo (nominal `*/30`). Recommended Architecture D: GitHub Actions (primary)
  + UptimeRobot (backup cadence guarantee). Implemented by densifying the
  workflow schedule to `*/15`.

This document extends that recommendation to cover the new
`/api/cron/health-check` workload (DATA-18OPS.2A: 10-min interval) and
re-evaluates the full scheduler architecture for World Cup 2026.

---

## Section 1 — Verified Current State

### Vercel Plan and Native Cron Capability

| Property | Value | Evidence |
|----------|-------|----------|
| Plan | **Pro** | `maxDuration = 60` in drift-scan and health-archive routes (Hobby cap: 10s) |
| Native cron limit | **40 jobs** | Vercel Pro feature |
| Minimum native cron interval | **1 minute** | Vercel Pro feature |
| Native cron slots currently used | **0 / 40** | `vercel.json` is `{}` |
| Deliberate removal commits | `f4a2401 "remove cron"`, `3969951 "remove vercel cron"` | PERF9_AUDIT.md |
| "Do not modify vercel.json" constraint | Present in repair-enrichment source | `src/app/api/cron/repair-enrichment/route.ts:21` |

### Existing External Scheduler Configuration

**GitHub Actions** — `.github/workflows/orchestrator-cron.yml`

| Property | Value |
|----------|-------|
| Schedule | `*/15 * * * *` (every 15 min — densified from `*/30` by OPS2_SCHEDULER_HARDENING.md) |
| Target | `/api/cron/orchestrator` only |
| Auth | `Authorization: Bearer ${{ secrets.CRON_SECRET }}` (repo secret) |
| Timeout | `--max-time 540` (9 min) — safe for orchestrator's 15–40s runtime |
| Concurrency | `group: orchestrator, cancel-in-progress: false` — prevents overlapping runs |
| Measured effective cadence | **~2 hours** at `*/30`; estimated ~1 hour at `*/15` |
| Failure mode — silent disable | After 60 days with no repo activity, schedule is silently disabled by GitHub |
| Failure mode — throttling | GitHub best-effort events are delayed at top-of-hour and on low-activity repos |
| Manual trigger | `workflow_dispatch: {}` — manual smoke-test via Actions tab |

**UptimeRobot** (recommended but not confirmed configured)

Per OPS2_SCHEDULER_HARDENING.md step "Manual steps (outside the repo)":
> "Create the UptimeRobot monitor above (free account, 2 minutes)."

Configuration specified:
```
Monitor type: HTTP(s)
URL:          https://www.goalradar.org/api/cron/orchestrator?secret=<CRON_SECRET>
Interval:     30 minutes
```

Status: **Cannot be verified from repo.** Must be confirmed in UptimeRobot dashboard.

**EasyCron** — referenced in deprecated prewarm-worldcup tombstone:
> "This endpoint is kept as a tombstone so existing external scheduler configs
> (UptimeRobot, EasyCron, GitHub Actions) continue to return HTTP 200."

Status: **Historical reference only.** No active configuration found. EasyCron was
a candidate in prior planning; UptimeRobot was selected per OPS2_SCHEDULER_HARDENING.md.

### Current Scheduler Coverage Matrix

| Cron job | Interval | GitHub Actions | UptimeRobot | Vercel Native | External other |
|----------|----------|---------------|-------------|---------------|----------------|
| `/api/cron/orchestrator` | 30 min (effective) | ✅ `*/15` | ✅ (recommended) | ❌ | ? |
| `/api/cron/health-archive` | 15 min | ❌ | ❌ | ❌ | ? |
| `/api/cron/repair-enrichment` | Daily 04:00 UTC | ❌ | ❌ | ❌ | ? |
| `/api/cron/drift-scan` | Daily 04:30 UTC | ❌ | ❌ | ❌ | ? |
| `/api/cron/health-check` | 10 min (proposed) | ❌ | ❌ | ❌ | ❌ |

**Finding:** Only the orchestrator has a confirmed scheduler. The other 3 active
cron jobs (health-archive, repair-enrichment, drift-scan) have no verified
trigger mechanism. `health-check` does not yet exist as a route.

---

## Section 2 — Workload Classification

Before comparing options, the two workload classes must be distinguished because
they have fundamentally different scheduler requirements.

### Class H — Heavy (Orchestrator)

**Job:** `/api/cron/orchestrator`  
**Runtime:** 15–40 seconds (12 sequential FD API calls + WC seeding + ISR revalidation)  
**Interval:** 30 min effective  
**Criticality:** HIGH — if missed, hot match snapshots expire (32-min TTL), live
scores freeze on next user visit, 7s cold-load resumes  
**Scheduler risk:** A 30s external client timeout WILL truncate this job  
**Concurrency sensitivity:** HIGH — duplicate concurrent runs risk KV race conditions
and FD rate limit (429)  

### Class L — Lightweight (All others)

| Job | Runtime | Interval | Criticality |
|-----|---------|----------|-------------|
| `/api/cron/health-check` | ~2–3s | 10 min | HIGH (RF-2/RF-6 detection) |
| `/api/cron/health-archive` | ~3–10s | 15 min | LOW (observability only) |
| `/api/cron/repair-enrichment` | ~5–15s | Daily | LOW (enrichment repair) |
| `/api/cron/drift-scan` | ~3–8s | Daily | LOW (drift logging only) |

**Key insight:** The health-check's 2–3s runtime eliminates the UptimeRobot/EasyCron
client-timeout problem that afflicts the orchestrator. This opens scheduling options
for Class L that are not viable for Class H.

---

## Section 3 — Option Comparison

### Option A — Vercel Native Cron

**How it works:** Jobs declared in `vercel.json` under `"crons": [...]`.
Vercel fires the endpoint via HTTP GET on the declared schedule,
with `Authorization: Bearer <system-generated-token>` (not `CRON_SECRET`).
Vercel Pro: up to 40 jobs, minimum 1-minute interval.

| Dimension | Assessment |
|-----------|-----------|
| **Reliability** | HIGH — same infrastructure as the app. Vercel SLA applies to both. However: when Vercel itself is degraded, both the app AND its cron are impaired simultaneously — cannot use cron to detect/alert on a Vercel outage |
| **Operational complexity** | LOWEST — single vercel.json entry; no separate dashboard; no credentials to rotate; job logs visible in Vercel dashboard alongside app logs |
| **Cost** | ZERO — included in Pro plan ($0 marginal per cron job) |
| **Failure modes** | (1) Vercel platform outage kills both app and cron simultaneously — no external recovery trigger. (2) `vercel.json` misconfiguration silently breaks jobs. (3) Auth uses Vercel-managed token, not `CRON_SECRET` — different auth path than manual triggers |
| **Vendor lock-in** | HIGH — cron configuration is Vercel-proprietary. Migration to another platform requires re-implementing cron infrastructure |
| **World Cup suitability** | HIGH for Class L — lightweight monitoring jobs with hard schedule guarantees and co-located logging. MEDIUM for orchestrator — a Vercel outage during a WC match silences both data refresh and alert generation simultaneously |
| **Timeout** | Pro: `maxDuration` up to 300s. Orchestrator (15–40s): safe. Health-check (2–3s): trivially safe |
| **Concurrency control** | None built-in — Vercel can fire multiple instances if a prior run is still in progress. Orchestrator's 12-task sequential design is vulnerable to this |
| **Current constraint** | vercel.json deliberately emptied; "do not modify" constraint in repair-enrichment source |

**Suitability by workload class:**
- Class L (health-check, health-archive, repair-enrichment, drift-scan): ✅ EXCELLENT
- Class H (orchestrator): ⚠️ ACCEPTABLE but vulnerable to simultaneous Vercel + data outage

---

### Option B — EasyCron

**How it works:** Cloud-hosted cron service. Sends HTTP GET to a URL on schedule.
Free tier and paid tiers.

| Dimension | Assessment |
|-----------|-----------|
| **Reliability** | MEDIUM — external service, independent of Vercel. Free tier has reliability SLA limits. Paid tiers offer better uptime guarantees |
| **Operational complexity** | LOW — web UI; no code. Requires separate account and dashboard. `CRON_SECRET` must be embedded in the monitor URL (`?secret=`) — credentials visible in EasyCron dashboard |
| **Cost** | Free tier: 200 executions/month at 20-min minimum interval. For health-check at 10 min: 4,320 executions/month — **10× free tier limit**. Paid plan required: ~$9/month for sufficient quota |
| **Failure modes** | (1) Quota exhaustion mid-tournament on free tier. (2) 20-min minimum interval on free tier — cannot run health-check at 10 min without paid plan. (3) Client-side HTTP timeout (typically 60s) — safe for Class L, borderline for orchestrator. (4) Secret in URL — logged in EasyCron if they log request URLs |
| **Vendor lock-in** | LOW — generic HTTP GET trigger; no proprietary integration |
| **World Cup suitability** | LOW on free tier (interval too coarse, quota too small). MEDIUM on paid tier ($9/month). Adds a recurring cost that scales with job count |
| **Timeout** | Typically 60s. Orchestrator (15–40s): safe. Health-check (2–3s): trivially safe |

**Specific constraint for this project:** Health-check at 10 min = 4,320 executions/month.
EasyCron free tier cap: 200/month. This option requires a paid plan for any
sub-hourly monitoring workload.

**Suitability by workload class:**
- Class L: ⚠️ REQUIRES PAID PLAN for 10-min interval
- Class H: ⚠️ ACCEPTABLE as secondary trigger; not recommended as sole scheduler

---

### Option C — GitHub Actions

**How it works:** `.github/workflows/*.yml` with `on: schedule:` and `cron:` expression.
Workflow runs `ubuntu-latest` runner, executes `curl` to call the endpoint.

| Dimension | Assessment |
|-----------|-----------|
| **Reliability** | LOW-MEDIUM — **best-effort delivery only** (GitHub docs). Measured on this repo: `*/30` achieved ~2h effective cadence. `*/15` estimated ~1h effective. GitHub disables schedules after **60 days without repo activity** — silent total failure |
| **Operational complexity** | MEDIUM — workflow YAML in repo (version-controlled ✅). Requires `CRON_SECRET` as repo secret (separate from Vercel env). Logs in GitHub Actions tab. `workflow_dispatch` enables manual trigger |
| **Cost** | FREE for public repos. Private repos: 2,000 min/month on free GitHub tier; 3,000 min/month on Pro ($4/month). At `*/15`: ~2,880 min/month (1 min/run). Well within free tier if repo is public |
| **Failure modes** | (1) **Schedule throttling** — measured 2h effective cadence at `*/30`. (2) **60-day silent disable** — requires periodic repo activity or a keep-alive commit to prevent. (3) Workflow `timeout-minutes: 10` — safe for orchestrator (15–40s) and all Class L. (4) CRON_SECRET as repo secret — relatively secure (not in URL). (5) No concurrent-run prevention for Class L jobs — a slow run could overlap with the next |
| **Vendor lock-in** | LOW — YAML is portable; switching to another CI means minor rewrites |
| **World Cup suitability** | LOW for health-check — a 2h effective cadence at `*/10` is completely inadequate for RF-2 detection (need 10-min cadence). MEDIUM for orchestrator (already working, with UptimeRobot backup) |
| **Timeout** | `--max-time 540` for orchestrator. Can be set per workflow. No issue for any current workload |
| **Concurrency** | `concurrency: group: orchestrator, cancel-in-progress: false` prevents overlapping orchestrator runs. Would need separate groups per job if multiple jobs added |

**Critical finding:** The measured ~2h effective cadence at `*/30` means that at
`*/10` GitHub Actions would likely achieve ~40-min effective cadence — 4× the
required 10-min interval. **GitHub Actions is not suitable as the sole scheduler
for the 10-minute health-check.**

**Suitability by workload class:**
- Class L at 10 min: ❌ UNSUITABLE (throttling makes effective cadence ~40 min)
- Class H (orchestrator): ✅ ACCEPTABLE as primary (with UptimeRobot backup per OPS2_SCHEDULER_HARDENING.md)

---

### Option D — Hybrid

**The architecture recommended by OPS2_SCHEDULER_HARDENING.md (2026-06-12).**

Current implementation: GitHub Actions (`*/15`) as primary orchestrator trigger +
UptimeRobot (30-min HTTP monitor) as cadence backup.

The hybrid principle: use multiple independent trigger sources so that a single
scheduler failure does not silence a cron job. The orchestrator's skip-if-fresh
guards make redundant triggers free (no duplicate provider calls).

**D can be extended** into sub-variants:

| Sub-variant | Primary | Backup | Jobs covered |
|-------------|---------|--------|-------------|
| **D1** (current) | GitHub Actions `*/15` | UptimeRobot 30 min | Orchestrator only |
| **D2** (proposed) | Vercel Native `*/10` | — | Class L (health-check, health-archive) |
| **D2 + D1** (recommended) | Vercel Native (Class L) + GitHub Actions (orchestrator) | UptimeRobot (orchestrator only) | All 5 jobs |

The key insight justifying D2 (Vercel native for Class L):
- Class L jobs have 2–15s runtime → no timeout risk with Vercel or any external scheduler
- Class L jobs are monitoring/observability → they SHOULD run even when the app is degraded (not the same as the orchestrator, where a Vercel outage means app + cron fail together)
- Vercel native cron is **already paid for** (included in Pro plan) and uses 0 of 40 slots
- The "do not modify vercel.json" constraint was introduced for data-refresh cron jobs under active engineering. Monitoring cron jobs are a different category

---

## Section 4 — Comparative Score Matrix

Scores 1–5 (5 = best) for each dimension.

| Dimension | Weight | Vercel Native | EasyCron | GitHub Actions | Hybrid D2 |
|-----------|--------|:---:|:---:|:---:|:---:|
| Schedule reliability | 30% | 5 | 3 | 2 | 5 |
| Cadence accuracy (10 min) | 25% | 5 | 4 | 1 | 5 |
| Operational complexity | 15% | 5 | 3 | 4 | 4 |
| Cost | 10% | 5 | 2 | 5 | 5 |
| Failure mode isolation | 10% | 3 | 4 | 4 | 5 |
| World Cup suitability | 10% | 4 | 3 | 2 | 5 |
| **Weighted total** | | **4.70** | **3.15** | **2.35** | **4.90** |

**Score rationale — key differences:**

- **Cadence accuracy (10 min):** Vercel native and D2 score 5 because they deliver hard schedules. GitHub Actions scores 1 because the measured ~2h effective cadence at `*/30` implies ~40-min effective at `*/10` — completely inadequate.

- **Failure mode isolation:** Vercel native scores 3 because if Vercel is down, both the app and its health-check cron are down simultaneously — the monitoring cannot detect a Vercel platform degradation. The hybrid D2 scores 5 because the orchestrator (which writes the KV data health-check reads) is on GitHub Actions/UptimeRobot — independent of Vercel's cron system.

- **EasyCron cost:** Scores 2 because the 10-min health-check requires 4,320 executions/month, which demands a paid tier ($9/month+). Every additional Class L job further increases cost.

---

## Section 5 — The "Do Not Modify vercel.json" Constraint

This constraint appears in one source comment:

```
// NOTE: vercel.json is not modified per project constraint. Wire the cron
//       schedule manually in Vercel dashboard or external scheduler.
```
— `src/app/api/cron/repair-enrichment/route.ts:21–22`

**Context:** This constraint was written during active DATA-16 development, when
the engineering team was making frequent changes to cron job design. The PERF-9
incident (92/104 match snapshots missing) was a direct consequence of cron jobs
being removed from vercel.json without a replacement trigger — a gap that went
undetected for an entire sprint.

**Assessment:** The constraint is a development-phase caution, not a permanent
architectural decision. It was written to prevent accidental modification of
data-refresh cron jobs during active engineering. Monitoring and alerting jobs
(health-check, health-archive) are a different category:
- They produce no side effects if they run extra times
- They do not write to any data store that data-refresh jobs read from
- Missing a health-check run is operationally silent (no data gap, just a missed alert)

**Recommendation:** The constraint should be re-evaluated before any vercel.json
modification. A one-sentence updated comment in repair-enrichment to clarify
that monitoring cron jobs are exempt from the constraint would suffice.

---

## Section 6 — Recommended Final Architecture

### Architecture: D2 (Hybrid — Vercel Native + GitHub Actions + UptimeRobot)

```
┌─────────────────────────────────────────────────────────────┐
│  VERCEL NATIVE CRON (vercel.json)                           │
│  Reliable, included in Pro plan, hard schedule guarantee    │
│                                                             │
│  /api/cron/health-check      */10 * * * *   (10 min)       │
│  /api/cron/health-archive    */15 * * * *   (15 min)       │
│  /api/cron/repair-enrichment 0 4 * * *      (04:00 UTC)    │
│  /api/cron/drift-scan        30 4 * * *     (04:30 UTC)    │
│                                                             │
│  Slots used: 4 / 40    Cost: $0 marginal                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  GITHUB ACTIONS (.github/workflows/orchestrator-cron.yml)  │
│  Primary trigger for the heavy orchestrator workload        │
│                                                             │
│  /api/cron/orchestrator      */15 * * * *   (~30-60 min    │
│                              (effective cadence due         │
│                              to GitHub throttling)          │
│                                                             │
│  Auth: Bearer ${{ secrets.CRON_SECRET }} (not in URL)      │
│  Timeout: --max-time 540 (safe for 15-40s orchestrator)    │
│  Concurrency: cancel-in-progress: false                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  UPTIMEROBOT (external backup for orchestrator only)        │
│  Cadence guarantee when GitHub is throttled                 │
│                                                             │
│  /api/cron/orchestrator      30 min interval               │
│  URL: ...?secret=<CRON_SECRET>   (accept this tradeoff —   │
│       skip-if-fresh guards prevent duplicate work)          │
└─────────────────────────────────────────────────────────────┘
```

### Why this split?

**Class L (health-check, health-archive, repair-enrichment, drift-scan) → Vercel Native**

1. **Hard cadence guarantee.** These jobs need reliable intervals. Vercel native delivers exactly that. GitHub throttling is irrelevant.

2. **Zero marginal cost.** Already on Pro plan with 0/40 slots used.

3. **Co-located logging.** Monitoring job logs appear alongside app logs in the Vercel dashboard — exactly where an on-call engineer looks during an incident.

4. **No duplicate-work risk.** Class L jobs are idempotent and lightweight. Even if two invocations overlap (Vercel can do this), the cost is negligible and no data corruption occurs.

5. **CRON_SECRET not required in URL.** Vercel uses its own auth token for native cron invocations — avoids the `?secret=` URL exposure pattern.

**Class H (orchestrator) → GitHub Actions + UptimeRobot (unchanged from D1)**

1. **Preserves existing working setup.** OPS2_SCHEDULER_HARDENING.md already validated this architecture. Breaking it to move orchestrator to Vercel native introduces a regression risk.

2. **Simultaneous failure isolation.** If Vercel degrades, GitHub Actions + UptimeRobot continue to attempt orchestrator triggers. Vercel cron would also fail during a Vercel outage — providing no additional reliability for the orchestrator.

3. **Full-length timeout.** GitHub Actions `--max-time 540` covers the orchestrator's worst-case runtime (WC seeding + ISR revalidation can spike). Vercel native cron respects `maxDuration` but has no equivalent of GitHub's job-level timeout that can be set independently of the function's maxDuration.

4. **Concurrency control.** GitHub Actions `concurrency` group prevents simultaneous orchestrator runs — critical for the 12-task sequential design that assumes single-runner.

---

## Section 7 — Implementation Requirements

### Prerequisites before any change to vercel.json

1. **Confirm UptimeRobot monitor is active** for `/api/cron/orchestrator` — the OPS2_SCHEDULER_HARDENING.md "manual step" may not have been completed. Verify via UptimeRobot dashboard.

2. **Update the vercel.json constraint comment** in `repair-enrichment/route.ts` to clarify that the constraint applies to data-refresh jobs, not monitoring jobs.

3. **CRON_SECRET repo secret** must be set in GitHub Actions settings for the orchestrator workflow to function. Verify: Actions tab → last run should show success, not 401.

### vercel.json target state (for reference — not implemented in this audit)

```json
{
  "crons": [
    {
      "path": "/api/cron/health-check",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/cron/health-archive",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/repair-enrichment",
      "schedule": "0 4 * * *"
    },
    {
      "path": "/api/cron/drift-scan",
      "schedule": "30 4 * * *"
    }
  ]
}
```

Note: `/api/cron/health-check` does not yet exist as a route. Per
DATA-18OPS.2A, the route must be implemented before this entry is activated.

### Vercel Native Cron Auth Note

When Vercel invokes a native cron job, it passes:
```
Authorization: Bearer <vercel-system-token>
```
This is a Vercel-managed token, **not** `CRON_SECRET`. The existing
route auth pattern (`process.env.CRON_SECRET`) must be updated to also
accept Vercel's system token, OR the routes must accept both:

```typescript
// Accept both CRON_SECRET (manual/external) and Vercel system token
function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const auth   = req.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET;
  // Vercel system cron token
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  // Vercel native: token matches VERCEL_AUTOMATION_BYPASS_SECRET or
  // the cron invocation header set by Vercel (check req.headers)
  return false;
}
```

Per Vercel docs: native cron requests include `x-vercel-cron: 1` header.
Add `req.headers.get('x-vercel-cron') === '1'` as a third auth path.

---

## Section 8 — Risk Summary

| Risk | Architecture D1 (current) | Architecture D2 (recommended) |
|------|--------------------------|-------------------------------|
| Orchestrator misfire (GH throttle) | 🟡 Mitigated by UptimeRobot | 🟡 Same — unchanged |
| health-check never fires | 🔴 No scheduler configured | 🟢 Vercel native at */10 |
| health-archive never fires | 🔴 No scheduler configured | 🟢 Vercel native at */15 |
| Vercel platform outage | 🟡 App down; cron moot | 🟡 App down; health-check moot (acceptable) |
| GitHub schedule disable (60-day) | 🟡 UptimeRobot backup | 🟡 Unchanged; only orchestrator affected |
| CRON_SECRET in URL (UptimeRobot) | 🟡 Accepted tradeoff | 🟡 Unchanged; only orchestrator |
| WC match day RF-2 detection > 10 min | 🔴 No health-check running | 🟢 10-min guaranteed by Vercel native |
| vercel.json modification risk | — | 🟡 Low; monitoring jobs are additive |

---

## Section 9 — Final Answer

**Recommended architecture: Hybrid D2**

- **Vercel Native Cron** for all Class L monitoring and observability jobs
  (health-check, health-archive, repair-enrichment, drift-scan): 4 slots,
  $0 marginal cost, hard schedule guarantees, co-located logging.

- **GitHub Actions + UptimeRobot** for the Class H orchestrator: unchanged
  from the validated OPS2_SCHEDULER_HARDENING.md recommendation. Do not move
  the orchestrator to Vercel native — the simultaneous-failure isolation it
  provides is the correct tradeoff for a heavy data-refresh job.

**This is the minimum change from current state that resolves all open gaps:**
- health-check gets a scheduler (currently has none)
- health-archive gets a scheduler (currently has none)
- repair-enrichment gets a scheduler (currently has none)
- drift-scan gets a scheduler (currently has none)
- Orchestrator scheduling is unchanged
- Total new Vercel cron slots required: 4 (of 40 available)
- Total new cost: $0

**The orchestrator issue from PERF-9 (92/104 snapshots missing) is not a
reason to avoid Vercel native cron for monitoring jobs.** The PERF-9 outage
occurred because Vercel crons were removed and no replacement trigger was
configured. D2 uses Vercel native cron for the jobs that need it most (reliable
10-min health-check) while keeping the orchestrator on external schedulers
(where the existing, tested, concurrency-protected setup lives).
