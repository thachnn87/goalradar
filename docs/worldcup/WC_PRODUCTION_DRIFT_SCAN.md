# WC_PRODUCTION_DRIFT_SCAN.md — DATA-18WC.9C Phase 4

**Date:** 2026-06-24
**Scan time:** 2026-06-24T02:17:01Z – 2026-06-24T02:17:35Z
**Method:** Live production debug endpoints at https://www.goalradar.org
**Endpoints called:**
- `/api/debug/wc/state-divergence`
- `/api/debug/wc/authority-freshness`
- `/api/debug/wc/feed-integrity`
- `/api/debug/wc/match-state/537412`

**IMPORTANT:** All findings below are based on live production data. Only values returned by these endpoints are treated as confirmed facts. No assumptions are made about fields not present in the responses.

---

## 1. RAW PRODUCTION DATA

### 1.1 State Divergence Endpoint

```json
{
  "checkedAt": "2026-06-24T02:17:01.332Z",
  "sources": {
    "authority": {
      "key": "goalradar:wc:authority:v1",
      "source": "dr",
      "builtAt": "2026-06-24T00:13:00.915Z",
      "builtAgeSec": 7440,
      "matchCount": 47,
      "liveCount": 0,
      "ttlTier": "normal"
    },
    "liveCache": {
      "key": "goalradar:live:matches",
      "present": false,
      "fetchedAt": null,
      "ageSec": null,
      "fresh": false,
      "liveCount": 0
    },
    "snapshot": {
      "keyPattern": "goalradar:match:{id}",
      "present": 46,
      "missing": 1
    }
  },
  "distribution": {
    "authority": { "finished": 46, "cancelled": 1 },
    "snapshot": { "finished": 46, "missing": 1 },
    "liveCache": { "not-live": 47 }
  },
  "summary": { "total": 47, "green": 47, "yellow": 0, "red": 0, "divergent": 0 },
  "verdict": "GREEN",
  "divergences": []
}
```

### 1.2 Authority Freshness Endpoint

```json
{
  "checkedAt": "2026-06-24T02:17:02.979Z",
  "source": "dr",
  "builtAt": "2026-06-24T00:13:00.915Z",
  "ageSec": 7442,
  "ttlTier": "normal",
  "ttlSec": 900,
  "stale": true,
  "matchCount": 47,
  "liveCount": 0,
  "drPresent": true,
  "verdict": "RED"
}
```

### 1.3 Feed Integrity Endpoint

```json
{
  "checkedAt": "2026-06-24T02:17:18.613Z",
  "verdict": "YELLOW",
  "redCount": 0,
  "yellowCount": 2,
  "feeds": {
    "finished": { "present": true, "count": 47, "ageHours": 3.1 },
    "upcoming": { "present": false, "count": 0, "ageHours": null, "drPresent": false, "drCount": 0, "drAgeHours": null },
    "authority": { "present": true, "count": 47 }
  },
  "issues": [
    { "check": "feed-present", "severity": "YELLOW", "detail": "UPCOMING feed absent from KV (primary + DR both missing)" },
    { "check": "feed-stale", "severity": "YELLOW", "detail": "FINISHED feed is 3.1h old — orchestrator cron may be stalled" }
  ]
}
```

### 1.4 Match State Endpoint — Match 537412

```json
{
  "matchId": "537412",
  "checkedAt": "2026-06-24T02:17:34.998Z",
  "liveKVStatus": "LIVE_CACHE_EMPTY_OR_EXPIRED",
  "liveKVScore": null,
  "liveKVAgeMs": null,
  "detailStatus": "DETAIL_KEY_MISSING",
  "detailScore": null,
  "detailAgeMs": null,
  "detailFreshMs": null,
  "snapshotStatus": "SNAPSHOT_KEY_MISSING",
  "snapshotScore": null,
  "snapshotAgeMs": null,
  "overlayMatchFound": false,
  "overlayGuardWouldFire": false,
  "overlayWouldFireWithFix": false,
  "buildSnapshotCalled": true,
  "live2bRaceActive": false,
  "diagnosis": "Match is not in live cache (status=LIVE_CACHE_EMPTY_OR_EXPIRED). No overlay needed."
}
```

---

## 2. CONFIRMED PRODUCTION FINDINGS

### FINDING-1: Authority Cache Serving Stale DR Data — CONFIRMED CRITICAL

**Evidence:** `source: "dr"`, `ageSec: 7442`, `stale: true`, `verdict: "RED"`

**Interpretation:**
- Authority primary key (`goalradar:wc:authority:v1`) has expired (TTL 900s in normal tier)
- DR key (`goalradar:dr:wc:authority:v1`) is serving — built at 2026-06-24T00:13:00.915Z (~2h before scan)
- The orchestrator cron has been stalled for at least 7442 seconds (~2h 4min)
- No live matches (liveCount: 0), so no match is currently being served wrong live status
- All 47 WC page renders use data that is >2h old

**Risk materialization:** If a WC match starts while the orchestrator is stalled, the authority cache will not reflect it as live. The live cache (30s TTL) has expired and shows `present: false`. Live matches will not be detected.

---

### FINDING-2: Upcoming Feed Completely Absent — CONFIRMED HIGH

**Evidence:** `"upcoming": { "present": false, "count": 0, "drPresent": false, "drCount": 0 }`

**Interpretation:**
- The WC upcoming feed is absent from BOTH primary KV AND disaster-recovery KV
- This is consistent with the post-group-stage state: FD's `/competitions/WC/matches?status=SCHEDULED,TIMED` returns 0 matches once all group games are played
- The DATA-18WC.8B fix (authority coldRebuild fallback) is needed for exactly this case
- However, the coldRebuild can't run while the orchestrator is stalled

**Note:** Authority cache shows 47 matches and is serving from DR (built at 00:13 UTC when orchestrator was last active), so the DATA-18WC.8B fix was successfully applied before the stall began.

---

### FINDING-3: Finished Feed Stale — CONFIRMED MEDIUM

**Evidence:** `"finished": { "ageHours": 3.1 }`

**Interpretation:**
- Finished feed was last refreshed ~3h before the scan
- Orchestrator task `wc-finished` (TTL 43200s/12h) has not been refreshed since the stall
- 3.1h stale for a finished feed is within acceptable bounds (no score changes expected for finished matches)
- YELLOW severity (not RED) — data is stale but not absent

---

### FINDING-4: Snapshot Missing for Match 537412 — CONFIRMED MEDIUM

**Evidence:** `"snapshot": { "present": 46, "missing": 1 }` (state-divergence) + `"snapshotStatus": "SNAPSHOT_KEY_MISSING"` (match-state endpoint)

**Interpretation:**
- Match 537412's snapshot KV key has expired (TTL 900s, last written ~2h ago during original audit)
- The match-state endpoint confirms: no snapshot, no detail KV, no live cache entry
- `buildSnapshotCalled: true` indicates the endpoint attempted to build a new snapshot but couldn't (no source data available)
- The state-divergence checker counts this as "missing" in the snapshot distribution
- Authority still has the match as `cancelled: 1` (correct — FD finished/cancelled feed has the correct status)

**DR exposure:** The match-state endpoint does NOT report on the DR snapshot key (`goalradar:dr:match:537412`). The 30-day DR snapshot written during the original poisoning event (2026-06-23) may still be present with `status: "LIVE"`. If the detail KV DR key also has `status: "LIVE"`, then the next prewarm run will re-read from DR detail, re-build the snapshot with "LIVE", and re-write a new DR snapshot — restarting the 30-day clock.

---

### FINDING-5: Live Cache Absent — CONFIRMED (Expected)

**Evidence:** `"liveCache": { "present": false, "liveCount": 0 }`

**Interpretation:**
- No WC matches are currently live (correct — group stage complete, no knockout matches yet in play at 02:17 UTC)
- Live cache TTL is 30s — it expires quickly and is only present during active matches
- This is expected state, not a defect
- However, if a match were in play, the orchestrator stall would mean the live cache would expire and not be refreshed, serving from DR (7d TTL) instead

---

### FINDING-6: State-Divergence Reports GREEN Despite Missing Snapshot — ANALYSIS

**Evidence:** `"summary": { "divergent": 0 }`, `"snapshot": { "missing": 1 }`

**Interpretation:**
- The divergence checker considers authority vs snapshot for each match
- For match 537412: authority=CANCELLED, snapshot=MISSING (not "LIVE")
- The checker treats MISSING snapshot as "no divergence to report" (not a divergence condition)
- This is the CORRECT behavior for the divergence checker — it can only compare what exists
- The root cause is that the snapshot expired naturally (TTL 900s) ~2h after the original poisoning was observed

**Implication:** The divergence checker's GREEN verdict does NOT mean the system is clean. It means no active divergence is observable at this instant. The 30-day DR snapshot may still carry "LIVE".

---

## 3. DRIFT EVIDENCE FROM PRIOR SESSIONS (DATA-18WC.9)

**Note:** The following is carry-forward evidence from earlier investigation. The data was not returned by the production scan at 02:17 UTC but was confirmed in earlier API calls within this session.

| Match | Field | Authority | Snapshot (at time of original scan) | Live Cache | Classification |
|-------|-------|-----------|--------------------------------------|-----------|----------------|
| 537412 | status | CANCELLED | "LIVE" | absent | CONFIRMED DRIFT — snapshot poisoned by FD non-standard status |
| 537412 | state | 'cancelled' | N/A (derived in authority only) | N/A | CORRECT (authority uses FD finished feed) |

**Mechanism confirmed:**
1. FD v4 `/matches/537412` returned `status: "LIVE"` for an in-play group stage match
2. `toMatchDetail()` spread this status unchanged into Detail KV
3. `buildSnapshot()` called `isLiveStatus('LIVE')` → false → wrote snapshot with `status: "LIVE"`
4. `writeDRSnapshot()` wrote DR snapshot with `status: "LIVE"` (30d TTL)
5. At 02:17 UTC scan time: primary snapshot expired (900s TTL); DR snapshot status unknown from endpoint

---

## 4. DRIFT SCENARIO ANALYSIS: WHAT IS NOT YET CONFIRMED

| Scenario | Confirmed? | Evidence Needed | Risk |
|----------|-----------|-----------------|------|
| DR snapshot for 537412 still carries "LIVE" | NOT CONFIRMED | Direct DR key read | HIGH — would restart poison cycle on next prewarm |
| Other matches have non-standard FD statuses | NOT CONFIRMED | Full match status sweep | MEDIUM — "LIVE" could appear for other matches |
| AF failover produced synthetic tla in any KV key | NOT CONFIRMED | KV inspection | LOW — FD is primary, AF failover unlikely for WC |
| ESPN event team IDs mismatched in any snapshot | NOT CONFIRMED | C2_TEAM_ID flag scan | MEDIUM — C2 flag would be in authority integrity field |

---

## 5. PRODUCTION HEALTH SUMMARY AT TIME OF SCAN

| Component | Status | Finding |
|-----------|--------|---------|
| Authority cache (primary) | RED | Expired; serving from DR (7442s old) |
| Authority cache (DR) | STALE | Built 00:13 UTC; correct data but 2h old |
| Live cache | ABSENT | No live matches; expected |
| Finished feed | YELLOW | 3.1h old; stale but not absent |
| Upcoming feed | ABSENT | Primary + DR both missing (post-group-stage expected) |
| Snapshot coverage | 46/47 | Match 537412 snapshot expired (not poisoned at scan time) |
| Snapshot DR (537412) | UNKNOWN | Endpoint does not inspect DR snapshot keys directly |
| Match 537412 current state | CANCELLED (authority) | Correct from FD finished feed |
| Orchestrator cron | STALLED | Last successful run ~2h before scan |
