# WC_UPCOMING_PRODUCTION_GAP.md — DATA-18WC.8A-R Production Rendering Verification

**Date:** 2026-06-24
**Method:** Live production fetches only — no code inspection

---

## 1. VERDICT

**Hypothesis A (full) confirmed: DATA MISSING**

The KV upcoming feed is empty — primary + DR both absent. The authority cache holds 47 matches, all FINISHED group-stage matches. Zero scheduled/timed/upcoming matches exist in any layer.

**Root cause:** The orchestrator cron is not writing knockout-round fixtures to the upcoming feed. It likely queries GROUP_STAGE status only and has not been updated to include LAST_32, LAST_16, QUARTER_FINALS, SEMI_FINALS, FINAL knockout fixtures starting 2026-06-28.

---

## 2. EVIDENCE TABLE

| Source | Upcoming Count | Notes |
|--------|---------------|-------|
| /world-cup-2026 HTML | **0** | Section present, shows "No upcoming fixtures available" |
| /world-cup-2026/fixtures HTML | **0** | 47 matches rendered, ALL FINISHED Jun 11–23 |
| /world-cup-2026/schedule HTML | N/A | HTTP 404 — route does not exist |
| KV upcoming feed (primary) | **0** | feeds.upcoming.present = false |
| KV DR fallback | **0** | feeds.upcoming.drPresent = false |
| Authority cache (total) | **47** | All FINISHED — zero scheduled/timed |
| Authority state=scheduled | **0** | None |
| Authority state=timed | **0** | None |
| KV finished feed | **47** | present=true, age=1.3h |

---

## 3. PAGE-BY-PAGE FINDINGS

### /world-cup-2026
- Upcoming section: **present in DOM, empty**
- Message shown: "No upcoming fixtures available — Upcoming matches will appear here once scheduled."
- Knockout bracket section is visible (Round of 32 starting Jun 28) — uses a separate data source
- The bracket and the upcoming feed are NOT connected

### /world-cup-2026/fixtures
- **47 fixtures rendered**, all FINISHED, date range Jun 11–23 only
- One CANCELLED (Panama vs Croatia)
- **No future-dated matches** anywhere on the page
- Knockout fixtures (LAST_32 starting Jun 28) completely absent

### /world-cup-2026/schedule
- HTTP 404 — route does not exist

---

## 4. API RESPONSE EVIDENCE

### /api/debug/feed-integrity
```json
{
  "verdict": "RED",
  "feeds": {
    "upcoming": {
      "present": false,
      "count": 0,
      "drPresent": false,
      "drCount": 0
    },
    "finished": {
      "present": true,
      "count": 47,
      "ageHours": 1.3
    },
    "authority": {
      "present": true,
      "count": 47
    }
  }
}
```

Authority cache: 47 matches, all FINISHED. Zero scheduled/timed.

---

## 5. DIAGNOSIS

| Hypothesis | Description | Status |
|-----------|-------------|--------|
| A — Data missing | KV feed empty, authority empty | ✅ **CONFIRMED** |
| B — Filtered in render | Authority has data but page hides it | ❌ Eliminated |
| C — ISR stale | Old cached page, data since restored | ❌ Eliminated |

**Evidence chain:**
1. KV upcoming feed = 0, both primary and DR absent
2. Authority cache = 47 FINISHED only — faithfully reflects KV state
3. HTML renders 0 upcoming — correct behavior given empty feed
4. Fixtures page shows only Jun 11–23 group stage — knockout fixtures never written
5. FINISHED feed also stale (1.3h) — cron may have stopped after group stage concluded

**The bracket section shows Round of 32 starting Jun 28 via a separate source — confirming the match data EXISTS somewhere (FD API) but is not flowing through the upcoming feed pipeline.**

---

## 6. RECOMMENDED ACTIONS

| Priority | Action |
|----------|--------|
| **P0** | Trigger orchestrator manually for knockout fixtures (status=SCHEDULED,TIMED covering Jun 28 onward) |
| **P0** | Confirm orchestrator's FD API query includes knockout stages, not GROUP_STAGE only |
| **P1** | Verify Vercel/edge cron logs — stale FINISHED feed (1.3h) suggests scheduled job may have stalled after group stage |
| **P1** | Re-run DATA-18WC.8B once feed populated to verify authority cache picks up scheduled knockout matches |
| **P2** | After fix: re-fetch /api/debug/feed-integrity — expect upcoming.present=true, count>0 |

---

## 7. WHAT THE ORCHESTRATOR MUST QUERY

The orchestrator's FD API call must target:
```
GET /competitions/WC/matches?status=SCHEDULED,TIMED
```
NOT limited to group stage. This should return all 57 remaining knockout matches.

Current orchestrator behavior: appears to only write group-stage matches (47 FINISHED). Has not been updated to query/write knockout-round fixtures after the group stage concluded 2026-06-23.

---

**Gate: WC_UPCOMING_BLOCKED — Orchestrator must be updated/triggered for knockout fixtures**
