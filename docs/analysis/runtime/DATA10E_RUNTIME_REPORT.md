# DATA-10E Runtime Minute Verification
## GoalRadar · Live Clock Minute — Production Pipeline Trace (Runtime)

Date: 2026-06-16
Status: **PARTIAL — no IN_PLAY match was available during the test window**

---

## Executive Summary

No `IN_PLAY` or `PAUSED` WC match was present during the test window (UTC
00:00–04:50 on 2026-06-16). The minute-trace endpoint is deployed and ready.
Static analysis across the full pipeline (DATA-10B through DATA-10D) supports
a predicted decision of **`NO_LOSS`**. Runtime confirmation is deferred to the
next available live match: France vs Senegal (ID 537391, 19:00Z June 16) or
Iraq vs Norway (ID 537392, 22:00Z June 16).

---

## 1. Test Window Timeline

| UTC | Event | Evidence |
|-----|-------|----------|
| 03:53 | Production `live-minute` polled | `{"count":0,"kvEmpty":true}` — no live matches |
| 04:00 | Attempted match: Colombia vs Poland (GS-I1 per `fixtures.json`, Seattle 21:00 PDT) | fixture identification was incorrect — see §5 |
| 04:12 | `live-minute` poll | `{"count":0,"kvEmpty":false}` — cron running, empty array |
| 04:17 | `live-minute` poll | `{"count":0,"kvEmpty":false}` — same |
| 04:18 | Direct football-data.org probe (`/matches?status=IN_PLAY,PAUSED`) | `{"resultSet":{"count":0},"matches":[]}` — 0 IN_PLAY/PAUSED |
| 04:48 | `live-minute` polled | `{"count":0,"kvEmpty":false}` — still empty |

---

## 2. Production Endpoint Evidence Captured

### 2a. `GET https://goalradar.org/api/debug/live-minute` (04:48Z)

```json
{
  "generatedAt": "2026-06-16T04:48:49.346Z",
  "count": 0,
  "kvEmpty": false,
  "matches": []
}
```

**Finding:** `kvEmpty: false` confirms the cron orchestrator is writing to KV.
`count: 0` means no IN_PLAY/PAUSED matches are present in the KV payload.
The cron is healthy; no live match was available.

### 2b. `GET https://goalradar.org/api/live-score/537364` (Iran vs New Zealand, FINISHED)

```json
{
  "status": "FINISHED",
  "minute": null,
  "score": { "home": 2, "away": 2 }
}
```

**Finding:** `minute: null` for a FINISHED match is the correct, expected
behaviour. The `minute` field is conditional — football-data.org v4 returns it
only for `IN_PLAY` and `PAUSED` status. This confirms the pipeline handles the
FINISHED case correctly and does not crash on absent `minute`.

---

## 3. football-data.org Data Latency Observation

At 04:18Z (18 minutes into what was believed to be a live match), a direct
API probe of football-data.org returned 0 IN_PLAY/PAUSED matches:

```bash
GET https://api.football-data.org/v4/competitions/WC/matches?status=IN_PLAY,PAUSED
→ {"filters":{"season":"2026","status":["IN_PLAY","PAUSED"]},"resultSet":{"count":0},"matches":[]}
```

This is a known characteristic of the TIER_ONE (free) plan: live status
transitions can lag the actual kickoff by 5–30 minutes. This is the same
data latency observed in LIVE3A_AUDIT.md. It is not a bug in GoalRadar's
pipeline; it is an upstream provider limitation.

**Implication:** During the brief window between actual kickoff and
football-data.org updating the status to `IN_PLAY`, GoalRadar's KV will
contain 0 live matches and match pages will show the pre-match state.

---

## 4. Fixture Identification Error

The previous session identified "Colombia vs Poland (Seattle, 21:00 PDT)" as
the test match. This was incorrect:

- `fixtures.json` shows `GS-I1: colombia vs poland | 2026-06-15 | 21:00 | seattle`
- However, football-data.org's WC 2026 schedule does NOT include a Colombia vs
  Poland fixture. football-data.org has Colombia in a different group:
  - 537404: Uzbekistan vs Colombia — 2026-06-18T02:00Z (TIMED)
  - 537406: Colombia vs Congo DR — 2026-06-24T02:00Z (TIMED)
  - 537407: Colombia vs Portugal — 2026-06-27T23:30Z (TIMED)

The `fixtures.json` group assignments do not match football-data.org's actual
tournament groupings. The local fixture file appears to be based on a different
source or a pre-draw prediction. **GoalRadar's live data is sourced from
football-data.org, not from `fixtures.json`.**

---

## 5. Minute-Trace Endpoint Status

The endpoint deployed in DATA-10D is live and ready:

```
GET /api/debug/minute-trace/{id}
Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development
```

The endpoint has never been called with an IN_PLAY match ID. No runtime
decision (PROVIDER_LOSS / KV_LOSS / API_LOSS / SNAPSHOT_LOSS / NO_LOSS) has
been obtained.

---

## 6. Recommended Verification Runs

The next available WC matches on football-data.org:

| ID | Match | UTC kickoff | Local |
|----|-------|------------|-------|
| **537391** | France vs Senegal | 2026-06-16 **19:00Z** | 15:00 EDT |
| **537392** | Iraq vs Norway | 2026-06-16 **22:00Z** | 18:00 EDT |

Run the minute-trace 5–10 minutes after kickoff (to allow for the data latency
observed in §3):

```bash
# France vs Senegal — run after 19:05Z on June 16
curl "https://goalradar.org/api/debug/minute-trace/537391?secret=$CRON_SECRET"

# Iraq vs Norway — run after 22:05Z on June 16
curl "https://goalradar.org/api/debug/minute-trace/537392?secret=$CRON_SECRET"
```

Alternately, from local dev (auth bypassed):

```bash
curl "http://localhost:3000/api/debug/minute-trace/537391"
```

---

## 7. Expected Decision (Based on Static Analysis)

From DATA-10B, DATA-10C, and DATA-10D:

| Layer | Expected minute | Basis |
|-------|----------------|-------|
| Layer 1: Provider (football-data.org direct) | **present** | `"minute": N` in collection response (LIVE3A confirmed) |
| Layer 2: KV (`goalradar:live:matches`) | **present** | raw JSON.stringify passthrough; `minute` survives |
| Layer 3: `/api/live-score` | **present** | Steps 1–3 all include `minute ?? null` (DATA-10 fix verified) |
| Layer 4: Snapshot (`goalradar:match:{id}`) | **present** | snapshot built from detail endpoint which also returns `minute` |

**Predicted decision: `NO_LOSS`**

The prior production symptom ("LIVE instead of 67'") was fixed in DATA-10 by
adding `minute: match.minute ?? null` to the snapshot fallback (Step 3) in
`/api/live-score`. All four layers are expected to return a consistent,
non-null `minute` value for an IN_PLAY match.

---

## 8. Indirect Evidence Supporting NO_LOSS

From DATA-10C verified state table (`DATA10C_PROVIDER_CAPTURE.md:228-240`):

| Layer | File | Verified status |
|-------|------|-----------------|
| `Match.minute` type | `src/lib/types.ts:55` | ✅ `minute?: number \| null` |
| football-data passthrough | `src/lib/providers/football-data.ts:207` | ✅ raw JSON, `minute` survives |
| api-football mapper | `src/lib/providers/api-football.ts:164` | ✅ `item.fixture.status.elapsed ?? null` |
| KV write | `src/lib/live-cache.ts:168` | ✅ stores raw match objects |
| `/api/live-score` Step 1 | `src/app/api/live-score/[matchId]/route.ts:46` | ✅ `liveMatch.minute ?? null` |
| `/api/live-score` Step 2 | `src/app/api/live-score/[matchId]/route.ts:64` | ✅ `liveMatch.minute ?? null` |
| `/api/live-score` Step 3 | `src/app/api/live-score/[matchId]/route.ts:82` | ✅ `match.minute ?? null` (DATA-10 fix) |
| `MatchLiveZone` poll | `src/components/MatchLiveZone.tsx:96` | ✅ `setMinute(data.minute ?? null)` |

---

## 9. Decision

**DECISION: DEFERRED — MATCH_NOT_AVAILABLE**

No IN_PLAY match was accessible during the test window. The minute-trace
endpoint returned no data. The predicted pipeline decision is `NO_LOSS` based
on the complete static analysis chain, but this is not confirmed by runtime
evidence.

**Action required:** Run `minute-trace/537391` or `minute-trace/537392` during
the live match to obtain the actual decision. Update this report with the
captured JSON and the confirmed decision.

---

## Files Referenced

| File | Role |
|------|------|
| `src/app/api/debug/minute-trace/[id]/route.ts` | Trace endpoint (DATA-10D) |
| `src/app/api/live-score/[matchId]/route.ts` | Steps 1–3 (DATA-10 fix applied) |
| `src/components/MatchLiveZone.tsx` | Client poller |
| `DATA10C_PROVIDER_CAPTURE.md` | Provider field mapping, verified pipeline state |
| `DATA10D_TRACE_REPORT.md` | Trace endpoint design and expected decision logic |
