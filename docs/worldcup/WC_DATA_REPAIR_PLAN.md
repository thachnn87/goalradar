# WC_DATA_REPAIR_PLAN.md — DATA-18WC.7 Phase 7
**Date:** 2026-06-23  
**Gate target:** WC_DATA_READY

---

## Issue Inventory

### P0 — Immediate / Data Corruption Risk

| ID | Issue | Impact | Action |
|---|---|---|---|
| R0-1 | Spain vs Saudi Arabia (537371): authority=4-0, snapshot=5-0. Snapshot is 35.6h stale. | Match detail page shows wrong score to users. | Force-refresh snapshot for match 537371. Trigger enrichment pipeline for this match ID. |

---

### P1 — High / Missing Team Data (25% of participants)

| ID | Issue | Impact | Action |
|---|---|---|---|
| R1-1 | 12 qualified team pages are pre-draw stubs with no match/standings data: costa-rica, honduras, venezuela, poland, turkey, denmark, serbia, nigeria, cameroon, bolivia, peru, ukraine | 12 of 47 qualified teams have zero fixture/result/standings display | Run team data pipeline for all 12 slugs. Populate group assignment, past match results, upcoming fixtures, and standings context from API. |
| R1-2 | UPCOMING KV feed absent (`goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED`) | 3 upcoming matches (MD3 today) not in authority cache; upcoming feed empty | Re-run CRON wc-upcoming task immediately. Post-fix `coldRebuild` will pick up via `readKVOnly`. |

---

### P2 — Medium / Feed Integrity

| ID | Issue | Impact | Action |
|---|---|---|---|
| R2-1 | 3 TIMED matches in FINISHED feed: 537405 (Portugal vs Uzbekistan), 537411 (England vs Ghana), 537412 (Panama vs Croatia) | These MD3 matches show in wrong feed bucket; if authority merges them as FINISHED they'll show incorrect status | Reclassify: remove from FINISHED KV bucket, add to UPCOMING. Or wait for next CRON — the status will update once matches kick off and finish. |
| R2-2 | Standings group key mismatch: API uses `"Group A"`, code expects `"GROUP_A"` | Live standings merge disabled for all 12 groups; falls back to STATIC for enrichment path | Normalize key casing in merge logic. Either transform API response to uppercase before comparison, or change expected format to title case. |
| R2-3 | Standings DR KV absent | No disaster-recovery fallback for standings | Write standings to DR KV bucket after next successful fetch. Add DR write to standings CRON handler. |

---

### P3 — Low / Cosmetic / Future

| ID | Issue | Impact | Action |
|---|---|---|---|
| R3-1 | 3 matches missing lineup data: 537369 (Spain vs Cape Verde Islands), 537354 (Ecuador vs Curacao), 537365 (Belgium vs Iran) | Match detail pages show no lineups for these upcoming matches | Re-enrich ~1h before each match kickoff to capture published lineup. |
| R3-2 | WCBracket missing THIRD_PLACE match (1 match) | 3rd place playoff not visible in bracket | Add THIRD_PLACE round to WCBracket, displayed as a side bracket below SF/FINAL columns. |
| R3-3 | Static `wc-all-teams.ts` group assignments are all pre-draw (only 3/48 match actual draw) | No rendering impact (live API overrides), but static fallback shows wrong group skeleton if API fails | Update `wc-all-teams.ts` group field for all 48 teams to match the actual 2026 WC draw. |

---

## Priority Order

1. **R0-1** — Force-refresh match 537371 snapshot (wrong score displayed NOW)
2. **R1-1** — Run team data pipeline for 12 stub teams (25% of participants missing)
3. **R1-2** — Re-run wc-upcoming CRON (upcoming feed absent)
4. **R2-1** — Reclassify 3 TIMED matches in FINISHED feed (low urgency — will self-correct after kickoff)
5. **R2-2** — Fix standings group key casing mismatch
6. **R2-3** — Populate standings DR KV
7. **R3-x** — Lineup enrichment, THIRD_PLACE bracket, static group updates (deferred)

---

## Gate Unlock Criteria for WC_DATA_READY

Must resolve before gate passes:
- [ ] R0-1: Spain vs SA score drift corrected
- [ ] R1-1: All 12 stale team pages populated
- [ ] R1-2: UPCOMING KV feed populated and authority cache reflects upcoming matches
- [ ] R2-2: Standings group key mismatch fixed so live merge works
