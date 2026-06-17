# DATA-18G Phase 3 — Feed Integrity Design

Date: 2026-06-17

---

## Feeds Validated

| Feed | KV Key | Written By | Expected Content |
|------|--------|-----------|-----------------|
| FINISHED | `goalradar:/competitions/WC/matches?status=FINISHED` | orchestrator cron (FD results endpoint) | Only `FINISHED` status matches |
| UPCOMING | `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` | orchestrator cron (FD upcoming endpoint) | Only `SCHEDULED` or `TIMED` status matches |
| Authority | `goalradar:wc:authority:v1` | `writeAuthorityCache()` | All 104 WC matches as `CanonicalMatch[]` |

---

## Checks Implemented (`/api/debug/feed-integrity`)

### Check 1 — TIMED/SCHEDULED inside FINISHED feed
**Severity:** YELLOW  
**Cause:** FD API returned a non-FINISHED match in the results endpoint, or the feed was cached during a match state transition.  
**Impact:** Non-critical — authority cache ignores status from FINISHED feed; it uses the higher-STATE_RANK entry when merging.  
**Resolution:** Resolves on next orchestrator cron cycle.

### Check 2 — FINISHED inside UPCOMING feed
**Severity:** YELLOW  
**Cause:** Match finished but UPCOMING feed KV entry is stale (not yet refreshed).  
**Impact:** Non-critical — authority cache promotes FINISHED status over SCHEDULED via STATE_RANK.  
**Resolution:** Resolves on next orchestrator cron cycle (every 30 min).

### Check 3 — Duplicate IDs across feeds
**Severity:** YELLOW (cross-feed) / RED (within-feed)  
**Cause (cross-feed):** Expected for matches recently transitioned — same match in both FINISHED and UPCOMING is a brief window, not an error.  
**Cause (within-feed):** Data corruption or FD API pagination issue.  
**Impact (within-feed):** Authority cache may build duplicate `CanonicalMatch` entries. RED.

### Check 4 — FINISHED match missing from authority
**Severity:** YELLOW  
**Cause:** Authority cache built before FINISHED feed was populated, or authority TTL expired and cold rebuild is in progress.  
**Impact:** Non-critical — match will appear in authority on next rebuild.

### Check 5 — Invalid state transition (FINISHED feed → `scheduled` in authority)
**Severity:** RED  
**Cause:** Authority cache is stale or corrupt — it shows `scheduled` for a match the FD feed marks FINISHED.  
**Impact:** Listing pages show the match as upcoming when it has already been played. User-visible.  
**Resolution:** Force authority cache rebuild via orchestrator cron.

### Check 6 — Feed age > 1h (YELLOW) / > 6h (RED)
**Severity:** YELLOW → RED  
**Cause:** Orchestrator cron has stalled or Vercel cron is misconfigured.  
**Impact:** Stale scores on listing pages.  
**Resolution:** Check orchestrator cron logs; trigger manually if needed.

---

## Feed Age SLOs

| Feed | Expected refresh | YELLOW threshold | RED threshold |
|------|-----------------|-----------------|---------------|
| FINISHED | Every 30 min | > 1h | > 6h |
| UPCOMING | Every 30 min | > 1h | > 6h |
| Authority cache | Every 30 min (normal) / every 30s (live) | 1.5× TTL | DR serving = primary evicted |

---

## State Transition Rules (invariants)

These invariants must hold at all times:

1. **No FINISHED match has `state='scheduled'` in authority** — FD source of truth
2. **No match appears in both FINISHED and UPCOMING feed with same ID** — cross-feed dedup
3. **FINISHED feed count is monotonically non-decreasing** — matches don't un-finish
4. **Authority match count ≥ FINISHED feed count** — authority is a superset

---

## Feed Integrity Endpoint

`GET /api/debug/feed-integrity?secret=$CRON_SECRET`

Returns:
```json
{
  "verdict": "GREEN | YELLOW | RED",
  "redCount": 0,
  "yellowCount": 0,
  "issueCount": 0,
  "feeds": {
    "finished": { "present": true, "count": 23, "ageHours": 0.4 },
    "upcoming": { "present": true, "count": 81, "ageHours": 0.4 },
    "authority": { "present": true, "count": 104 }
  },
  "issues": []
}
```
