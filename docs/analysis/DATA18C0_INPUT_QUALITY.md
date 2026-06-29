# DATA-18C.0 Phase 4 — Authority Input Quality
## Freshness, Coverage, and Completeness of All Authority Cache Inputs

Audit timestamp: 2026-06-17T09:30:14Z  
Data source: live KV reads + code analysis

---

## 1. Input Source Overview

The Authority Cache (`writeAuthorityCache()`) reads five input sources:

| # | Source | KV Key | TTL | Writer |
|---|--------|--------|-----|--------|
| 1 | Upcoming feed | `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` | 15m fresh / 30m stale | Orchestrator `wc-upcoming` |
| 2 | FINISHED feed | `goalradar:/competitions/WC/matches?status=FINISHED` | 15m fresh / 12h stale | Orchestrator `wc-finished` |
| 3 | Live feed | `goalradar:live:matches:WC` | 30s | Orchestrator `refreshLiveMatches` |
| 4 | Snapshots | `goalradar:match:{id}` × N | 7d (FINISHED) | `writeKVSnapshot` on demand |
| 5 | ESPN IDs | `goalradar:espn:lookup:{id}` × N | 30d | `getOrLookupEspnId` |

---

## 2. Source 1 — Upcoming Feed (SCHEDULED/TIMED)

| Field | Value |
|-------|-------|
| KV key | `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` |
| Entry present | YES |
| Match count | 84 |
| Age | 12 min |
| Is fresh | YES (freshUntil not yet passed) |
| DR exists | YES (88 matches) |
| DR age | unknown |

**Coverage:** 84 of the expected ~81 upcoming matches (3 extra likely double-counted
with matches also in the FINISHED feed).

**Quality issue — 3 TIMED matches in FINISHED feed:**
537403 (Portugal vs Congo DR), 537409 (England vs Croatia), 537410 (Ghana vs Panama) appear
in the FINISHED feed with `fdStatus=TIMED`. These same matches are presumably in the
UPCOMING feed too. The STATE_RANK merge (TIMED=0 in both feeds) is non-deterministic for
equal-rank entries — the FINISHED feed's TIMED entries win because the merge processes
recent (FINISHED feed) after upcoming, and `STATE_RANK >= existing` is `>=` (not strictly `>`).
Result: today's TIMED matches show up from the FINISHED feed's version. No display impact since
both feeds have TIMED status, but it indicates the FD API is returning unexpected data in the
FINISHED endpoint.

**Freshness: GREEN**

---

## 3. Source 2 — FINISHED Feed

| Field | Value |
|-------|-------|
| KV key | `goalradar:/competitions/WC/matches?status=FINISHED` |
| Entry present | YES |
| Match count | 23 (20 FINISHED + 3 TIMED anomalies) |
| Age | 12 min |
| Is fresh | YES |
| **DR exists** | **NO** |
| DR match count | 0 |

**Completeness:** 20 actual FINISHED matches. The WC started June 11. Group stage has
4–5 matches per day across the 12 groups. By June 17 (day 6), ~24 group stage matches
should have finished (4 matches/day × 6 days). 20 in the FINISHED feed is plausible —
some same-day matches may not yet be reflected.

**Critical gap — No DR key:** The FINISHED feed DR key (`goalradar:dr:/competitions/WC/matches?status=FINISHED`)
does not exist. This means:
- `readKVOnly()` finds no disaster-recovery fallback
- If the primary key expires (12h after last write), `getWCResultsCached()` returns `{ matches: [] }`
- Results page immediately shows 0 matches

**Root cause of missing DR:** The DR key for KV-cache entries is written by `storeDisasterKey()`
inside `revalidateInBackground()`, which runs only when `withKVCache()` is called AND the data
is stale enough to trigger SWR. Since `getWCResultsCached()` uses `readKVOnly()` (never triggers
SWR), the DR for the FINISHED feed is ONLY written when the orchestrator's `wc-finished` task
runs `refreshEndpoint()`. If the cron ran with `minIntervalSec=1800` and skipped the full write
path due to the fresh guard, the DR write was skipped too.

**Freshness: GREEN**  
**DR Coverage: RED**

---

## 4. Source 3 — Live Feed

| Field | Value |
|-------|-------|
| KV key | `goalradar:live:matches:WC` |
| Audited | NO (not included in data18c0-audit endpoint) |

The live feed was not read by the audit endpoint. Based on code analysis:
- Written by `refreshLiveMatches()` in the orchestrator (every 30 min)
- No matches currently in play (today is Jun 17, matches start at 18:00+ local time)
- Live feed expected to be empty or contain TIMED matches for tonight

**Freshness: UNKNOWN (not audited)**  
**Coverage: N/A (no live matches currently)**

---

## 5. Source 4 — Snapshots

| Field | Value |
|-------|-------|
| Keys | `goalradar:match:{id}` for 20 FINISHED matches |
| Coverage | 20/20 — 100% |
| Goals present | 1/20 — 5% |
| Status correct | 20/20 — 100% |
| Score correct | 20/20 — 100% |
| Enrichment ok | 1/20 — 5% |

Snapshot coverage is complete but enrichment quality is critically low. The Authority
Cache builder reads from `snapshotMap` — it will get correct scores but empty goals/cards/subs
for 95% of matches.

**Coverage: GREEN**  
**Quality: RED (5% enrichment)**

---

## 6. Source 5 — ESPN ID Lookups

| Field | Value |
|-------|-------|
| Keys | `goalradar:espn:lookup:{id}` for all FINISHED matches |
| Coverage | **0/20 — 0%** |
| TTL | 30 days |
| Expected status | Should be present if populated within last 30 days |

Zero ESPN IDs. All lookup keys are absent. Possible causes:

**A) ESPN ID population never ran for WC 2026 match IDs:**
The `getOrLookupEspnId(fdId)` function is called lazily during enrichment. If enrichment
was never triggered successfully for any match, the lookups were never written.

**B) 30-day TTL already expired:**
WC 2026 started June 11. If ESPN IDs were written June 11–12, the 30-day TTL would expire
July 11–12. Today is June 17 — only 6 days into the tournament. The 30-day TTL should
NOT have expired. So (A) is the more likely cause.

**C) ESPN search API returns no matches for current WC IDs:**
The `searchForEspnMatch()` function in `espn-id-map.ts` searches ESPN by date/team name.
If ESPN's search API does not return WC 2026 matches (e.g., different league slug for
North America co-hosted WC), all lookups return `LookupMiss` sentinels which are NOT
written as positive IDs (they're written as objects, not strings).

The audit confirms `espnIdPresent: false` = `typeof espn !== 'string'`. A `LookupMiss`
sentinel would also show as `espnIdPresent: false`. So it's possible that ESPN IDs were
ATTEMPTED but returned LookupMiss for all 20 matches.

**Coverage: RED (0%)**

---

## 7. Input Quality Summary

| Source | Freshness | Coverage | Completeness | Overall |
|--------|-----------|----------|--------------|---------|
| Upcoming feed | GREEN (12 min) | GREEN (84 matches) | YELLOW (3 TIMED anomalies) | YELLOW |
| FINISHED feed | GREEN (12 min) | GREEN (20 matches) | RED (no DR key) | RED |
| Live feed | UNKNOWN | N/A (none live) | N/A | UNKNOWN |
| Snapshots | GREEN (5.2h prewarm) | GREEN (100%) | RED (5% enrichment) | RED |
| ESPN IDs | RED (0 present) | RED (0%) | RED | RED |

**Overall input quality for Authority Cache activation: RED**

Three of five inputs have RED quality issues. The cache would be structurally valid
(correct states and scores) but enrichment-empty for 90% of FINISHED matches.
