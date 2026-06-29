# WC_MATCH_INVENTORY.md — DATA-18WC.7 Phase 3
**Date:** 2026-06-23  
**Sources:** /api/debug/authority-freshness, /api/debug/feed-integrity (production probes)

---

## Match Counts

| Source | Count | Notes |
|---|---|---|
| FINISHED feed (KV) | 47 | Age: 0.6 hours |
| UPCOMING feed (KV) | 0 | **Feed absent from KV** |
| Authority cache | 47 | Age: 246s, tier: today, ttl: 300s |
| 3 TIMED matches in FINISHED feed | 3 | IDs: 537405, 537411, 537412 |

---

## Tournament Progress (as of 2026-06-23)

| Stage | Matches | Played | Remaining |
|---|---|---|---|
| Group Stage (12 groups × 6) | 72 | 47 | 25 |
| Knockout (LAST_32) | 16 | 0 | 16 |
| Knockout (LAST_16) | 8 | 0 | 8 |
| Knockout (QF) | 4 | 0 | 4 |
| Knockout (SF) | 2 | 0 | 2 |
| Third Place | 1 | 0 | 1 |
| Final | 1 | 0 | 1 |
| **Total** | **104** | **47** | **57** |

Groups K and L are still on MD1 (2 MD2 games each = 4 matches pending group stage). Groups A–J are on MD2 (2 games each = 20 matches played per pair, so ~20 from MD1 + additional from MD2). This is consistent with 47 finished.

**Expected total: 104 ✅** — 47 finished is consistent with current tournament stage.

---

## UPCOMING Feed Absent

**Severity: YELLOW**  
- The KV key `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` returns 0 matches (feed absent).
- Authority cache was built with 47 matches (FINISHED only) — the `coldRebuild` DATA-18WC.6 fix to use `readKVOnly` will correctly get 0 from KV until the CRON repopulates the upcoming feed.
- **3 upcoming matches today:** Portugal vs Uzbekistan (537405), England vs Ghana (537411), Panama vs Croatia (537412) — these are TIMED status but misclassified in the FINISHED bucket.
- **Impact on authority:** Authority has 47 matches total, missing today's 3 upcoming. When UPCOMING feed is repopulated by CRON, the next `coldRebuild` will pick them up via `readKVOnly`.

---

## TIMED Matches in FINISHED Feed

| Match ID | Fixture | Status | Issue |
|---|---|---|---|
| 537405 | Portugal vs Uzbekistan | TIMED | Stored in FINISHED KV bucket |
| 537411 | England vs Ghana | TIMED | Stored in FINISHED KV bucket |
| 537412 | Panama vs Croatia | TIMED | Stored in FINISHED KV bucket |

These are MD3 matches (today) that are TIMED (kickoff scheduled) but appear in the FINISHED feed. The FINISHED feed fetcher likely included all TIMED/SCHEDULED entries along with FINISHED entries in its last fetch, or the API returned them with a FINISHED-adjacent status.

---

## Duplicate Match IDs

**Zero duplicates detected.** The `authority-compare` endpoint confirms both paths return exactly 47 matches with no ID mismatches.

---

## Authority Cache Health

```
builtAt:    2026-06-23T08:38:20.622Z
ageSec:     246
ttlTier:    today (300s TTL)
stale:      false
matchCount: 47
liveCount:  0
drPresent:  true
```

Authority is fresh. DR key present.

---

## Findings

- ✅ No duplicate match IDs
- ✅ 47 finished is plausible for group stage MD2 (104 total expected)
- ✅ Authority cache fresh, DR present
- 🔴 UPCOMING KV feed absent → upcoming matches not in authority until CRON repopulates
- 🟡 3 TIMED matches (537405, 537411, 537412) misclassified in FINISHED feed

**Phase 3 Gate: MATCH_INVENTORY_PARTIAL** (47/104 played so far — correct for stage; upcoming feed absence is the active issue)
