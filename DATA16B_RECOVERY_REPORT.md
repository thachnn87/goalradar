# DATA-16B Coverage Recovery Report

Date: 2026-06-17
Phase: 3 of 7

---

## Status: BLOCKED — CRON_SECRET required

The repair process requires `CRON_SECRET` from the Vercel environment.
This environment does not have it (only `REVALIDATE_SECRET` is in `.env.local`, and
it was confirmed NOT to match the production `CRON_SECRET`).

---

## What the Repair Does

`GET /api/cron/repair-enrichment?secret=$CRON_SECRET` performs:
1. Reads all 18 WC 2026 finished match snapshots from KV in parallel
2. Identifies matches where `score > 0` and `goals.length === 0`
3. For each: calls `invalidateMatchSnapshot(id)` (clears `goalradar:match:{id}` + `goalradar:espn:event:{id}`)
4. Returns a JSON summary

After invalidation, the next page load for each match triggers a fresh `buildSnapshot`:
- ESPN lookup resolves (positive KV key still has 30-day TTL)
- `getEspnMatchEvents` fetches fresh from ESPN (no event cache → live call)
- Correct goal filter (`scoringPlay === true`) captures all goal types
- Team IDs resolved correctly (DATA-14A fix)
- Events cached for 30 days (DATA-16 fix)
- Enriched snapshot written to KV

---

## Repair Runbook

Execute from any environment with `CRON_SECRET`:

```bash
SECRET="<CRON_SECRET from Vercel dashboard>"
BASE="https://www.goalradar.org"

# Step 1: Run the repair job (invalidates degraded snapshots)
curl -s "$BASE/api/cron/repair-enrichment?secret=$SECRET" | jq .

# Expected response:
# {
#   "repaired": 16,
#   "degraded": 16,
#   "missing": 0,
#   "succeeded": [537327, 537328, 537333, ...],
#   "failed": []
# }

# Step 2: Confirm health (should show 0 unenriched)
curl -s "$BASE/api/debug/enrichment-health?secret=$SECRET" | jq '{total, ok, unenriched, noSnapshot}'

# Step 3: Verify specific matches (check a few after ~30s)
for id in 537346 537358 537364; do
  curl -sL --max-time 15 "$BASE/match/$id-*" 2>/dev/null |
    grep -o '"text":"[^"]*"' | head -3
done

# Step 4: Spot-check Australia vs Turkey (KEY VALIDATION)
curl -s "$BASE/api/debug/espn-enrichment/537346?secret=$SECRET" |
  jq '{espnMatchId, enrichmentApplied, goalsCount, source}'
# Expected: espnMatchId="760421", enrichmentApplied=true, goalsCount=2
```

---

## Pre-repair vs Expected Post-repair

| Metric | Pre-repair | Expected post-repair |
|--------|-----------|----------------------|
| Enriched matches | 0 (1 partial) | 17/18 |
| Goals coverage | ~5% | ~95%+ |
| Lineups available | 0/18 | 18/18 |
| Statistics valid | 0/18 | 17/18 |
| False "goalless" | 0 ✅ | 0 ✅ |

---

## Alternative: Per-match revalidation

If the repair endpoint isn't available, revalidate individually via POST:

```bash
SECRET="<CRON_SECRET>"
BASE="https://www.goalradar.org"

for id in 537327 537328 537333 537334 537339 537340 537345 537346 \
          537351 537352 537357 537358 537363 537364 537369 537370 \
          537391 537392; do
  curl -s -X POST "$BASE/api/revalidate/match/$id?secret=$SECRET" >/dev/null
  echo "Revalidated $id"
done
```

This clears the Next.js ISR page cache AND the KV snapshot (via the DATA-14B fix in `invalidateMatchSnapshot`).
