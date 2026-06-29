# DATA-11G Activation Report
## GoalRadar · Hybrid Provider — Production Activation Attempt

Date: 2026-06-16T09:00Z
Commit: 80424bb

---

## Final Verdict: RED

**Activation blocked.** api-football Free plan does not have access to season 2026.
The lookup table cannot be seeded. No enrichment can fire until the plan is upgraded.

---

## Task 1 — Production Environment Verification

Probed at 09:00Z via `GET /api/debug/hybrid-enrichment/537358`:

| Variable | Status | Evidence |
|----------|--------|----------|
| `ENABLE_AF_ENRICHMENT` | ✅ `true` | `enrichmentEnabled: true` in response |
| `API_FOOTBALL_KEY` | ✅ set | `apiFootballKeySet: true` in response |
| `KV_REST_API_URL` | ✅ set | `kvEnabled: true` in response |
| `KV_REST_API_TOKEN` | ✅ set | `kvEnabled: true` in response |
| `CRON_SECRET` | ✅ set | Endpoints return 401, not 500 |

**All production env vars are correctly configured.** The feature flag is already live.

---

## Task 2 — Debug Endpoint Response (pre-seed)

`GET /api/debug/hybrid-enrichment/537358` at 09:00Z:

```json
{
  "enrichmentEnabled": true,
  "apiFootballKeySet": true,
  "kvEnabled": true,
  "lookupTablePresent": false,
  "lookupTableEntries": 0,
  "afFixtureId": null,
  "eventsCachePresent": false,
  "snapshotStatus": "FINISHED",
  "snapshotGoalsCount": 0,
  "source": "lookup-miss"
}
```

Interpretation: enrichment tried to fire (flag + key + KV all present) but
`resolveAfFixtureId()` returned null because the lookup table is empty.

---

## Task 3 — Seed Lookup Table

```
POST /api/debug/hybrid-enrichment/refresh-lookup
```

**Attempt 1:** `{"ok":false,"error":"Data temporarily unavailable"}` — 4583ms
**Attempt 2 (after 3s):** `{"ok":false,"error":"Data temporarily unavailable"}`

### Root Cause

`refreshAfLookupTable()` calls:
```
GET https://v3.football.api-sports.io/fixtures?league=1&season=2026
```

api-football response:
```json
{
  "results": 0,
  "errors": {
    "plan": "Free plans do not have access to this season, try from 2022 to 2024."
  }
}
```

`fetchRaw()` detects `json.errors` → throws `ApiUnavailableError('http')` →
message: `"Data temporarily unavailable"` → endpoint returns `{"ok":false,"error":"..."}`.

### api-football Subscription State

Verified directly against the api-football status endpoint:

```
plan:              Free
subscription end:  2027-06-08
active:            true
requests today:    2 / 100
```

The account has an active free subscription until June 2027 — but the **Free plan
is hard-capped at seasons 2022–2024**. WC 2026 (season 2026) requires a paid plan.
This is not a quota limit. It is a tier restriction that cannot be worked around.

---

## Task 4–6 — Snapshot Invalidation and Enrichment Verification

Not executed — seeding lookup table is a prerequisite. Without the lookup table,
`resolveAfFixtureId()` returns null for every match, and enrichment produces no events.

### Current state of all 3 verification matches

| Match | FD ID | mappingKey | afFixtureId | snapshotGoals | source |
|-------|-------|------------|-------------|---------------|--------|
| Sweden vs Tunisia | 537358 | `sweden\|tunisia\|2026-06-15T02:00Z` | null | 0 | `lookup-miss` |
| Iran vs New Zealand | 537364 | `iran\|new zealand\|2026-06-16T01:00Z` | null | 0 | `lookup-miss` |
| Ivory Coast vs Ecuador | 537352 | `ivory coast\|ecuador\|2026-06-14T23:00Z` | null | 0 | `lookup-miss` |

All mappingKeys are correct. The code, keys, KV, and flag are all working. The
sole blocker is that `getAllMatches('WC')` returns 0 fixtures with a plan error.

### FD ground truth confirmed

```
537358 Sweden vs Tunisia      FINISHED  goals: 0  (FD free tier omits events ✅ expected)
537364 Iran vs New Zealand    FINISHED  goals: 0  (FD free tier omits events ✅ expected)
537352 Ivory Coast vs Ecuador FINISHED  goals: 0  (FD free tier omits events ✅ expected)
```

---

## Task 7 — Page Rendering

Not verified — no enrichment data available. GoalScorers and GoalsSection would
render the same empty state as before this feature was deployed.

---

## Documentation Correction

Earlier audit documents (DATA11A, DATA11B) stated match 537352 kickoff as
`2026-06-14T22:00:00Z`. The actual FD `utcDate` is **`2026-06-14T23:00:00Z`**.

The code is correct — `buildMappingKey()` uses the live FD `utcDate` field, not
any hardcoded time. The production mappingKey `ivory coast|ecuador|2026-06-14T23:00Z`
is accurate. This was a documentation error only.

---

## What Is Working Correctly

| Component | Status |
|-----------|--------|
| `AF_ENRICHMENT_ENABLED = true` at runtime | ✅ |
| `enrichMatchWithAFEvents()` guard logic | ✅ |
| `buildSnapshot()` enrichment hook | ✅ |
| `resolveAfFixtureId()` — returns null, logs warning on miss | ✅ |
| `refreshAfLookupTable()` — throws on plan error | ✅ |
| Debug endpoint — reports state accurately | ✅ |
| `source: lookup-miss` diagnosis | ✅ correct |
| All mapping keys — match FD utcDate | ✅ |
| KV writes — would work once IDs are available | ✅ inferred |

---

## Paths to Resolution

### Option A — Upgrade api-football plan (recommended)

The Starter plan ($10–15/month) includes current season data. WC 2026
requires season 2026 access.

After upgrade:
```bash
export CRON_SECRET=<secret>

# Re-seed the lookup table:
curl -X POST "https://www.goalradar.org/api/debug/hybrid-enrichment/refresh-lookup?secret=$CRON_SECRET"
# Expected: {"ok":true,"count":≥90,"collisions":[]}

# Invalidate + rebuild 3 verification snapshots:
for id in 537358 537364 537352; do
  curl -X POST "https://www.goalradar.org/api/revalidate/match/$id?secret=$CRON_SECRET"
  curl -s -o /dev/null "https://www.goalradar.org/match/$id"
done
sleep 5

# Verify:
for id in 537358 537364 537352; do
  curl "https://www.goalradar.org/api/debug/hybrid-enrichment/$id?secret=$CRON_SECRET" | \
    node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.fdMatchId,'goals:',j.snapshotGoalsCount,'applied:',j.enrichmentApplied);})"
done
```

### Option B — Manual lookup table seed

If WC 2026 fixture IDs are available from another source (scrape, another API,
or api-football paid trial), they can be written directly to KV:

```typescript
// One-time: build the table manually
import { kv } from '@vercel/kv';
const table: Record<string, number> = {
  'sweden|tunisia|2026-06-15T02:00Z':       <af_fixture_id>,
  'iran|new zealand|2026-06-16T01:00Z':     <af_fixture_id>,
  'ivory coast|ecuador|2026-06-14T23:00Z':  <af_fixture_id>,
  // ... all 104 matches
};
await kv.set('goalradar:af:lookup:WC:2026', table, { ex: 30 * 24 * 3600 });
```

This bypasses the plan restriction for known matches but requires manual
effort for every new match.

### Option C — Disable enrichment until plan upgrade

```bash
# In Vercel dashboard: set ENABLE_AF_ENRICHMENT=false (or remove it)
# No code change needed — the flag gates the entire enrichment path
```

Current state with `enrichmentEnabled: true` but no lookup table is safe:
`source: lookup-miss` means enrichment exits cleanly without error. Pages
render without events (same as before feature deployment). No user impact.

---

## Rollback Assessment

No rollback needed. The current state (`enrichmentEnabled: true`, no lookup
table, `source: lookup-miss`) is functionally identical to `enrichmentEnabled: false`
from a user perspective. All match pages render correctly. The enrichment block
fires, finds no ID, and returns the unenriched match — which is the same
empty-events state the page had before DATA-11B was deployed.

**No action required unless GoalScorers empty state is unacceptable for the
matches that are already FINISHED.**

---

## Checklist Summary

| Step | Status | Notes |
|------|--------|-------|
| 1. Verify production env | ✅ All set | Flag on, key set, KV configured |
| 2. Probe debug endpoint | ✅ Reachable | Returns accurate state |
| 3. Seed lookup table | ❌ **BLOCKED** | api-football Free plan: no season 2026 |
| 4. Invalidate snapshots | ⏳ Pending step 3 | — |
| 5. Force snapshot rebuild | ⏳ Pending step 3 | — |
| 6. Verify enrichment | ⏳ Pending step 3 | All show `lookup-miss` |
| 7. Page rendering | ⏳ Pending step 3 | GoalScorers renders empty |

**Required action:** Upgrade api-football plan to access season 2026, then
re-run from Step 3.
