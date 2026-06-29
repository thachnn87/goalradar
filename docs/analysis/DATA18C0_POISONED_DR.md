# DATA-18C.0 Phase 1 — Poisoned DR Audit
## KV Snapshot Integrity: All FINISHED WC Matches

Audit timestamp: 2026-06-17T09:30:14Z  
Data source: `GET /api/debug/data18c0-audit` (live KV read)

---

## Definition

A **poisoned DR** is a match where:
- `score.fullTime.home + score.fullTime.away > 0` (match had goals), AND
- `dr.match.goals.length === 0` (DR snapshot records zero goals)

When a poisoned DR exists, the downgrade guard in `writeKVSnapshot()` cannot protect
the next rebuild — the guard aborts only if `dr.goals.length > 0`. A poisoned DR means
the next 0-goal snapshot build will permanently overwrite with no protection.

---

## 1. Feed State at Audit Time

| Feed | Match count | Age | Fresh? | DR exists? |
|------|------------|-----|--------|------------|
| `goalradar:/competitions/WC/matches?status=FINISHED` | 23 | 12 min | ✓ | **NO** |
| `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` | 84 | 12 min | ✓ | ✓ (88 matches) |

**Critical:** The FINISHED feed has **no DR key**. If this key expires (12h stale TTL),
`readKVOnly()` finds no fallback and `getWCResultsCached()` returns `{ matches: [] }`.

**Note:** 3 matches with `fdStatus=TIMED` appear inside the FINISHED feed:
537403 (Portugal vs Congo DR), 537409 (England vs Croatia), 537410 (Ghana vs Panama).
These are today's UPCOMING matches that should not be in the FINISHED feed. See Phase 4 for
data quality analysis.

---

## 2. Full Poisoned DR Match Table

| matchId | Home | Away | Date | Score | Snap age | DR age | DR goals | ESPN ID? | Status |
|---------|------|------|------|-------|----------|--------|----------|----------|--------|
| **537327** | Mexico | South Africa | Jun 11 | 2–0 | 5.2 h | 5.2 h | 0 | NO | **POISONED** |
| **537328** | South Korea | Czechia | Jun 12 | 2–1 | 5.2 h | 5.2 h | 0 | NO | **POISONED** |
| **537333** | Canada | Bosnia-Herz. | Jun 12 | 1–1 | 5.2 h | 5.2 h | 0 | NO | **POISONED** |
| **537334** | Qatar | Switzerland | Jun 13 | 1–1 | 5.2 h | 5.2 h | 0 | NO | **POISONED** |
| **537339** | Brazil | Morocco | Jun 13 | 1–1 | 5.2 h | 5.2 h | 0 | NO | **POISONED** |
| **537340** | Haiti | Scotland | Jun 14 | 0–1 | 5.2 h | 5.2 h | 0 | NO | **POISONED** |
| **537345** | United States | Paraguay | Jun 13 | 4–1 | 5.2 h | 5.2 h | 0 | NO | **POISONED** |
| **537346** | Australia | Turkey | Jun 14 | 2–0 | 5.2 h | 5.2 h | 0 | NO | **POISONED** |
| **537351** | Germany | Curaçao | Jun 14 | 7–1 | 5.2 h | 5.2 h | 0 | NO | **POISONED** ★ |
| **537352** | Ivory Coast | Ecuador | Jun 14 | 1–0 | 5.2 h | 5.2 h | 0 | NO | **POISONED** |
| **537357** | Netherlands | Japan | Jun 14 | 2–2 | 5.2 h | 5.2 h | 0 | NO | **POISONED** |
| **537358** | Sweden | Tunisia | Jun 15 | 5–1 | 5.2 h | 5.2 h | 0 | NO | **POISONED** |
| **537363** | Belgium | Egypt | Jun 15 | 1–1 | 5.2 h | 5.2 h | 0 | NO | **POISONED** |
| **537364** | Iran | New Zealand | Jun 16 | 2–2 | 5.2 h | 5.2 h | 0 | NO | **POISONED** |
| **537370** | Saudi Arabia | Uruguay | Jun 15 | 1–1 | 5.2 h | 5.2 h | 0 | NO | **POISONED** |
| **537391** | France | Senegal | Jun 16 | 3–1 | 5.2 h | 5.2 h | 0 | NO | **POISONED** ★ |
| **537392** | Iraq | Norway | Jun 16 | 1–4 | 5.2 h | 5.2 h | 0 | NO | **POISONED** ★ |
| **537397** | Argentina | Algeria | Jun 17 | 3–0 | 5.2 h | 5.2 h | 0 | NO | **POISONED** ★ |
| 537369 | Spain | Cape Verde | Jun 15 | 0–0 | 5.2 h | 5.2 h | 0 | NO | OK (0–0, no goals expected) |
| **537398** | Austria | Jordan | Jun 17 | 3–1 | 1.0 h | 1.0 h | **4** | NO | ✓ HEALTHY |
| 537403 | Portugal | Congo DR | Jun 17 | — | 0.2 h | 0.2 h | 0 | NO | TIMED (not finished) |
| 537409 | England | Croatia | Jun 17 | — | 0.2 h | 0.2 h | 0 | NO | TIMED (not finished) |
| 537410 | Ghana | Panama | Jun 17 | — | 0.2 h | 0.2 h | 0 | NO | TIMED (not finished) |

★ = DATA-18A/18B benchmark match

---

## 3. Summary

| Metric | Count |
|--------|-------|
| Total FINISHED matches in feed | 23 |
| Actual FINISHED status | 20 |
| TIMED (incorrectly in FINISHED feed) | 3 |
| Snapshots present | 23 / 23 |
| DR copies present | 23 / 23 |
| **Poisoned DR (score>0, dr.goals=0)** | **18 / 20** |
| Healthy with goals | 1 (Austria vs Jordan only) |
| Healthy with 0-0 score | 1 (Spain vs Cape Verde) |
| ESPN IDs present | **0 / 20** |

---

## 4. Root Cause of Batch Poisoning

All 18 poisoned snapshots have identical age: **5.2 hours** (built ~04:18 UTC).

This is consistent with the prewarm cron (`src/app/api/cron/prewarm-worldcup/route.ts`)
running at approximately 04:00 UTC and rebuilding all snapshots.

**Prewarm rebuild path:**
1. Prewarm reads FINISHED feed — gets matches with scores (e.g., 2-0) but no goals array
2. `assembleSnapshot()` builds snapshot from FD match detail KV cache
3. FD match detail KV cache was populated from bulk feed (`getMatchDetailCached`), which
   contains scores but no goal scorer detail
4. `needsEnrichment = (status=FINISHED && code=WC && goals.length===0)` → TRUE
5. Enrichment attempted:
   - ESPN: `espnIdPresent=false` for ALL matches — lookup keys expired (30-day TTL) → SKIP
   - AF: `ENABLE_AF_ENRICHMENT=true` — AF enrichment attempted but returned empty/failed
6. Goals remain []. Downgrade guard: DR was also 0 goals (prior build also failed) → WRITE
7. Both primary and DR written with 0 goals. DR poisoned.

**Austria vs Jordan (healthy):** Match finished AFTER the 04:00 prewarm run. A fresh snapshot
was built ~1h ago (08:30 UTC). At build time, the FD match detail API (`/matches/537398`)
returned full goal scorer data directly in the response. No enrichment provider needed.
The FD `/matches/{id}` endpoint returns goals; the bulk FINISHED feed does NOT.

**Critical implication:** Enrichment quality depends entirely on whether `getMatchDetail(id)`
(per-match FD endpoint) is called. The prewarm builds from cached KV detail entries that
were populated from bulk feeds — no goals. Fresh page-triggered builds call the FD
match detail API directly — goals present.

---

## 5. Repairability Analysis

| Match | Score | ESPN ID? | DR has goals? | Repairability |
|-------|-------|----------|---------------|---------------|
| 537327–537397 (18 matches) | Various (non-zero) | NO | NO | **needs-repair** |
| 537369 | 0–0 | NO | NO | OK (0-0 is correct) |
| 537398 | 3–1 | NO | YES (4) | OK |

**`needs-repair`** means:
- DR has 0 goals → downgrade guard cannot prevent next 0-goal snapshot
- No ESPN ID → ESPN enrichment cannot run
- BUT: FD match detail API still returns goals for 6-day-old matches
- These can be repaired by: invalidating the snapshot (delete KV key) so next visit
  triggers a fresh build from `getMatchDetail(id)` which returns goals from FD

**Self-heal window:** The FD match detail API returns goals for recently finished matches.
For matches played June 11–17, this data should still be available in the FD API.
A snapshot rebuild triggered by any page visit to `/match/{id}` would fix each match.

---

## 6. FINISHED Feed DR Gap

The FINISHED feed `goalradar:/competitions/WC/matches?status=FINISHED` has **no DR key**.
This was expected in the normal operation (DR is written by `storeDisasterKey` which is
called from `revalidateInBackground`). Since `getWCResultsCached()` uses `readKVOnly()`
(never triggers SWR/background revalidation), the DR key for the FINISHED feed is only
written when `getWCResults()` (the non-Cached SWR variant) is called — which only happens
from the orchestrator cron.

If the orchestrator cron was running 30-min cadence with `WC_STALE=12h`:
- The FINISHED feed key was written by the cron at 09:18 UTC (12 min ago)
- Previous entry was written ≥30 min before that
- DR key would only be written if `withKVCache` ran, which it did via the cron
- BUT: the audit shows `drExists: false` for the FINISHED feed

This suggests the DR write either failed silently or the `storeDisasterKey` path was not
reached during the last cron run (e.g., skip-if-fresh logic prevented the full write path).

**Risk:** If `goalradar:/competitions/WC/matches?status=FINISHED` expires between cron runs,
Results page shows 0 matches. No DR fallback available.
