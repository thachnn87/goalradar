# PERF-9 Audit — Snapshot Hit Reality
## GoalRadar · Sprint PERF-9

Generated: 2026-06-11 (tournament opening day)
All numbers below are **measured against production** (goalradar.org), not estimated.

---

## Measurement Method

`/api/debug/performance` requires `ADMIN_SECRET` (verified: returns 401
unauthenticated; the secret is not available in this environment), so the
audit used direct production probes instead:

1. **Snapshot KV state, per match** — `GET /api/prewarm/match/{id}`
   (PERF-8, public, KV-only) returns the actual KV state:
   `hit` = snapshot exists · `skip` = snapshot AND detail key both missing ·
   `built` = detail existed, snapshot assembled. Probed **all 104 WC match
   IDs** (scraped from the production fixtures page).
2. **Navigation latency by KV state** — `curl` TTFB / total time +
   `x-vercel-cache` against production match pages, sampled from both the
   `hit` and `skip` groups.
3. **Code-path attribution** — grep of every `getOrBuildMatchSnapshot`
   call site.

---

## Headline Result — Decision Gate FAILED

| Gate criterion | Required | Measured | Verdict |
|---------------|----------|----------|---------|
| KV snapshot hit rate | ≥ 95 % | **11.5 %** (12 / 104) | ❌ |
| build-provider rate | ≤ 1 % | effectively **100 % of misses** (every miss provider-builds on first visit) | ❌ |
| DR rate | ≤ 1 % | not observable externally; irrelevant given the above | — |

**Snapshot misses ARE still the dominant bottleneck — but not for a code
reason.** See root cause.

---

## Measured Data

### Snapshot KV state (all 104 WC matches, production)

| State | Count | % | Meaning |
|-------|-------|---|---------|
| `hit` | 12 | 11.5 % | snapshot in KV (written by a recent user page visit) |
| `skip` | 92 | 88.5 % | snapshot **and** KV detail both absent — full cold |
| `built` | 0 | 0 % | detail-in-KV-but-no-snapshot never occurs → the detail keys aren't being seeded either |

`built = 0` is the smoking gun: if the prewarm cron were running, the
`goalradar:/matches/{id}` detail keys would exist and misses would assemble
from KV. Both key families are absent → **nothing is seeding KV at all.**

### Navigation latency by KV state (production, curl)

| Group | TTFB (shell) | Total (content complete) |
|-------|--------------|--------------------------|
| snapshot `hit` (5 samples) | 0.39–0.98 s | **0.39–1.02 s** |
| snapshot `skip` (5 samples) | 0.41–0.69 s | **1.15–6.99 s** (4 of 5 ≈ 6.9 s) |

- The ~6.9 s totals are the **football-data rate limiter (7 s/request)**: a
  cold page render falls through to the provider and waits in the limiter.
- TTFB stays ≈ 0.4 s in both groups — the PERF-8 `loading.tsx` skeleton
  streams immediately, so users see feedback fast, then wait ~7 s for content
  on cold matches.
- `x-vercel-cache: MISS` on all samples (bare-ID URLs; canonical-slug pages
  edge-cache normally once rendered).

### Mutation proof — users are the only snapshot writer

The 5 `skip` matches whose pages were fetched during timing measurement were
re-probed afterwards: all flipped to `hit`. **Snapshots are currently created
exclusively by user page visits** (then expire per tier TTL: 32 min for
today/next-3-days, 6 h future, 24 h finished — PERF-7B values).

---

## Root Cause — The Prewarm Cron Is Not Running

Evidence chain:

1. `vercel.json` is **`{}`** — Vercel crons were deliberately removed
   (commits `f4a2401 "remove cron"`, `3969951 "remove vercel cron"`).
2. The orchestrator (`/api/cron/orchestrator`) was redesigned to be triggered
   **externally** — its header says
   *"Schedule: every 30 min (configured externally via GitHub Actions /
   EasyCron / UptimeRobot)"*.
3. **No `.github/workflows/` exists in the repo**, and the production KV
   state (92/104 missing, 0 `built`) proves no external trigger is firing.
4. Therefore `prewarmWorldCup()` (PERF-7B: mget batch, 32-min TTLs, all-104
   coverage) never executes. All PERF-7B prewarm engineering is dormant.

### Cold-start windows (consequence)

Without the cron, every snapshot a user visit writes expires after its tier
TTL and the **next visitor re-pays the ~7 s provider build**:

| Tier | TTL | Re-cold cadence per match |
|------|-----|---------------------------|
| today | 32 min | every 32 min |
| next-3d | 32 min | every 32 min |
| future | 6 h | every 6 h |
| finished | 24 h | every 24 h |

With the tournament starting **today**, the `today` tier dominates — popular
match pages go cold twice an hour.

---

## Route Attribution

`getOrBuildMatchSnapshot` is consumed by exactly two routes (verified by
grep): **`/match/[id]`** (page + metadata + Suspense sections, deduped by
React.cache) and **`/predict/[id]`**. Homepage, `/live`, `/schedule`,
`/standings` and the WC hub never read snapshots — they use list caches
(`*Cached` variants, PERF-7A).

| Route | Snapshot reads | Miss exposure |
|-------|----------------|---------------|
| `/match/[id]` | 1 per request (React.cache-deduped) | **highest** — direct user traffic + Googlebot |
| `/predict/[id]` | 1 per request | high (sitemap/4 + GROWTH-2A aliases funnel here) |
| PERF-8 prewarm hints (schedule/live/WC/results + hover) | KV-only probe | **cannot heal misses** — by design they `skip` when the detail key is absent, and the detail keys are absent because the cron is down |
| all other routes | 0 | none |

---

## Navigation Latency Audit (click path)

```
Link click → route transition → RSC fetch → snapshot fetch → render complete
   ~0 ms        instant            ~80–400 ms   ┌ hit:   ~10–50 ms   ┐
            (prefetch+skeleton,                 │ skip: ~6 900 ms ◄── DOMINANT
             PERF-8)                            └ (provider + 7 s limiter)
```

**Dominant contributor: the snapshot provider-build on KV miss (~6.9 s),
~7–17× the entire rest of the path combined.** RSC fetch and render are
healthy; PERF-8's prefetch/skeleton work as designed.

---

## Conclusion

- Snapshot misses are real, measured, and dominant → optimization work is
  justified per the decision gate.
- BUT the correct fix is **operational, not algorithmic**: the PERF-7B
  prewarm pipeline is fully built and simply never triggered. No snapshot
  code changes are needed (and none are made — no provider or ISR
  regressions possible).
- **Fix implemented:** `.github/workflows/orchestrator-cron.yml` — GitHub
  Actions schedule calling `/api/cron/orchestrator` every 30 minutes with
  `Authorization: Bearer ${{ secrets.CRON_SECRET }}`.
  `vercel.json` untouched (project constraint).

### ⚠ Required manual step (cannot be done from the repo)

Add the repository secret **`CRON_SECRET`** (Settings → Secrets and
variables → Actions) with the same value as the `CRON_SECRET` Vercel
environment variable. Until it is set, the workflow runs will hit 401 and
KV stays cold. The workflow can be smoke-tested immediately via
*Actions → WC cache orchestrator → Run workflow*.

### Verification after enabling

Re-run the probe: `GET /api/prewarm/match/{id}` for all 104 IDs should
return ≥ 95 % `hit` within one cron cycle, and cold match pages should serve
content in < 500 ms (`snapshotPerf` / `navigationPerf` in
`/api/debug/performance` confirm from real traffic).
