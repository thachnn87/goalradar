# WC_PRODUCTION_REPAIR_PLAN.md — Production Repair Plan
**Sprint:** DATA-18WC.12 | **Date:** 2026-06-25

---

## Repairs Implemented This Sprint

### REPAIR-1: Fix stale "Tournament begins" copy in groups page ✅ DONE
**File:** `src/app/world-cup-2026/groups/page.tsx`  
**Change:** Line 143 — changed `"Tournament begins 11 June 2026 — standings update once matches are played"` to `"Live standings updating — check back in a few minutes"`  
**Reason:** Original copy was written for pre-tournament state. On June 25 (last day of group stage), it incorrectly implies the tournament hasn't started.  
**Impact:** Groups page and hub now show a neutral unavailable message when standings are zero — prevents user confusion about tournament not started.

### REPAIR-2: Fix Germany group assignment D → K ✅ DONE
**File:** `src/lib/wc-all-teams.ts`  
**Change:** Germany `group: 'D'` → `group: 'K'`  
**Evidence:** Production fixture confirms Ecuador vs Germany on June 25 (same group). Ecuador is Group K. This change:
- Fixes Group D count: 5 teams → 4 teams ✅
- Fixes Group K count: 3 teams → 4 teams ✅  
**Impact:** Germany team page now shows Group K; static skeleton for Group K now includes Germany; Group D skeleton no longer has Germany.

### REPAIR-3: Fix Norway group assignment I → A ✅ DONE
**File:** `src/lib/wc-all-teams.ts`  
**Change:** Norway `group: 'I'` → `group: 'A'`  
**Evidence:** Production fixtures confirm France vs Norway on June 26 (same group). France is Group A.  
**Result:** Group I count: 5 → 4 ✅. Group A count: 4 → 5 ⚠️ (documented below)  
**Remaining issue:** Group A now has 5 teams (USA, France, Switzerland, Japan, Norway). One of these is misassigned. Production evidence suggests Switzerland and Canada are in the same group (confirmed result June 24). If Switzerland is actually in Group B with Canada, Group A becomes 4 again. This requires the full official FIFA draw to confirm.

---

## Repairs Skipped (cannot fix in source code alone)

### BLOCKER-1: Standings zero-state (CRITICAL)
**Root cause:** KV key `/competitions/WC/standings` is empty. `refreshEndpoint('/competitions/WC/standings')` likely gets a non-200 from FD API (restricted tier, rate-safe mode, or unexpected group format).  
**Cannot fix via source code alone** — requires one of:
1. Diagnose FD API endpoint: call `GET https://api.football-data.org/v4/competitions/WC/standings` with the API key and inspect the response format
2. If restricted: implement `computeWCStandingsFromAuthority()` to compute standings from authority cache match data (see WC_QUALIFICATION_INPUTS.md for implementation sketch)
3. If wrong group format: add additional `toGroupKey()` normalization cases in `src/lib/api.ts:getStandingsCached`

**Impact if unfixed:** All group standing pages, qualification badges, hub standings section, team page standings all show zero/UNDECIDED for remainder of tournament.

### BLOCKER-2: DR cache poisoned — match 537412 (P0)
**Root cause:** `goalradar:dr:match:537412` has `status: FINISHED`, `scoreAway: 1` for a CANCELLED match (Panama vs Croatia). DR key has 30-day TTL.  
**Cannot fix via source code** — requires operational action:  
```
GET https://www.goalradar.org/api/debug/purge-match-snapshot?id=537412&secret=<CRON_SECRET>
```
Expected response: `{ "rebuilt": { "status": "CANCELLED", "scoreHome": null, "scoreAway": null } }`  
**Impact if unfixed:** Panama vs Croatia shows as FT 0-1 on Results page until the DR key expires (~30 days from when it was written).

### BLOCKER-3: Group composition errors (HIGH)
**Root cause:** `wc-all-teams.ts` was seeded from pre-draw editorial data. Multiple teams have wrong group assignments (Mexico's group shows Spain/Australia/Serbia when actual opponents were South Korea/South Africa/Czechia).  
**Cannot fix without authoritative FIFA draw data.** Czechia and several other actual tournament teams (Haiti, Scotland, Bosnia, Uzbekistan, Congo DR, Sweden, Curaçao) are not in `wc-all-teams.ts` at all — indicating the team roster itself may need updating.  
**Impact:** Team SEO pages show wrong group mates; static skeleton fallback shows wrong group compositions.

---

## Remaining Group Count Issues (post-repair)

| Group | Count | Status |
|---|---|---|
| A | 5 (USA, France, Switzerland, Japan, Norway) | ⚠️ Needs 1 team relocated after draw confirmed |
| B | 4 | ✅ |
| C | 4 | ✅ |
| D | 4 (Costa Rica, Turkey, Morocco, Iran) | ✅ |
| E | 4 | ✅ |
| F | 4 | ✅ |
| G | 3 (Argentina, Egypt, Iraq) | ⚠️ Needs 1 team added after draw confirmed |
| H | 4 | ✅ |
| I | 4 (Colombia, Ivory Coast, New Zealand, Poland) | ✅ |
| J | 4 | ✅ |
| K | 4 (Ecuador, Germany, Ghana, Ukraine) | ✅ |
| L | 4 | ✅ |

---

## Operational Actions Required

| Action | Priority | Command |
|---|---|---|
| Purge DR cache for match 537412 | P0 | `GET /api/debug/purge-match-snapshot?id=537412&secret=<CRON_SECRET>` |
| Diagnose FD API WC standings endpoint | P0 | Manual: call FD API with credentials, inspect `/competitions/WC/standings` response |
| Trigger orchestrator after standings fix | P1 | `GET /api/cron/orchestrator?secret=<CRON_SECRET>` |
| Reconcile wc-all-teams.ts with official FIFA draw | P1 | Manual: obtain official FIFA WC 2026 group draw; update all 48 team group assignments |
