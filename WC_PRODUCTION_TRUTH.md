# WC_PRODUCTION_TRUTH.md — Production Truth Validation
**Sprint:** DATA-18WC.12 | **Date:** 2026-06-25  
**Source:** Production HTML evidence from DATA-18WC.11 audit + source code analysis

---

## Validation Results by Entity

### 1. Match Scores (P0 confirmed)

| Match | Expected | Production | Status |
|---|---|---|---|
| Panama vs Croatia (537412) | CANCELLED, no score | FT 0–1 | **FAIL — P0** |
| Mexico vs Czechia (June 25) | FT 3–0 | FT 3–0 on Results page | **PASS** |
| South Africa vs South Korea (June 25) | FT 1–0 | FT 1–0 on Results page | **PASS** |
| Switzerland vs Canada (June 24) | FT 2–1 | FT 2–1 on Results page | **PASS** |
| Morocco vs Haiti (June 24) | FT 4–2 | FT 4–2 on Results page | **PASS** |

**Root cause (537412):** DR cache `goalradar:dr:match:537412` has `status: FINISHED`, `scoreHome: 0`, `scoreAway: 1` from a stale snapshot written before the match was cancelled. TTL = 30 days. Primary snapshot may have been updated to CANCELLED but DR still serves stale.  
**File:** `src/lib/match-snapshot.ts` — DR fallback reads without status validation.  
**Fix:** `GET /api/debug/purge-match-snapshot?id=537412&secret=<CRON_SECRET>`

---

### 2. Group Standings

| Group | Expected | Production | Status |
|---|---|---|---|
| Group C — Mexico | P=3, W=3, Pts=9 | P=0, W=0, Pts=0 | **FAIL — CRITICAL** |
| Group C — all teams | real standings | all zeros | **FAIL — CRITICAL** |
| Group J — all teams | real standings | all zeros | **FAIL — CRITICAL** |
| All 12 groups | real standings | all zeros | **FAIL — CRITICAL** |

**Root cause:** KV key `/competitions/WC/standings` is empty. `refreshEndpoint('/competitions/WC/standings')` likely receives a non-200 response from FD API (restricted tier or competition not available), which prevents the KV write. `getStandingsCached('WC')` falls back to `getStaticWCGroupTables()` (all zeros).  
**File:** `src/lib/api.ts:getStandingsCached`, `src/lib/refresh.ts:refreshEndpoint`  
**Fix required:** Diagnose why FD API standings endpoint returns non-200. If restricted, implement `computeWCStandingsFromAuthority()` to compute from authority cache matches.

---

### 3. Group Composition

| Group | Expected teams (from results) | Static skeleton teams | Status |
|---|---|---|---|
| Mexico's group | Mexico, South Korea, South Africa, Czechia | Mexico, Spain, Australia, Serbia | **FAIL** |
| Germany's group | Germany, Ecuador, + 2 unknown | Germany was in D (Costa Rica, Turkey, Morocco, Iran) | **PARTIAL FIX** — Germany moved to K |
| France/Norway's group | France, Norway, + 2 unknown | France: A, Norway: I | **PARTIAL FIX** — Norway moved to A |

**Root cause:** `wc-all-teams.ts` was seeded with pre-draw editorial guesses. Group-stage fixture data was removed from `wc-fixtures.ts` (SEO-7/DATA-9). FD API standings aren't providing group data because the standings key is empty. The authoritative group assignments are not accessible from the codebase.  
**Impact:** Team SEO pages show wrong group table; static fallback skeleton shows wrong teams.  
**Fix:** Reconcile `wc-all-teams.ts` against the complete official FIFA draw. Group assignments are only used for team pages and static skeleton — correct standings come from FD API when fixed.

---

### 4. Qualification Status

| Team | Expected | Production | Status |
|---|---|---|---|
| Mexico | QUALIFIED (3W from confirmed results) | "In Contention" (UNDECIDED) | **FAIL** |
| Any qualified team | QUALIFIED | UNDECIDED | **FAIL — all teams** |

**Root cause:** Qualification engine inputs are all zeros (standings not available). All teams have `gamesRemaining = 3`, engine cannot determine mathematical certainty for anyone.  
**File:** `src/lib/wc-qualification.ts:calculateQualificationStatus`  
**Fix:** Blocked on standings fix.

---

### 5. Bracket Slots

| Slot | Expected | Production | Status |
|---|---|---|---|
| All R32 slots | TBD (group stage not complete) | TBD | **PASS** |
| Slot dates | July 2–9, 2026 | July 2–9 in bracket page | **PASS** |

---

### 6. Upcoming Fixtures

| Entity | Expected | Production | Status |
|---|---|---|---|
| Tonight's matches (June 25) | Ecuador-Germany, Curaçao-Ivory Coast, Tunisia-Netherlands, Japan-Sweden | All listed on Fixtures page | **PASS** |
| June 26 fixtures | France vs Norway | Listed on Fixtures page | **PASS** |

---

### 7. Team Pages

| Page | Issue | Status |
|---|---|---|
| Mexico | "84% chance, 1st in Group C with 3 matches remaining" while showing W-W-W | **FAIL** — stale probability copy |
| France | "3 matches remaining" when 1 remains | **FAIL** — stale copy |
| South Africa | Intro says "face Mexico in opening match" but stands show 0pts | Intro correct, standings wrong |
| Norway | Correctly at /world-cup-2026/teams/norway (404 fixed in commit 214597c) | **PASS** — page exists |
