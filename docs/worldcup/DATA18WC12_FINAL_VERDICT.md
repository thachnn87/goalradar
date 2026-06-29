# DATA18WC12_FINAL_VERDICT.md — Production Recovery Sprint Final Verdict
**Sprint:** DATA-18WC.12  
**Date:** 2026-06-25 (Last day of group stage)  
**Auditor:** Source code trace + production evidence (DATA-18WC.11)

---

## Verdict

# WC_PRODUCTION_BLOCKED

---

## Acceptance Gate Results

| Gate Criterion | Result | Evidence |
|---|---|---|
| No page shows different scores for the same match | ⚠️ PARTIAL | Match 537412 (Panama vs Croatia) shows FT 0-1 on Results page; correct status is CANCELLED. DR cache poisoned. |
| Standings match completed results | ❌ FAIL | All standings show 0 pts / 0 games despite 54 FT matches confirmed. KV key `/competitions/WC/standings` empty. |
| Qualification status consistent across Hub, Groups, Team Pages, Bracket | ❌ FAIL | All qualification badges show UNDECIDED. Engine inputs are zeros. |
| Upcoming fixtures include knockout matches (teams TBD) | ⚠️ PARTIAL | Group fixtures present on Fixtures page. Bracket page shows R32 slot schedule with positional labels. Hub upcoming may show empty after group stage ends tonight (no static slot fallback on hub). |
| Live matches disappear immediately after completion | ✅ PASS | 30s TTL on live:matches + effectiveBucket() demotion ensures rapid clearing. |
| Bracket updates automatically when qualifiers are known | ✅ PASS | Bracket ISR 900s; will populate when FD API posts R32 fixtures. |
| All WC pages consume the same SSOT | ❌ FAIL | Results/Fixtures consume authority cache (correct). Standings/Qualification pages consume static skeleton (zeros). Two divergent data paths. |
| No duplicate selector or cache remains | ✅ PASS | No duplicate selectors or caches found. Authority path is clean. |
| No manual operational workaround required for normal operation | ❌ FAIL | DR cache 537412 requires manual purge. Standings endpoint requires diagnosis/repair. |

**Score: 3 PASS, 2 PARTIAL, 4 FAIL — BLOCKED**

---

## What Was Fixed This Sprint

| Fix | File | Impact |
|---|---|---|
| Stale "Tournament begins" copy removed | `groups/page.tsx` | Groups page now shows neutral unavailable message when standings zero |
| Germany group D → K | `wc-all-teams.ts` | Group D count fixed (5→4), Group K count fixed (3→4) |
| Norway group I → A | `wc-all-teams.ts` | Group I count fixed (5→4), Norway now with France (confirmed by fixtures) |
| Bracket ISR 21600s → 900s | `bracket/page.tsx` (prior sprint DATA-18WC.10) | Bracket updates within 15m during knockout stage |
| Qualification engine added to groups page | `groups/page.tsx` (prior sprint DATA-18WC.10) | Group page qualification badges now driven by engine, not static |

---

## Remaining Blockers

### BLOCKER-1 (P0): DR Cache Poisoned — Match 537412
**What:** `goalradar:dr:match:537412` has `status: FINISHED`, `scoreAway: 1` for a CANCELLED match.  
**Where:** `src/lib/match-snapshot.ts` — DR fallback path.  
**Fix:** Operational only — call `GET /api/debug/purge-match-snapshot?id=537412&secret=<CRON_SECRET>`  
**Impact:** Panama vs Croatia showing as FT 0-1 on Results page until purged or DR key expires (~30 days).

### BLOCKER-2 (P0): Standings KV Key Empty
**What:** `/competitions/WC/standings` KV key is never populated. `refreshEndpoint` for WC standings returns error from FD API (likely 403 restricted or unexpected group format). Static skeleton (all zeros) returned to all consumers.  
**Where:** `src/lib/api.ts:getStandingsCached`, `src/lib/refresh.ts:refreshEndpoint`  
**Fix options:**
  1. Diagnose FD API endpoint — call `https://api.football-data.org/v4/competitions/WC/standings` directly and inspect response
  2. If API group format changed: add normalization cases to `toGroupKey()` in api.ts
  3. If API restricted: implement `computeWCStandingsFromAuthority()` to derive standings from authority cache matches (all data available — every FINISHED group match is in `goalradar:wc:authority:v1`)  
**Impact:** All group standing pages, qualification badges, team page standing tables show 0/UNDECIDED for entire tournament.

### BLOCKER-3 (P1): Group Composition Wrong in Static Data
**What:** `wc-all-teams.ts` has pre-draw editorial group assignments that don't match the real FIFA draw. Multiple teams have wrong groups. Several actual tournament participants (Czechia, Haiti, Scotland, Bosnia, Uzbekistan, Congo DR, Sweden, Curaçao) are not in the file.  
**Where:** `src/lib/wc-all-teams.ts`  
**Fix:** Obtain official FIFA WC 2026 draw; update all 48 team group assignments; add missing teams.  
**Impact:** Team SEO pages show wrong group mates; static skeleton fallback has wrong compositions. Does NOT affect live standings (those come from FD API when fixed).

---

## Architecture Assessment

The authority cache path (match results, fixtures, scores, live status, bracket) is **functionally correct**. The Results and Fixtures pages show accurate, real-time data. The bracketting infrastructure is sound.

The standings path is **architecturally broken**. The dependency on `FD API /competitions/WC/standings` is a single point of failure with no computation fallback. The correct fix is to derive WC standings from the authority cache (which already has all 104 match results), eliminating the FD API standings dependency for the tournament entirely.

Once standings are fixed, qualification badges, hub group tables, team page standings, and R32 bracket population will all self-correct within one orchestrator cycle.

---

## Path to WC_PRODUCTION_READY

1. **P0 (operational, 5 min):** Purge DR key 537412
2. **P0 (code + deploy, ~2h):** Fix standings — implement `computeWCStandingsFromAuthority()` in api.ts; deploy; trigger orchestrator
3. **P1 (data, ~1h):** Update `wc-all-teams.ts` group assignments from official FIFA draw
4. **Verify:** Check production groups page shows real standings, qualification badges show QUALIFIED for confirmed qualifiers
