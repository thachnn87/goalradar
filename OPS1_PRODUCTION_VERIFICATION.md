# OPS-1 Production Scheduler Verification
## GoalRadar · measured against production

Generated: 2026-06-12 03:30 UTC (tournament day 2; Korea–Czechia in play during checks)

Context verified first: DATA-1/DATA-2 were still local — pushed and the
deploy confirmed live before running the surface checks (marker: live
banner CTA `href="/live"` present in production HTML).

---

## Results

| # | Check | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | GitHub Actions workflow succeeding | **FAIL (pending)** | Latest run is #3 at 00:01 UTC — **before the secret was added** — and failed on the pre-curl fast-fail. **No run has fired since the secret was added.** Cannot self-verify: no local copy of the rotated secret, and `workflow_dispatch` needs repo auth. |
| 2 | `/api/cron/orchestrator` returns 200 | **BLOCKED** | Endpoint correctly 401s without the secret (fail-closed verified). 200 with the new secret is verifiable only by the next workflow run or the curl in `CRON_VERIFY_REPORT.md` §5. |
| 3 | Execution frequency | **FAIL** | 3 scheduled runs in ~4 h (19:58 → 22:07 → 00:01) ≈ **every 2 h, not 30 min** — GitHub throttles `*/30` schedules on low-activity repos. See recommendation below. |
| 4 | Prewarm metrics exist | **FAIL (pending)** | `goalradar:prewarm:metrics` is written by the orchestrator (PERF-10) — never ran. (`/api/debug/performance` also not externally readable: ADMIN_SECRET unavailable, 401 confirmed.) |
| 5 | Snapshot coverage | **FAIL — 21 %** | Fresh 104-id probe: 22 `hit` / 82 `skip` (was 12/104 in PERF-9; growth is organic user traffic only). Gate ≥ 95 % not met. |
| 6 | Snapshot hit rate ≥ 95 % | **FAIL (proxy)** | Coverage 21 % ⇒ real-user hit rate cannot reach 95 % for first visits; gate unmet until the cron seeds KV. |
| 7 | build-provider < 1 % | **FAIL (proxy)** | Every uncovered first visit (79 % of matches) provider-builds. Will pass once prewarm runs. |
| 8 | build-kv rate | **BLOCKED** | Needs `snapshotPerf` (ADMIN_SECRET) or a cron cycle. Note: 0 of 104 probes returned `built`, confirming detail keys are also unseeded. |
| 9 | WC hub freshness | **PASS** | Hub shows 537328 (Korea–Czechia) as **LIVE**, matching its match page (LIVE) and `/live` (listed). The finished 537327 is correctly NOT presented with any stale state (it is absent from "today"; recent-results listing completeness awaits the cron — see note). |
| 10 | Schedule freshness | **PASS** | Production schedule now renders 537327 as **FT · Mexico 2 – South Africa 0** — byte-identical state to the match page. This is the DATA-2 overlay working: the underlying bulk list is still the never-refreshed stale payload. |
| 11 | Results freshness | **PARTIAL FAIL** | `/world-cup-2026-results` does not list yesterday's result — the recent-results list entry is stale and the overlay cannot *add* missing entries, only fix the state of listed ones. Resolves on the first successful orchestrator run. |
| 12 | Live banner correctness | **PASS** | Banner in LIVE NOW state; CTA `href="/live"` (DATA-1 fix live in production). |
| — | No stale completed matches shown as LIVE | **PASS** | `/live` lists only Korea–Czechia (actually in play); finished matches filtered by the overlay in `getWCLiveMatchesCached`. |

## Success-gate summary

| Gate | Status |
|------|--------|
| Workflow succeeds every 30 min | ❌ no successful run yet + cadence ~2 h |
| Snapshot hit rate ≥ 95 % | ❌ 21 % coverage |
| build-provider < 1 % | ❌ (proxy) |
| DR < 1 % | ⚪ unverifiable externally; nothing suggests DR usage |
| Hub scores match match pages | ✅ |
| Schedule scores match match pages | ✅ |
| Live banner correct | ✅ |
| No stale completed matches shown as LIVE | ✅ |

**All data-consistency gates pass (DATA-1/2 working in production). All
scheduler gates fail for one reason: the workflow has not produced a single
successful run since the secret was added.**

## Required actions (no code changes warranted yet)

1. **Trigger the workflow manually now** — GitHub → Actions →
   "WC cache orchestrator" → Run workflow — and confirm it goes green.
   (A green run = items 1, 2, 4 verified; re-run the 104-id probe ~3 min
   later and expect ≥ 95 % `hit` for items 5–7.)
2. **Cadence:** GitHub delays `*/30` schedules (observed ~2 h). With
   PERF-10's gap-free TTLs (hot tiers reseeded with 32-min TTLs), a 2-h
   cadence reopens hot-tier cold windows. Options, in preference order:
   a) add a free UptimeRobot monitor on
      `https://www.goalradar.org/api/cron/orchestrator?secret=…` at 30 min
      (the `?secret=` branch exists for exactly this), or
   b) accept GitHub's cadence and rely on the DATA-2 overlay +
      match-page self-healing between runs (consistency holds, but
      first-visit latency on cold matches stays ~7 s).
3. Re-run this verification after one green run; expected flips:
   items 1–8 → PASS, item 11 → PASS.
