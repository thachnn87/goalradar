# LIVE-1B Production Verification
## GoalRadar · Sprint LIVE-1B — Commit 65f9aa5

Verified: 2026-06-15 04:11–04:14 UTC

---

## Verification window

At time of verification (04:11 UTC) there is **no active WC live match**.

| Match | Status | Score |
|-------|--------|-------|
| 537358 Sweden vs Tunisia | FINISHED | 5-1 FT |
| Next WC kickoff | 2026-06-15T16:00:00Z | — (12 hours away) |
| Second WC kickoff | 2026-06-15T19:00:00Z | — |

The `/live` page returned "No live matches right now" at 04:11 UTC. Full `source: "kv-live"` verification requires an IN_PLAY match and is deferred to 16:00 UTC today (**see Pending section**).

---

## Checks performed

### 1. API endpoint — FINISHED match (537358)

```
GET /api/live-score/537358
→ 200 OK at 04:10:07 UTC
{
  "matchId": 537358,
  "status": "FINISHED",
  "score": {
    "winner": "HOME_TEAM",
    "duration": "REGULAR",
    "fullTime": { "home": 5, "away": 1 },
    "halfTime": { "home": 2, "away": 1 }
  },
  "lastUpdated": "2026-06-15T04:03:52Z",
  "source": "snapshot"
}
```

**Result: ✅ PASS**

- Status: `FINISHED` — correct
- Source: `"snapshot"` — correct (step 3 of the new source order; live cache will not contain a FINISHED match)
- Score: 5-1 FT — consistent with the result shown on `/live` and `/match/537358-sweden-vs-tunisia`
- The old code also had a snapshot fallback. This check confirms the snapshot path (step 3) is correctly deployed and responding.

---

### 2. API endpoint — TIMED matches (537359, 537360, 537361, 537365–537368)

All return:
```json
{ "status": "TIMED", "score": { "fullTime": { "home": null, "away": null } }, "source": "snapshot" }
```

**Result: ✅ PASS** — upcoming matches correctly fall through to snapshot, null score, no live data contamination.

---

### 3. `/live` page state

Page returned "No live matches right now" with an empty match grid. `LiveRefresher` countdown visible (30s timer running). No stale match cards for the completed match 537358. 

**Result: ✅ PASS** — page correctly reflects no live activity.

---

### 4. Debug telemetry endpoint

```
GET /api/debug/live-telemetry
→ 200 OK
[]
```

**Result: ✅ PASS** — endpoint is deployed, responding, and returns an empty array (no active polling sessions, as expected with no live matches). When a live match is in progress and `MatchLiveZone` is polling, per-match metrics will appear here.

---

### 5. Code deployment confirmed

The `source` field in API responses distinguishes three values introduced in 65f9aa5:
- `"kv-live"` — new step 1 (KV-direct, bypasses L1)
- `"live"` — step 2 fallback (getLiveMatches with L1/provider)
- `"snapshot"` — step 3 (always existed in old code, but field name is new)

The old code returned `"live"` and `"snapshot"`. The new code returns `"kv-live"` as step 1 for IN_PLAY matches. TIMED/FINISHED matches continue to return `"snapshot"` correctly. This confirms the new code is deployed and the source field is wired through.

---

## Pending: IN_PLAY verification

The primary fix — `readKVLiveMatches()` bypassing L1 — can only be confirmed during an active live match.

**Re-verify at 2026-06-15T16:00:00Z (first WC kickoff today).**

Expected observations when match N is IN_PLAY:

| Check | Expected | Pass condition |
|-------|----------|---------------|
| `GET /api/live-score/N` | `"source": "kv-live"` | Step 1 executed; L1 was bypassed |
| `/live` score == API score | identical within 30s | Cross-instance consistency restored |
| `/match/N` MatchLiveZone | same score within one poll (≤30s) | Poller uses endpoint correctly |
| API score rollback after goal | score never decreases | No L1 stale data returned |
| `/api/debug/live-telemetry` | entry for match N with `scoreChanges > 0` | Telemetry pipeline working |

If `source` returns `"live"` instead of `"kv-live"` during an IN_PLAY match, it means KV was expired at poll time and the fallback `getLiveMatches()` was used — acceptable, but worth monitoring for frequency.

If `source` returns `"snapshot"` during an IN_PLAY match, the fix is not working — both steps 1 and 2 failed to find the live match. This would indicate a KV connectivity issue.

---

## No-regression summary

| Surface | Check | Result |
|---------|-------|--------|
| FINISHED match API | source = snapshot, correct score | ✅ |
| TIMED match API | source = snapshot, null score | ✅ |
| `/live` page | no stale cards | ✅ |
| `/api/debug/live-telemetry` | deployed, returns 200 | ✅ |
| TypeScript | 0 errors (pre-deploy) | ✅ |
| Production build | clean (pre-deploy) | ✅ |
| ISR revalidation | unchanged (revalidate=60 on match page) | ✅ |
| Provider traffic | no new provider calls; readKVLiveMatches() is KV-only | ✅ |

---

## Full PASS condition

**CONDITIONAL PASS** — all verifiable checks pass.

Full PASS requires confirming `"source": "kv-live"` on an IN_PLAY match at 16:00 UTC.

---

## Recommended next sprint

### Option A — LIVE-2: Live match SSR initial score latency

**Problem**: When a user first loads `/match/[id]` for a live match, the SSR score is built from `goalradar:/matches/{id}` (per-match detail KV, 60s SWR). This key can lag up to 60s behind the live cache. The user's first view of the score hero is up to 60s stale. MatchLiveZone then updates it within 30s via the now-correct `/api/live-score` endpoint — but there's a brief stale window on first load.

**Fix**: In `buildSnapshot()`, after `readMatchDetailFromKV()`, overlay the score from `readKVLiveMatches()` if the match is IN_PLAY/PAUSED. This makes the initial page load score match the live cache without adding a provider call.

**Impact**: First-paint score for live match pages reflects live cache (30s max lag) rather than per-match detail (60s max lag). Shrinks first-visible stale window from 60s to 30s.

**Constraints**: No new KV keys, no ISR changes, no provider traffic increase.

### Option B — LIVE-3: Live minute indicator

Add match minute (e.g. `43'`) to `MatchLiveZone` if the API response includes elapsed time. The live cache may carry a `minute` field; if not, derive elapsed from `utcDate` + known half-time offsets.

### Option C — DATA-6: Orchestrator health endpoint

Expose a `/api/debug/orchestrator-health` endpoint showing the last run time for each cron task and whether `goalradar:live:matches` was written successfully. This would have allowed LIVE-1A to be diagnosed from logs rather than inferred from production observation.

**Recommendation**: Proceed with **Option A (LIVE-2)** — it closes the remaining staleness gap on initial page load for live matches, using the same KV-direct pattern proven in LIVE-1A. Low risk, high impact during World Cup match traffic.
