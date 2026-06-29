# DATA-11D Runtime Report
## GoalRadar · Hybrid Enrichment — Controlled Production Rollout

Date: 2026-06-16
Commit: 80424bb

---

## Phase 1 — Production Readiness

| Check | Result |
|-------|--------|
| Code deployed | ✅ 80424bb live at 08:12Z |
| `/api/debug/hybrid-enrichment/[id]` | ✅ 401 (exists) |
| `/api/debug/hybrid-enrichment/refresh-lookup` | ✅ 405 on GET probe (exists) |
| `/api/revalidate/match/[id]` | ✅ 405 on GET probe (exists) |
| `/api/debug/minute-trace/[id]` | ✅ 401 (exists) |
| `CRON_SECRET` in Vercel | ✅ confirmed (401 not 500) |

**Pre-check verdict: GREEN**

---

## Phase 2 — Lookup Table Seed

*To be filled by `data11d_rollout.sh` output*

```
refresh-lookup HTTP: ___
ok: ___
count: ___   (expected > 90)
collisions: ___   (expected 0)
key: goalradar:af:lookup:WC:2026
```

**Phase 2 verdict: PENDING**

---

## Phase 3 — Snapshot Invalidation

*To be filled by `data11d_rollout.sh` output*

| Match | HTTP | Result |
|-------|------|--------|
| 537358 Sweden vs Tunisia | ___ | ___ |
| 537364 Iran vs New Zealand | ___ | ___ |
| 537352 Ivory Coast vs Ecuador | ___ | ___ |

**Phase 3 verdict: PENDING**

---

## Phase 4 — Enrichment Verification

*To be filled by `data11d_rollout.sh` output*

### Match 537358 — Sweden vs Tunisia (expected 6 goals)

```json
{
  "enrichmentEnabled": ___,
  "apiFootballKeySet": ___,
  "kvEnabled": ___,
  "lookupTablePresent": ___,
  "lookupTableEntries": ___,
  "mappingKey": "sweden|tunisia|2026-06-15T02:00Z",
  "afFixtureId": ___,
  "eventsCachePresent": ___,
  "snapshotStatus": "FINISHED",
  "snapshotGoalsCount": ___,
  "snapshotBookingsCount": ___,
  "snapshotSubsCount": ___,
  "enrichmentApplied": ___,
  "source": ___
}
```

### Match 537364 — Iran vs New Zealand (expected 4 goals)

```json
{
  "snapshotGoalsCount": ___,
  "enrichmentApplied": ___,
  "afFixtureId": ___
}
```

### Match 537352 — Ivory Coast vs Ecuador (expected 1 goal)

```json
{
  "snapshotGoalsCount": ___,
  "enrichmentApplied": ___,
  "afFixtureId": ___
}
```

**Phase 4 verdict: PENDING**

---

## Phase 5 — Page Rendering Evidence

*To be filled by `data11d_rollout.sh` output*

| Match | Page title | minute_patterns | bookings | substitutions |
|-------|------------|-----------------|----------|---------------|
| 537358 | ___ | ___ | ___ | ___ |
| 537364 | ___ | ___ | ___ | ___ |
| 537352 | ___ | ___ | ___ | ___ |

**Phase 5 verdict: PENDING**

---

## Phase 6 — Safety Gate

**Triggered if:** `snapshotGoalsCount: 0` on all 3 matches after Phase 4.

**Status: NOT TRIGGERED** (awaiting Phase 4 results)

Emergency disable:
```bash
# In Vercel dashboard: remove ENABLE_AF_ENRICHMENT or set to false
# Then revalidate:
for id in 537358 537364 537352; do
  curl -X POST "https://www.goalradar.org/api/revalidate/match/$id?secret=$CRON_SECRET"
done
```

---

## Final Verdict: PENDING

**How to complete this report:**

```bash
export CRON_SECRET=<your_secret>
bash data11d_rollout.sh
# Paste contents of data11d_output.txt back to complete the report.
```

**Note:** `ENABLE_AF_ENRICHMENT=true` must be set in Vercel env before running
the script — the enrichment will not fire if the flag is absent.

---

## Rollout Execution Instructions

### Step A — Set flag in Vercel

In Vercel Project Settings → Environment Variables:
- Name: `ENABLE_AF_ENRICHMENT`
- Value: `true`
- Environment: Production

Redeploy is NOT required — Next.js reads env vars at runtime on Vercel edge.

### Step B — Run rollout script

```bash
export CRON_SECRET=<your_secret>
bash data11d_rollout.sh
```

### Step C — Expected healthy output summary

```
Phase 2: HTTP 200, count ≥ 90, collisions: []
Phase 3: HTTP 200 for all 3 match invalidations
Phase 4: enrichmentApplied: true, snapshotGoalsCount > 0 for all 3
Phase 5: minute_patterns > 0 for at least Sweden vs Tunisia
```

### Step D — If Phase 4 shows snapshotGoalsCount: 0

Check `source` field in debug response:

| source | Meaning | Fix |
|--------|---------|-----|
| `not-enabled` | Flag not set or key missing | Set `ENABLE_AF_ENRICHMENT=true` and `API_FOOTBALL_KEY` |
| `lookup-miss` | AF ID not found for this match | Check alias table, re-run refresh-lookup |
| `api-football-fresh` | Lookup present but events not cached | Snapshot rebuild should have triggered fetch — check Vercel logs |
| `kv-cache` with goals=0 | AF returned no events | api-football issue — check AF dashboard |
