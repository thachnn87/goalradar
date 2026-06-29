# DATA-10D Minute Trace Report
## GoalRadar · Live Clock Minute — Production Pipeline Trace

Date: 2026-06-16
TypeScript: ✅ 0 errors

---

## Deliverable

**New endpoint:** `GET /api/debug/minute-trace/[id]`

File: `src/app/api/debug/minute-trace/[id]/route.ts`
Auth: `CRON_SECRET` (Bearer or `?secret=`) or `NODE_ENV=development`

---

## Endpoint Design

The endpoint traces `Match.minute` through four independent layers without
sharing state between them. Each layer is read independently so null at one
layer cannot cascade from a previous layer's miss.

```
Layer 1: providerLiveMatch   — FootballDataProvider.getLiveMatches() direct
                                Bypasses L1 in-memory cache and KV.
                                Costs 1 API slot (rate-limited at 7s interval).

Layer 2: kvLiveMatch         — kv.get('goalradar:live:matches') raw read.
                                What the cron orchestrator last wrote.
                                No L1, no provider.

Layer 3: liveScoreResponse   — Replicates /api/live-score/[id] Steps 1–3:
                                  Step 1 → readKVLiveMatches() (KV, TTL-gated)
                                  Step 2 → getLiveMatches() (L1 → KV → provider)
                                  Step 3 → getOrBuildMatchSnapshot()
                                Returns the source that served the response.

Layer 4: snapshotMatch       — kv.get('goalradar:match:{id}') raw read.
                                What the match page's initialMinute reads from.
```

---

## Response Shape

```json
{
  "matchId": "537364",
  "checkedAt": "2026-06-16T17:42:15.000Z",

  "providerLiveMatch": {
    "source": "football-data (direct)",
    "found": true,
    "status": "IN_PLAY",
    "minute": 67,
    "score": { "home": 0, "away": 1 }
  },

  "kvLiveMatch": {
    "source": "kv-live-direct",
    "found": true,
    "status": "IN_PLAY",
    "minute": 67,
    "score": { "home": 0, "away": 1 }
  },
  "kvAgeSeconds": 12,

  "liveScoreResponse": {
    "source": "step1-kv",
    "found": true,
    "status": "IN_PLAY",
    "minute": 67,
    "score": { "home": 0, "away": 1 }
  },
  "liveScoreStep": "step1-kv",

  "snapshotMatch": {
    "source": "snapshot-kv",
    "found": true,
    "status": "IN_PLAY",
    "minute": 67,
    "score": { "home": 0, "away": 1 }
  },
  "snapshotAgeSeconds": 45,

  "minuteTrace": {
    "provider":  67,
    "kv":        67,
    "liveScore": 67,
    "snapshot":  67
  },

  "decision":       "NO_LOSS",
  "firstNullLayer": "none — minute flows through all layers"
}
```

---

## Decision Logic

The endpoint auto-diagnoses by comparing `minute` values across layers:

| Pattern | Decision | Meaning |
|---------|----------|---------|
| Match not found at provider | `MATCH_NOT_LIVE` | Match is not IN_PLAY/PAUSED; no minute expected |
| Provider `minute` is null, match found | `PROVIDER_LOSS` | Provider returned IN_PLAY match but no minute field |
| Provider has minute, KV is null | `KV_LOSS` | Minute lost during live-cache write or KV serialisation |
| KV has minute, liveScore is null | `API_LOSS` | `/api/live-score` dropped minute (source-dependent) |
| liveScore has minute, snapshot is null | `SNAPSHOT_LOSS` | Snapshot path drops minute (initial render affected) |
| All layers have minute | `NO_LOSS` | Pipeline is working end-to-end |

---

## Pre-Run Findings (Static Analysis)

Based on prior audit chain (LIVE3A → DATA10B → DATA10C), the expected result
for a healthy primary-provider run is `NO_LOSS`:

### Layer 1 — Provider
`FootballDataProvider.getLiveMatches()` calls `fetchRaw('/matches?status=IN_PLAY,PAUSED')`.
football-data.org v4 returns `"minute": N` at the top level of each match object
for IN_PLAY/PAUSED matches (confirmed in LIVE3A_AUDIT.md from runtime capture).
No mapper strips it. **Expected: minute present.**

### Layer 2 — KV
`live-cache.ts kvSet()` stores the raw `Match[]` array returned by the provider.
`JSON.stringify` preserves defined properties — `minute: 67` is a defined integer,
not `undefined`, so it survives serialisation. **Expected: minute preserved.**

### Layer 3 — liveScoreResponse
`/api/live-score` Step 1 reads `readKVLiveMatches()` → returns `liveMatch.minute ?? null`.
Since DATA-10 fixed the Step 3 snapshot fallback (`match.minute ?? null` added),
all three steps propagate minute. **Expected: minute present from step1-kv.**

### Layer 4 — Snapshot
`getOrBuildMatchSnapshot()` calls `getMatchDetail()` → `FootballDataProvider.getMatch(id)` →
`fetchRaw('/matches/{id}')`. The per-match detail endpoint also returns `minute` at
runtime. **Expected: minute present (same value as provider).**

---

## Failover Branch — Expected PROVIDER_LOSS

When `ENABLE_API_FOOTBALL=false` or when `API_FOOTBALL_KEY` is absent and
football-data.org is unavailable, the system falls back to the DR key
(`goalradar:dr:live:matches`), which may contain stale data from the last
successful primary fetch. In this scenario:

- Layer 2 `kvLiveMatch.minute`: present if DR key was written when primary was up
- Layer 1 `providerLiveMatch`: error (provider unavailable)
- Decision: `KV_LOSS` if DR key is stale enough that minute has changed;
  `NO_LOSS` if DR key was recent

When api-football is the active failover provider, `normaliseMatch()` now maps
`item.fixture.status.elapsed ?? null` to `minute`. Both providers correctly
populate minute.

---

## Verification Procedure

During any live WC 2026 match, run:

```bash
# Using secret query param
curl "https://goalradar.org/api/debug/minute-trace/537364?secret=$CRON_SECRET"

# Or Bearer auth
curl -H "Authorization: Bearer $CRON_SECRET" \
     "https://goalradar.org/api/debug/minute-trace/537364"
```

Expected happy-path output:
```json
{
  "minuteTrace": { "provider": 67, "kv": 67, "liveScore": 67, "snapshot": 67 },
  "decision": "NO_LOSS"
}
```

If production shows `LIVE` instead of `67'` when this endpoint reports `NO_LOSS`:
the loss is in the client — `MatchLiveZone` is not receiving the value correctly.
Check browser DevTools → Network → `/api/live-score/537364` response body.

---

## Files Created

| File | Purpose |
|------|---------|
| `src/app/api/debug/minute-trace/[id]/route.ts` | Live minute pipeline trace endpoint |

---

## Expected Decision at Production Time

Based on the full audit chain (LIVE3A → DATA10B → DATA10C → DATA10D):

**Most likely: `NO_LOSS`**

The `DATA10B_MINUTE_AUDIT.md` incorrectly hypothesised that the collection
endpoint lacked `minute`. `DATA10C_PROVIDER_CAPTURE.md` corrected this using
prior LIVE3A runtime evidence. The actual root cause of the production symptom
("LIVE instead of 67'") was the `/api/live-score` snapshot fallback (Step 3)
missing `minute` in its response — fixed in DATA-10.

If the endpoint returns a non-`NO_LOSS` decision during a live match after
DATA-10 is deployed, that would be a new regression. The decision value names
the exact layer to investigate.
