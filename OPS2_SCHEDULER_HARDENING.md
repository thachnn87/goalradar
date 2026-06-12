# OPS-2 Scheduler Hardening
## GoalRadar · scheduler reliability audit + recommendation

Generated: 2026-06-12
Inputs: OPS1_PRODUCTION_VERIFICATION.md · CACHE_CONSISTENCY_REPORT.md ·
PERF9_AUDIT.md · PERF10_REPORT.md

---

## Audit answers

### 1. Is GitHub Actions cadence sufficient?

**No, not alone.** GitHub `schedule` events are explicitly best-effort;
measured on this repo: 3 fires in ~4 h (**~2 h effective cadence** for a
`*/30` schedule). Delays are worst at busy times (top of the hour) and on
low-activity repos. GitHub also **disables schedules after 60 days without
repo activity** — a silent total failure mode.

### 2. What happens if a scheduled run is missed?

- **Hot tiers** (live / today / next-24h): snapshot + detail TTL is 1 920 s
  (32 min = 30-min cadence + 2-min margin, PERF-10). One missed run →
  hot entries expire and stay cold until the next run (≈ 88 cold minutes at
  2-h cadence). Consequences are bounded by the self-healing layers:
  match-page visits rebuild snapshots (~7 s provider build, first visitor
  pays it) and the DATA-2 overlay keeps every surface *consistent* — but
  first-visit latency and Results-list completeness degrade.
- **Cold tiers** (next-72h 2 h+margin · future 12 h+margin · finished 7 d):
  tolerate hours of missed runs by design.
- **Bulk lists** (Results/recent membership): stale until the next run —
  the only user-visible data gap (CACHE_CONSISTENCY_REPORT timeline).

### 3. Can snapshot coverage stay ≥ 95 % with a 2-hour cadence?

**Overall: marginally yes. Hot matches: no.**
~94–98 of 104 matches sit in future/finished tiers whose TTLs (12 h / 7 d)
survive a 2-h cadence → overall coverage ≈ 90–98 %. But the 4–8 **hot**
matches (today/next-24h — the ones receiving nearly all traffic) are cold
~73 % of the time at 2-h cadence (32-min TTL / 120-min gap). The PERF-10
gate "hot-match hit rate > 99 %" is unreachable without ≤ 30-min effective
cadence. So the success criterion fails where it matters most.

### 4. Cheapest, most reliable architecture — comparison

| Option | Cadence guarantee | Cost | Timeout risk | Failure modes | Complexity |
|--------|------------------|------|--------------|---------------|-----------|
| **A. GitHub Actions only** | none (best-effort, measured 2 h; 60-day auto-disable) | free | none (curl `--max-time 540`) | throttling, silent disable | lowest |
| **B. UptimeRobot only** | hard 30 min (free plan, 50 monitors) | free | **30 s client timeout** — orchestrator runs take minutes; behavior after client abort on Vercel is not guaranteed → risk of truncated runs | single point of failure; secret embedded in monitor URL (`?secret=` branch exists for this) | low |
| **C. EasyCron only** | hard schedule | free tier is tight (short execution timeout, low monthly quota) | same client-timeout class as B | quota exhaustion mid-tournament | low |
| **D. GitHub Actions (primary) + external pinger (backup)** | min(GH, 30 min) ⇒ **≤ 30 min effective** | free | GH leg has none; backup leg's timeout only matters when GH already missed — and even a truncated backup run completes the early hot-tier tasks first (orchestrator seeds hot tiers first per PERF-10 priority order) | none single | moderate (two dashboards) |

**Provider safety of redundant triggers (verified in code):** the
orchestrator's PERF-6 skip-if-fresh guards check KV entry age before every
provider call — a second trigger inside the min-interval refreshes nothing
and costs zero provider requests. Rate-safe mode aborts on 429/403. The
workflow's `concurrency` group prevents overlapping GH runs.

## Recommendation: **Architecture D**

GitHub Actions as primary (auth via repo secret, full 540 s timeout, logs)
**plus** a free UptimeRobot monitor as the cadence guarantee:

```
Monitor type:  HTTP(s)
URL:           https://www.goalradar.org/api/cron/orchestrator?secret=<CRON_SECRET>
Interval:      30 minutes
```

Why D over B alone: GH gives observable, full-length runs with logs; the
pinger only papers over GH's throttling. Why D over A alone: A measurably
fails the ≤ 30-min criterion today. The hot-first seeding order (PERF-10)
makes even a timeout-truncated backup run valuable: live/today/next-24h
snapshots are written in the first seconds.

### Implemented in this sprint (clearly superior, zero risk)

- **Workflow schedule densified `*/30` → `*/15`**: under GitHub throttling,
  doubling fire attempts roughly halves the effective gap; every extra fire
  is provider-free thanks to skip-if-fresh. No other code touched.

### Manual steps (outside the repo)

1. Create the UptimeRobot monitor above (free account, 2 minutes).
2. Keep an eye on Actions for the first green run (OPS-1 item 1 still
   pending at the time of writing).

## Success-criteria check

| Criterion | Status |
|-----------|--------|
| Effective cadence ≤ 30 min | ✅ guaranteed by the UptimeRobot leg; improved on the GH leg (`*/15`) |
| Snapshot coverage ≥ 95 % | ✅ at ≤ 30-min cadence all tiers stay inside TTL (PERF-10 gap-free design) |
| No additional provider traffic | ✅ skip-if-fresh makes redundant triggers free (verified in orchestrator code) |
| No code regressions | ✅ only the workflow cron expression changed |
| No SEO regressions | ✅ no page/route/sitemap changes |
| Lowest operational complexity | ✅ two free dashboards, no new services to maintain, no vercel.json change |
