# DATA18WC8D_FINAL_VERDICT.md — WC UX Integrity Audit

**Audit ID:** DATA-18WC.8D  
**Date:** 2026-06-24  
**Auditor:** Automated (production page fetches + source analysis)  
**Constraint:** Audit only. No fixes applied. Evidence-first.

---

## VERDICT

```
WC_UX_BLOCKED
```

The World Cup 2026 section has **6 confirmed P0 defects** that make the site's primary pages misleading, incomplete, or actively wrong for users. No single P0 is acceptable for a live tournament site. Six P0s during the active group stage is a blocking failure.

---

## P0 DEFECTS (6)

### P0-1: Hub Group Standings — Wrong Teams, 0 Points
**Evidence:** Hub shows Group A = USA/France/Switzerland/Japan (0pts). Actual Group A = Mexico/Korea Rep/Czechia/South Africa with real points. Group D shows 5 teams (impossible). This is the most-visited WC page and its primary section (group standings) is factually wrong.

**File:** `WC_STANDINGS_UX_AUDIT.md` §3  
**Root cause:** Hub ISR stale; orchestrator stalled; `revalidateWCPaths()` not running  
**Fix:** Restart orchestrator → ISR purge

---

### P0-2: All 48 Team Pages Show Pre-tournament Placeholder
**Evidence:** France team page shows "Fixtures load once the tournament begins — Check back from 11 June 2026". Today is June 24. France has 2 wins. Both are invisible. All 48 team pages use the same code path and all show the same placeholder.

**File:** `WC_TEAM_PAGE_UX_AUDIT.md` §1, §2  
**Root cause:** `wc-upcoming` KV absent + `wc-recent` returns 0 team matches → both arrays empty → placeholder renders  
**Fix:** Orchestrator restart to rebuild wc-recent; team pages need authority cache fallback for recent matches

---

### P0-3: No Upcoming Fixtures on Any Page
**Evidence:** Hub → "No upcoming fixtures available". Fixtures page → 47 finished matches, title says "Upcoming matches". Group I page → "No upcoming fixtures for this group yet" despite 2 matches remaining. Users cannot discover any upcoming WC match from any direct navigation path.

**File:** `WC_UPCOMING_UX_AUDIT.md` §2  
**Root cause:** `wc-upcoming` KV feed absent; FD `?status=SCHEDULED,TIMED` returns 0 post-group-stage; authority cache has 0 upcoming matches  
**Fix:** Add R32 bracket matches to fixtures page; fix orchestrator to write upcoming feed

---

### P0-4: Cancelled Match 537412 Shows "0–1 Match Result" Title
**Evidence:** `/match/537412` page title = "Panama 0–1 Croatia – Match Result". Match status = CANCELLED. Page implies Croatia won 1-0. No "CANCELLED" indicator visible in title.

**File:** `WC_MATCH_PAGE_UX_AUDIT.md` §1, §4  
**Root cause:** `hasScore = isFinished && ftH != null` — does not exclude CANCELLED status; snapshot has `isFinished=true` and score data  
**Fix:** One-line: `const hasScore = isFinished && status !== 'CANCELLED' && ftH != null && ftA != null`

---

### P0-5: Fixtures Page is a Misleading Dead End
**Evidence:** Fixtures page title = "Upcoming matches & kick-off times". Content = 47 finished/cancelled matches. No upcoming matches shown. No bracket link. Users looking for upcoming fixtures land here and find only an archive — with no guidance to the bracket page where R32 fixtures actually live.

**File:** `WC_UPCOMING_UX_AUDIT.md` §3; `WC_USER_JOURNEY_AUDIT.md` Scenario 2  
**Root cause:** Fixtures page data source = authority cache (47 FINISHED/CANCELLED). Title was written for a different state.  
**Fix:** Retitle or add R32 knockout fixtures from bracket KV feed; add "View knockout bracket" link

---

### P0-6: Hub Standings and Hub Results Section Contradict Each Other
**Evidence:** On the same hub page: Group I standings show "Colombia 0pts, Poland 0pts, Ivory Coast 0pts, New Zealand 0pts" — but Recent Results section shows "France 3-0 Iraq". France is in Group I and has 6pts but is invisible in the hub's Group I standings. A single page simultaneously shows France winning matches and France not existing.

**File:** `WC_STANDINGS_UX_AUDIT.md` §3  
**Root cause:** Same as P0-1 (hub ISR stale). The Recent Results section reads from a different data source (authority KV, not ISR-baked), so it shows current data while standings are frozen in pre-tournament state.  
**Fix:** Same as P0-1 — ISR purge resolves both P0-1 and P0-6

---

## PAGES BY STATUS

| Page | Status | Critical Issues |
|------|--------|----------------|
| `/world-cup-2026` (hub) | ❌ BLOCKED | Wrong standings (P0-1), empty upcoming (P0-3), self-contradicting (P0-6) |
| `/world-cup-2026/standings` | ⚠️ REDIRECT | 308 → groups page (acceptable) |
| `/world-cup-2026/groups` | ✅ WORKING | Correct standings, qualification correct |
| `/world-cup-2026/group-[slug]` | ⚠️ PARTIAL | Standings correct, upcoming empty (P1) |
| `/world-cup-2026/fixtures` | ❌ BLOCKED | Misleading title + dead end (P0-5) |
| `/world-cup-2026/results` | ⚠️ PARTIAL | 139 goals (discrepancy with legacy page) |
| `/world-cup-2026-results` | ⚠️ PARTIAL | 137 goals (discrepancy) |
| `/world-cup-2026/bracket` | ✅ WORKING | All 6 rounds correct, TBD labels clear |
| `/world-cup-2026/teams/[slug]` | ❌ BLOCKED | All 48 pages show pre-tournament placeholder (P0-2) |
| `/match/[id]` (FINISHED) | ✅ WORKING | Correct title and score |
| `/match/[id]` (CANCELLED) | ❌ BLOCKED | Misleading score shown (P0-4) |
| `/matches/[id]` | ❌ 404 | Wrong URL pattern (P1) |

---

## ANSWER TO AUDIT QUESTIONS

### Q1. Can a user discover upcoming WC fixtures?
**NO.** Three separate entry points (hub, fixtures page, team pages) all show empty or finished-only fixtures. The bracket page shows R32 structure with TBD teams — the closest to "upcoming" but requires domain knowledge to interpret.

### Q2. Is the hub group standings section trustworthy?
**NO.** Hub shows pre-tournament seedings with 0pts for all teams. 13 days into the tournament, the hub's most prominent data section is factually wrong.

### Q3. Do team pages show match history?
**NO.** All 48 team pages show "Fixtures load once the tournament begins". Match history for every team, including France (2W/6pts), is invisible.

### Q4. Is the bracket complete and correct?
**YES.** Bracket page is the strongest page in the section. All 6 rounds, correct dates, correct venue for Final, comprehensible TBD labels.

### Q5. Does the cancelled match display correctly?
**NO.** Match 537412 displays "Panama 0–1 Croatia – Match Result" — a misleading framing that implies a completed result.

### Q6. Are standings consistent across pages?
**NO.** Hub Group I shows Colombia/Poland/Ivory Coast/New Zealand (0pts). Groups page and Group I page show France/Norway/Senegal/Iraq with real points. Three different pages, three different answers.

### Q7. Is qualification visible to users?
**MIXED.** Groups page and group/[slug] pages show correct qualification status. France team page shows "✅ Qualified" correctly. Hub qualification badges are based on wrong teams (0pts), making them meaningless.

### Q8. Can users find match pages?
**PARTIALLY.** `/match/[id]` works. `/matches/[id]` returns 404. External links using the plural form fail silently.

### Q9. Are results consistent across results pages?
**NO.** Two results pages show different goal totals (139 vs 137 goals). Same 46 matches, different counts.

### Q10. Is the overall UX consistent enough for tournament use?
**NO.** The primary user journey (visit hub → see standings → explore teams) is broken at step 2. A first-time user visiting the hub during the group stage encounters wrong teams, impossible group sizes, empty upcoming section, and a page that contradicts itself.

---

## UNBLOCK CHECKLIST

Before `WC_UX_READY` can be declared:

- [ ] **U1/U6/U7:** Hub ISR purged → correct standings showing on hub
- [ ] **U2:** Team pages showing recent match history (wc-recent feed populated + ISR refreshed)
- [ ] **U3:** Upcoming section on hub shows at least R32 knockout fixtures
- [ ] **U4:** Cancelled match (`/match/537412`) no longer shows misleading score in title
- [ ] **U5:** Fixtures page updated to not promise "upcoming" content it doesn't have
- [ ] **U9:** `/matches/[id]` redirects to `/match/[id]` (5-minute fix)

R32 begins July 2. All P0 items must be resolved before that date.

---

## COMPARISON TO DATA-18WC.9C/D

The data integrity audit (`DATA18WC9CD_FINAL_VERDICT.md`) found `WC_DATA_INTEGRITY_BLOCKED` with 3 data-layer blocking conditions. This UX audit confirms that the data-layer problems surface as visible user-facing failures:

- FD zero normalization (data) → state display inconsistency in live match (data layer, risk)
- Snapshot DR self-poisoning (data) → not directly user-visible yet; will affect match pages when live matches start
- Orchestrator stall (data + ops) → **directly causes P0-1, P0-2, P0-3, P0-6** (hub stale, team pages stale, upcoming empty)

The orchestrator restart is the highest-leverage single fix: it resolves 4 of the 6 P0 UX defects.
