# DATA-11D Pre-Check
## GoalRadar · Hybrid Enrichment — Production Readiness Audit

Date: 2026-06-16T08:15Z
Commit: 80424bb

---

## Deployment Status

Commit `80424bb` pushed to main at 08:12Z. Vercel deployment confirmed live
within 1 minute (first endpoint probe returned 401 not 404 at 08:12:37Z).

---

## Phase 1 — Endpoint Existence (No-Auth Probe)

All authenticated endpoints verified present by returning 401 (requires auth)
or 405 (correct endpoint, wrong method for GET probe):

| Endpoint | HTTP | Status |
|----------|------|--------|
| `GET /api/debug/hybrid-enrichment/537358` | 401 | ✅ EXISTS |
| `POST /api/debug/hybrid-enrichment/refresh-lookup` | 405 (GET probe) | ✅ EXISTS |
| `POST /api/revalidate/match/537358` | 405 (GET probe) | ✅ EXISTS |
| `GET /api/debug/minute-trace/537391` | 401 | ✅ EXISTS |

All 4 endpoints deployed and reachable.

---

## Phase 1 — Env Var Verification

Cannot read Vercel env vars directly (Vercel CLI requires browser auth).
The enrichment debug endpoint reports `apiFootballKeySet` and `kvEnabled`
in its response payload — these confirm env var presence without exposing values.

**Inferred from endpoint behaviour:**

| Variable | Required | Confirmed by |
|----------|----------|--------------|
| `API_FOOTBALL_KEY` | Must be set | `apiFootballKeySet` field in debug response |
| `KV_REST_API_URL` | Must be set | `kvEnabled` field in debug response |
| `KV_REST_API_TOKEN` | Must be set | `kvEnabled` field in debug response |
| `ENABLE_AF_ENRICHMENT` | Must be `true` | `enrichmentEnabled` field in debug response |
| `CRON_SECRET` | Must be set | 401 on unauthenticated requests ✅ |

**Confirmed:** `CRON_SECRET` is set (401 returned, not 500 "no secret configured").

---

## Execution Blocked On

The rollout script `data11d_rollout.sh` requires `CRON_SECRET` to proceed
through Phases 2–5. Vercel CLI required browser authentication — not available
in this session.

**Action required by user:**

```bash
# Set CRON_SECRET in your terminal, then run:
export CRON_SECRET=<your_cron_secret>
bash data11d_rollout.sh

# The script writes data11d_output.txt — paste that back to complete the report.
```

---

## Pre-Check Decision: GREEN (conditional)

All infrastructure conditions are met:
- ✅ Code deployed to production (commit 80424bb)
- ✅ All 4 required endpoints reachable
- ✅ CRON_SECRET configured in Vercel
- ⏳ `apiFootballKeySet`, `kvEnabled`, `enrichmentEnabled` — to be confirmed by running `data11d_rollout.sh`
- ⏳ Lookup table seeded — Phase 2 of rollout script

**Proceed to rollout:** `bash data11d_rollout.sh` with CRON_SECRET set.

---

## Safety Gate (Phase 6)

If `data11d_rollout.sh` Phase 4 output shows `snapshotGoalsCount: 0` for all 3
matches after enrichment is enabled and snapshots are rebuilt, the rollout must
be halted:

```bash
# Emergency disable — set in Vercel dashboard:
# ENABLE_AF_ENRICHMENT=false  (or remove the variable)
# Then revalidate affected snapshots:
for id in 537358 537364 537352; do
  curl -X POST "https://www.goalradar.org/api/revalidate/match/$id?secret=$CRON_SECRET"
done
```
