# WC_TEAM_DEEP_CRAWL.md — DATA-18WC.7 Phase 5
**Date:** 2026-06-23  
**Audited URL pattern:** `https://www.goalradar.org/world-cup-2026/teams/{slug}`  
**Note:** `/team/{slug}` returns 404 for all team pages — correct path is `/world-cup-2026/teams/{slug}`

---

## Overall Results (48 pages)

| Metric | Count | Notes |
|---|---|---|
| HTTP 200 | 48/48 | All pages accessible |
| Route-to-final visible | 48/48 | R32→R16→QF→SF→Final shown |
| Fixtures + results present | 35/48 | Active API-connected teams |
| Stale pre-draw stub | 12/48 | See list below |
| Italy (not qualified) | 1/48 | Correctly shows "did not qualify" |

---

## 12 Stale Team Pages (CRITICAL)

The following 12 qualified teams have never had their API pipeline connected. Their pages show:
- Group: "Group will be confirmed after the official draw" (pre-tournament FAQ)
- Fixtures: "Check back from 11 June 2026"
- Results: None
- Standings: None

**Stale stubs:** costa-rica, honduras, venezuela, poland, turkey, denmark, serbia, nigeria, cameroon, bolivia, peru, ukraine

These teams are qualified WC 2026 participants but their match and standings data was never populated in GoalRadar.

---

## 10 Active Teams Sampled (Content Verification)

| Team | Group | Fixtures | Results | Standings |
|---|---|---|---|---|
| USA | D | OK | OK (4-1 vs PAR, 2-0 vs AUS) | OK P2 W2 6pts #1 |
| England | L | OK | OK (4-2 vs CRO) | OK P1 W1 3pts #1 |
| Germany | E | OK | OK (7-1 vs CUW, 2-1 vs CIV) | OK P2 W2 6pts #1 |
| Argentina | J | OK | OK (3-0 vs ALG, 2-0 vs AUT) | OK P2 W2 6pts #1 |
| Brazil | C | OK | OK (1-1 vs MAR, 3-0 vs HAI) | OK P2 1W-1D 4pts #1 |
| France | I | OK | OK (3-1 vs SEN, 3-0 vs IRQ) | OK P2 W2 6pts #1 |
| Morocco | C | OK | OK (1-1 vs BRA, 1-0 vs SCO) | OK P2 1W-1D 4pts #2 |
| Senegal | I | OK | OK (L 3-1 FRA, L 3-2 NOR) | OK P2 0pts #4 |
| New Zealand | G | OK | OK (2-2 vs IRN, 1-3 vs EGY) | OK P2 1D-1L 1pt #4 |
| Colombia | K | OK | OK (3-1 vs UZB) | OK P1 W1 3pts #1 |

---

## Group Assignment: Static vs Actual Draw

Only **3 teams** in `wc-all-teams.ts` have correct post-draw group assignments (canada=B, netherlands=F, egypt=G). All other static assignments are pre-draw placeholders.

**Actual live groups (from API):**

| Group | Teams |
|---|---|
| A | Mexico, South Korea, South Africa + 1 |
| B | Canada, Qatar, Switzerland + 1 |
| C | Brazil, Morocco + 2 |
| D | USA, Australia + 2 |
| E | Germany, Ecuador, Ivory Coast + 1 |
| F | Japan, Netherlands + 2 |
| G | Belgium, Egypt, Iran, New Zealand |
| H | Spain, Saudi Arabia, Uruguay + 1 |
| I | France, Iraq, Senegal + 1 |
| J | Argentina, Algeria, Austria, Jordan |
| K | Colombia, Portugal + 2 |
| L | England, Croatia, Ghana, Panama |

The static file is a pre-draw seed — the live site correctly uses API data for all group display. No rendering bug; the mismatch is expected.

---

## Findings

- 35/48 team pages fully functional (group, fixtures, results, standings all present)
- 1/48 Italy: correctly shows "did not qualify"
- CRITICAL: 12/48 qualified teams are pre-draw stubs with no match or standings data
- INFO: Static group assignments are pre-draw (expected mismatch vs actual draw)

**Phase 5 Gate: TEAM_CRAWL_FAIL** (12 of 47 qualified teams have zero data — 25% of participants missing)
