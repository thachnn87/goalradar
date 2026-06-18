# DATA-18OPS.2B.1 — Scheduler Verification

Audit date: 2026-06-18T09:00–09:05 UTC  
Version: DATA-18OPS.2B.1  
Method: Production endpoint queries + file inspection. No assumptions. No inferences from code alone.

---

## Evidence Collection Log

All endpoint queries were made with `Authorization: Bearer <CRON_SECRET>` against
`https://www.goalradar.org`. Response bodies are included verbatim where relevant.

| Evidence source | Method | Result |
|----------------|--------|--------|
| `/api/debug/prewarm-status` | HTTP GET with CRON_SECRET | HTTP 200 — full orchestrator last-run record |
| `/api/debug/reliability` | HTTP GET with CRON_SECRET | HTTP 200 — archive.size=0, observations=0 |
| `/api/debug/enrichment-health` | HTTP GET with CRON_SECRET | HTTP 200 — 24 matches, 0 degraded |
| `/api/debug/authority-drift` | HTTP GET with CRON_SECRET | HTTP 200 — 24 finished, 1 YELLOW |
| `/api/debug/feed-integrity` | HTTP GET with CRON_SECRET | HTTP 200 — FINISHED feed age 3.7h |
| `/api/debug/incident-history` | HTTP GET with CRON_SECRET | HTTP 200 — archiveSize=0 |
| `/api/debug/slo-compliance` | HTTP GET with CRON_SECRET | HTTP 200 — observations=null, no archive |
| Vercel CLI (`npx vercel whoami`) | Shell | Prompted for device-flow login — NOT AUTHENTICATED |
| `vercel.json` | File read | `{}` (empty) |
| `.github/workflows/` | Directory listing | Single file: `orchestrator-cron.yml` |
| `.vercel/project.json` | File read | Does not exist |

---

## Section 1 — Vercel Plan and Native Cron Capability

### Verification attempt

**Method:** `npx vercel whoami` (Vercel CLI v54.14.2 installed via npx)

**Result:**
```
> No existing credentials found. Starting login flow...
> Visit https://vercel.com/oauth/device?user_code=VGMH-TLHF
Waiting for authentication...
Error: The user aborted a request.
```

**Conclusion:** Vercel CLI is not authenticated in this environment. The device
flow was interrupted. No dashboard data is accessible.

### Native cron configuration

**Source:** `vercel.json` (file read, 2026-06-18)

```json
{}
```

**Conclusion:** Zero native Vercel cron jobs are currently configured, regardless
of plan. The file is intentionally empty (deliberate commits: `f4a2401 "remove cron"`,
`3969951 "remove vercel cron"` per PERF9_AUDIT.md).

### Verdict

| Question | Answer | Evidence source |
|----------|--------|----------------|
| Actual Vercel plan | **UNVERIFIABLE** | Vercel CLI requires authentication |
| Vercel Cron available on plan | **UNVERIFIABLE** | Same |
| Vercel Cron slots limit | **UNVERIFIABLE** | Same |
| Native cron jobs currently active | **0** | vercel.json = `{}` |

> Dashboard access is required to verify the plan tier. This audit cannot
> substitute code inspection for dashboard evidence as instructed.

---

## Section 2 — Orchestrator (`/api/cron/orchestrator`)

### Scheduler configuration

**Source:** `.github/workflows/orchestrator-cron.yml` (created 2026-06-12)

```yaml
on:
  schedule:
    - cron: '*/15 * * * *'
  workflow_dispatch: {}
```

**GitHub Actions workflow files present:** 1 (only `orchestrator-cron.yml`)

### Execution evidence

**Source:** `GET /api/debug/prewarm-status` — 2026-06-18T09:00:45 UTC

Raw response (key fields):

```json
{
  "checkedAt": "2026-06-18T09:00:45.350Z",
  "kvEnabled": true,
  "lastRun": {
    "timestamp": "2026-06-18T05:20:06.601Z",
    "elapsedMs": 112565,
    "ok": 13,
    "failed": 0,
    "total": 13,
    "triggeredBy": "header",
    "seededMatches": 103,
    "coveragePercent": 99,
    "seedErrors": []
  },
  "secondsSinceLastRun": 13238
}
```

**Key data points:**

| Field | Value | Interpretation |
|-------|-------|----------------|
| `lastRun.timestamp` | 2026-06-18T05:20:06.601Z | Last confirmed successful run |
| `secondsSinceLastRun` | 13,238s | 3.67 hours before audit at 09:00 UTC |
| `lastRun.ok` | 13 / 13 | All tasks completed successfully |
| `lastRun.failed` | 0 | No task failures |
| `lastRun.elapsedMs` | 112,565ms | 1 min 52 sec total runtime |
| `lastRun.triggeredBy` | `"header"` | **Bearer token auth — matches GitHub Actions pattern** |
| `lastRun.seededMatches` | 103 | WC match seeding succeeded |
| `lastRun.coveragePercent` | 99 | 103 of 104 WC match snapshots seeded |

**Trigger source determination:**

The orchestrator has two auth paths:
- `Authorization: Bearer <CRON_SECRET>` (GitHub Actions — `triggeredBy: "header"`)
- `?secret=<CRON_SECRET>` (UptimeRobot/external — `triggeredBy: "queryparam"`)

`triggeredBy: "header"` confirms the **last run was triggered by GitHub Actions**,
not UptimeRobot. UptimeRobot (if configured) would show `"queryparam"`.

**UptimeRobot backup status:** NOT CONFIRMED. The recommended manual setup step
from OPS2_SCHEDULER_HARDENING.md may not have been completed. The last run's
trigger source provides no evidence that UptimeRobot is active.

### Run frequency analysis

**24h count:** UNVERIFIABLE. The prewarm-status KV record stores only the most
recent run. No GitHub Actions API access is available to retrieve run history.

**7d count:** UNVERIFIABLE. Same reason.

**Effective cadence observation:** The last run was 3.67 hours before the audit.
The `wc-finished` feed age corroborates this: 3.7 hours old (from
`/api/debug/feed-integrity`). This is consistent with the ~2–4h measured effective
cadence at `*/15` documented in OPS2_SCHEDULER_HARDENING.md.

### Scheduler coverage

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Implemented | ✅ YES | `src/app/api/cron/orchestrator/route.ts` |
| Scheduled | ✅ YES | GitHub Actions `*/15` in `orchestrator-cron.yml` |
| Verified executing | ✅ YES | KV record: last run 2026-06-18T05:20:06 UTC |
| Last successful run | 2026-06-18T05:20:06 UTC | `/api/debug/prewarm-status` |
| Evidence source | KV prewarm record | Direct API query |

**Status: 🟢 GREEN**

---

## Section 3 — Health-Archive (`/api/cron/health-archive`)

### Scheduler configuration

**GitHub Actions:** No workflow file exists for this job.  
`.github/workflows/` contains only `orchestrator-cron.yml`.

**Vercel native cron:** Not configured (`vercel.json = {}`).

**External scheduler:** Route comment states:
```
// Schedule: every 15 min (recommended), wired in Vercel dashboard:
//   Path:     /api/cron/health-archive
//   Schedule: every 15 minutes  (or hourly for lighter retention)
```
No confirmation that this was wired. `vercel.json` is empty.

### Execution evidence

**Source 1:** `GET /api/debug/reliability` — 2026-06-18T09:02:11 UTC

```json
{
  "archive": {
    "size": 0,
    "oldestAt": null,
    "newestAt": null
  },
  "note": "No archive yet — verdict reflects live checks only. Wire /api/cron/health-archive for historical evidence."
}
```

**Source 2:** `GET /api/debug/slo-compliance` — 2026-06-18T09:04:57 UTC

```json
{
  "observations": null,
  "sloMet": null,
  "note": "Health archive empty — wire /api/cron/health-archive to begin recording. Compliance defaults to 100% with zero observations."
}
```

**Source 3:** `GET /api/debug/incident-history` — 2026-06-18T09:04:58 UTC

```json
{
  "archiveSize": 0,
  "incidents24h": { "incidents": 0, "red": 0, "yellow": 0 },
  "incidents7d": { "incidents": 0, "red": 0, "yellow": 0 },
  "incidents30d": { "incidents": 0, "red": 0, "yellow": 0 },
  "lastRedIncident": null,
  "lastYellowIncident": null,
  "note": "Health archive empty — wire /api/cron/health-archive to begin recording."
}
```

**Source 4:** SLO windows from `/api/debug/reliability`:

```json
"slo": {
  "24h":  { "observations": 0 },
  "7d":   { "observations": 0 },
  "30d":  { "observations": 0 }
}
```

The `health-archive` route writes records to KV ZSET `goalradar:health:archive`
via `appendHealthRecord()`. The ZSET has `size = 0`. This is definitive:
**the job has never successfully executed in any production deployment.**

### Scheduler coverage

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Implemented | ✅ YES | `src/app/api/cron/health-archive/route.ts` |
| Scheduled | ❌ NOT CONFIRMED | No GitHub Actions workflow; vercel.json empty |
| Verified executing | ❌ NEVER RUN | archive.size=0; 0 SLO observations across all windows |
| Last successful run | NONE | Three independent KV reads all return null/0 |
| Evidence source | KV ZSET `goalradar:health:archive` | Direct API query |

**Status: 🔴 RED**

---

## Section 4 — Repair-Enrichment (`/api/cron/repair-enrichment`)

### Scheduler configuration

**GitHub Actions:** No workflow file exists for this job.  
**Vercel native cron:** Not configured (`vercel.json = {}`).  
**External scheduler:** Route comment states "run daily via an external cron scheduler
or Vercel Cron" — no confirmation of configuration.

### Execution evidence

**No persistent KV run record.** This route writes KV mutations only when
degraded matches are found (invalidating snapshots). It writes no run
timestamp, no run counter, and no status record to KV.

**Indirect evidence attempt:**

`GET /api/debug/enrichment-health` — 2026-06-18T09:04:22 UTC:

```json
{
  "total": 24,
  "ok": 24,
  "unenriched": 0,
  "degradedIds": []
}
```

All 24 finished WC matches show enrichment OK with goals data present. However,
this does not confirm that repair-enrichment ran. The orchestrator's
`prewarmWorldCup()` seed process also seeds match enrichment data. The current
clean state is consistent with either:
- repair-enrichment running and fixing past degradation, OR
- The orchestrator seed process handling all enrichment without repair-enrichment

This indirect evidence is inconclusive. **No direct execution evidence exists.**

### Scheduler coverage

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Implemented | ✅ YES | `src/app/api/cron/repair-enrichment/route.ts` |
| Scheduled | ❌ NOT CONFIRMED | No GitHub Actions workflow; vercel.json empty |
| Verified executing | ⚠️ UNVERIFIABLE | No KV run record; no execution artifact exists |
| Last successful run | UNKNOWN | No evidence in any accessible data source |
| Evidence source | — | No evidence available |

**Status: 🔴 RED** (no scheduler confirmed; execution unverifiable)

> Note on `UNVERIFIABLE` vs `NEVER RUN`: health-archive can be positively
> confirmed as NEVER RUN because its KV ZSET is empty — every successful run
> writes to this ZSET. Repair-enrichment's route does NOT write any run record,
> so UNVERIFIABLE is the honest classification: the job may or may not have run;
> there is no way to tell from available evidence.

---

## Section 5 — Drift-Scan (`/api/cron/drift-scan`)

### Scheduler configuration

**GitHub Actions:** No workflow file exists for this job.  
**Vercel native cron:** Not configured (`vercel.json = {}`).  
**External scheduler:** Route comment states "Wire in Vercel dashboard or external
scheduler" — no confirmation.

### Execution evidence

**No persistent KV run record.** This route writes exclusively to console logs
(`console.log`, `console.warn`, `console.error`). It performs no KV writes and
produces no queryable artifact. Vercel function logs are not accessible without
Vercel CLI authentication (which was unavailable for this audit).

**Indirect evidence attempt:**

If drift-scan had run at 04:30 UTC today (its scheduled time), it would have
produced Vercel log entries like:
```
[DriftScan] SUMMARY total=24 green=23 yellow=1 red=0
```

These logs cannot be retrieved without Vercel dashboard or API access. No
secondary signal (KV write, metric, or API artifact) exists.

### Scheduler coverage

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Implemented | ✅ YES | `src/app/api/cron/drift-scan/route.ts` |
| Scheduled | ❌ NOT CONFIRMED | No GitHub Actions workflow; vercel.json empty |
| Verified executing | ⚠️ UNVERIFIABLE | Console-log only; no KV artifact; Vercel logs require auth |
| Last successful run | UNKNOWN | No evidence in any accessible data source |
| Evidence source | — | No evidence available |

**Status: 🔴 RED** (no scheduler confirmed; execution unverifiable)

---

## Section 6 — Scheduler Coverage Matrix

Audit timestamp: 2026-06-18T09:05 UTC

| Endpoint | Implemented | Scheduled (confirmed) | Verified executing | Last successful run | Evidence source | Status |
|----------|:-----------:|:---------------------:|:-----------------:|:-------------------:|----------------|:------:|
| `/api/cron/orchestrator` | ✅ | ✅ GitHub Actions `*/15` | ✅ | 2026-06-18T05:20:06 UTC | KV prewarm record | 🟢 GREEN |
| `/api/cron/health-archive` | ✅ | ❌ None confirmed | ❌ NEVER RUN | — | KV ZSET size=0 | 🔴 RED |
| `/api/cron/repair-enrichment` | ✅ | ❌ None confirmed | ⚠️ UNVERIFIABLE | UNKNOWN | No KV artifact | 🔴 RED |
| `/api/cron/drift-scan` | ✅ | ❌ None confirmed | ⚠️ UNVERIFIABLE | UNKNOWN | No KV artifact | 🔴 RED |
| `/api/cron/health-check` | ❌ NOT IMPLEMENTED | — | — | — | — | — |
| `/api/cron/prewarm-worldcup` | ✅ (tombstone) | — | N/A (deprecated) | N/A | Route is HTTP 200 stub | ⚪ DEPRECATED |

---

## Section 7 — Dead Jobs

Jobs that exist in code but have no confirmed execution history:

### 1. `/api/cron/health-archive` — CONFIRMED DEAD

**Evidence:** KV ZSET `goalradar:health:archive` has size=0. Every successful
execution appends to this ZSET. Zero entries = zero executions, ever.

**Impact:** No health archive data exists. SLO compliance tracking shows 0
observations across all windows (24h, 7d, 30d). Incident detection, trend
analysis, and SLO reporting are non-functional. The reliability endpoint's
`verdict: RED` is currently based on live checks only — historical incident
detection does not exist.

**Scheduler gap:** No GitHub Actions workflow. Not in vercel.json.
Route comment says "wired in Vercel dashboard" — not verifiable; vercel.json
is empty.

### 2. `/api/cron/repair-enrichment` — UNCONFIRMED (presumed dead)

**Evidence:** No KV run record. No GitHub Actions workflow. Not in vercel.json.
Route comment says "external cron scheduler or Vercel Cron" with no confirmed
configuration. `CRON_SECRET_USAGE_REPORT.md` (prior audit): "No EasyCron/
UptimeRobot/cron-job.org configuration exists anywhere in the repo."

**Impact:** Unknown. The orchestrator's prewarm process handles enrichment
seeding — the current 0-degraded-match state may be a result of the orchestrator
alone. If a batch of enrichment failures occurred after the orchestrator's
last seeding run, repair-enrichment is not available to catch it overnight.

**Note on classification:** Unlike health-archive (positively confirmed dead via
KV), repair-enrichment's dead status is classified as "presumed dead" — the
absence of a scheduler is confirmed; the absence of ever executing cannot be
confirmed because the route leaves no KV artifact.

### 3. `/api/cron/drift-scan` — UNCONFIRMED (presumed dead)

**Evidence:** No KV run record. No GitHub Actions workflow. Not in vercel.json.
Console-log only route — leaves no queryable artifact. Vercel logs require
authenticated CLI access not available in this audit.

**Impact:** Unknown. Authority-vs-snapshot drift is currently detectable via
`/api/debug/authority-drift` (live query), but the scheduled nightly scan at
04:30 UTC is designed to detect and log cumulative drift over time. Without
execution, no drift history is available.

### 4. `/api/cron/prewarm-worldcup` — DEPRECATED TOMBSTONE

This route is intentionally a no-op. It returns HTTP 200 with:
```json
{ "deprecated": true, "redirect": "/api/cron/orchestrator" }
```
Not a dead job in the operational sense — its function was merged into the
orchestrator. Included for completeness.

---

## Section 8 — Unverifiable Items

The following items were requested but could not be verified with available evidence:

| Item | Reason not verifiable | What would provide evidence |
|------|-----------------------|----------------------------|
| Vercel plan tier | Vercel CLI not authenticated; no API token | Vercel dashboard → Settings → Billing |
| Vercel Cron slot limit | Depends on plan tier (unverifiable) | Same |
| Orchestrator 24h run count | prewarm-status stores only last run; no GitHub API | GitHub Actions run history via `gh run list` |
| Orchestrator 7d run count | Same | Same |
| UptimeRobot backup active | External service; no config in repo; last run used "header" auth (GitHub), not "queryparam" (UptimeRobot) | UptimeRobot dashboard |
| Drift-scan any execution ever | Console-log only, no KV artifact | Vercel function logs (requires auth) |
| Repair-enrichment any execution ever | Console-log only, no KV artifact | Vercel function logs (requires auth) |

---

## Section 9 — Findings Summary

### FINDING-1: health-archive is confirmed to have never run (CRITICAL)

The health-archive job is fully implemented and correct but has **no configured
trigger**. The KV ZSET `goalradar:health:archive` is empty — confirmed by three
independent endpoints. The SLO compliance, incident detection, and reliability
trending systems are entirely non-functional as a result. These are the
monitoring foundations required before World Cup operational use.

### FINDING-2: repair-enrichment and drift-scan have no confirmed schedulers (HIGH)

Neither job has a GitHub Actions workflow. Neither is in vercel.json. No external
scheduler configuration exists in the repo. Per `CRON_SECRET_USAGE_REPORT.md`
(prior audit): "No EasyCron/UptimeRobot/cron-job.org configuration exists
anywhere in the repo." Both jobs' route comments describe a scheduler that was
supposed to be wired in the Vercel dashboard — but vercel.json is empty and
cannot be verified without dashboard auth. These jobs are likely not running.

### FINDING-3: The orchestrator is the only confirmed running cron job (INFORMATIONAL)

The orchestrator IS running, verified by the KV prewarm record. Last run:
2026-06-18T05:20:06 UTC, 13/13 tasks OK, 99% WC match coverage. The trigger
source was GitHub Actions (Bearer header auth). The 3.67-hour gap since the
last run is consistent with the measured 2–4h effective GitHub Actions cadence.

### FINDING-4: UptimeRobot backup cannot be confirmed (MEDIUM)

The last orchestrator run used `triggeredBy: "header"` (GitHub Actions).
UptimeRobot would appear as `"queryparam"`. Either UptimeRobot is not configured
(the manual setup step was not completed) or GitHub Actions happened to run most
recently. There is no confirmatory evidence that UptimeRobot is active.

### FINDING-5: Vercel plan and cron limits are unverifiable from this environment (INFORMATIONAL)

The Vercel CLI was not authenticated. No VERCEL_TOKEN was available. Dashboard
evidence for the plan tier cannot be obtained from this environment. The
DATA-18OPS.2B architecture recommendation (Architecture D2) remains conditional
on the plan providing at least 4 native cron slots.

---

## Section 10 — Status Summary

```
/api/cron/orchestrator     🟢 GREEN   — confirmed running, last 2026-06-18T05:20 UTC
/api/cron/health-archive   🔴 RED     — no scheduler; confirmed NEVER RUN (archive.size=0)
/api/cron/repair-enrichment 🔴 RED    — no scheduler confirmed; execution UNVERIFIABLE
/api/cron/drift-scan        🔴 RED    — no scheduler confirmed; execution UNVERIFIABLE
/api/cron/health-check      —         — route does not yet exist
/api/cron/prewarm-worldcup  ⚪ DEPR   — deprecated tombstone, HTTP 200 no-op

Vercel plan:                ❓ UNVERIFIABLE (dashboard access required)
Vercel native cron active:  0 jobs configured (vercel.json = {})
GitHub Actions workflows:   1 (orchestrator only)
```
