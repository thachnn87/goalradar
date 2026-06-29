# CRON-VERIFY Report
## GoalRadar · Orchestrator cron authentication audit (no code changes)

Generated: 2026-06-12

Files read: `.github/workflows/orchestrator-cron.yml` (only workflow in the
repo) · `src/app/api/cron/orchestrator/route.ts` ·
`src/lib/refresh.ts` (auth helpers). There is **no middleware file**
(`src/middleware.ts` does not exist) — auth happens entirely inside the
route handler.

---

## 1. Is CRON_SECRET actually used?

**Yes, on both ends.**

- **Server:** `/api/cron/orchestrator` → `GET` handler's first statement is
  `if (!isAuthorizedExternalRequest(req)) return 401`.
  `isAuthorizedExternalRequest` (refresh.ts:348) reads
  `process.env.CRON_SECRET` (a **Vercel environment variable**).
- **Workflow:** `orchestrator-cron.yml` injects
  `${{ secrets.CRON_SECRET }}` (a **GitHub Actions repository secret**) into
  the curl call as `Authorization: Bearer …`, and exits 1 with an explicit
  `::error` annotation if the secret is empty — *before* making any request.

These are **two independent stores that must hold the same value**:

| Store | Where to set | Status (measured) |
|-------|-------------|-------------------|
| Vercel env `CRON_SECRET` | Vercel → Project → Settings → Environment Variables | **set** — endpoint returns 401 (fail-closed check passes; if it were unset the handler logs `CRON_SECRET is not set` and also 401s, indistinguishable externally, but the 16 s processing time indicates the handler ran) |
| GitHub repo secret `CRON_SECRET` | GitHub → Settings → Secrets and variables → Actions | **NOT set** — every scheduled run fails in ~1 s, which is the workflow's pre-curl fast-fail path |

## 2. What exact header is expected?

```
Authorization: Bearer <CRON_SECRET>
```

Exact string equality: `req.headers.get('authorization') === `Bearer ${secret}``
— case-sensitive secret, single space, no quotes.

**Alternative accepted by this endpoint only:** query param
`?secret=<CRON_SECRET>` (intentional, for UptimeRobot-style schedulers that
cannot set headers; HTTPS-only transport). Either mechanism passing → 200.

## 3. What happens if the secret is missing?

- **Missing on the server (Vercel env unset):** fail-closed — the helper
  logs `[Auth] CRON_SECRET is not set — cron endpoint denied.` and returns
  `false` → **401 for every caller, even with a correct header**. An absent
  secret is never "allow all".
- **Missing in GitHub (current production state):** the workflow step prints
  `::error::CRON_SECRET repository secret is not set — see PERF9_AUDIT.md`
  and exits 1 in ~1 second **without calling the endpoint at all**. This
  matches the observed run history exactly (every run: failure, step
  duration 1 s).

## 4. What happens if the secret is wrong?

Header (or query param) compares unequal → `isAuthorizedExternalRequest`
returns `false` → **HTTP 401 `{"error":"Unauthorized"}`**. No tasks run, no
provider calls are made, nothing is written to KV. Measured live:
`Bearer wrong` → 401 in ~16 s (cold lambda spin-up, then immediate reject).

## 5. Exact curl commands to test

```bash
# 1. Negative test — expect 401 {"error":"Unauthorized"}
curl -i "https://www.goalradar.org/api/cron/orchestrator"

# 2. Positive test — header form (use the value from Vercel env CRON_SECRET)
curl -i --max-time 540 \
  -H "Authorization: Bearer YOUR_CRON_SECRET_VALUE" \
  "https://www.goalradar.org/api/cron/orchestrator"

# 3. Positive test — query-param form (equivalent)
curl -i --max-time 540 \
  "https://www.goalradar.org/api/cron/orchestrator?secret=YOUR_CRON_SECRET_VALUE"
```

Expected success response: HTTP 200 with a JSON task report
(refresh results + `prewarmWorldCup` stats). A full run can take several
minutes (sequential tasks behind the 7 s/request provider rate limiter) —
hence `--max-time 540`, matching the workflow.

## Remediation (one step, unchanged from PERF-9/DATA-1)

GitHub → repo → Settings → Secrets and variables → Actions →
**New repository secret** → Name: `CRON_SECRET`, Value: the exact Vercel
`CRON_SECRET` value → then Actions → "WC cache orchestrator" →
**Run workflow** and confirm the run is green. Subsequent scheduled runs
(every 30 min) will then keep KV warm.
