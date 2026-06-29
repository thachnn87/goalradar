I now have all the data needed. Let me write the complete WC_TEAM_TRACE.md.

```
WC_TEAM_TRACE.md
```

---

# WC_TEAM_TRACE.md

## Production Truth Audit — Mexico & South Africa Cross-Surface Trace

**Date:** 2026-06-25  
**Auditor:** Production truth auditor (automated snapshot analysis)  
**Domain:** https://www.goalradar.org  
**Method:** Raw HTML snapshots provided by caller. No fixes applied. Observations only.

---

## 1. GROUND TRUTH FROM SOURCE DATA

From `src/data/worldcup/groups.json` and `src/data/worldcup/teams.json`:

- **Mexico** — Group **C**, FIFA rank #15, CONCACAF, slug `mexico`
- Group C members: Mexico, Spain, Australia, Serbia
- **South Africa** — Group **J**, FIFA rank #60, CAF, slug `south-africa`
- Group J members: Croatia, Uruguay, South Africa, Peru

From `src/data/worldcup/fixtures.json`, Mexico's 3 group fixtures:
| ID | Matchday | Date | Home | Away | Venue |
|----|----------|------|------|------|-------|
| GS-C1 | 1 | 2026-06-11 | Mexico | Spain | Azteca Stadium, Mexico City |
| GS-C3 | 2 | 2026-06-20 | Mexico | Australia | Azteca Stadium, Mexico City |
| GS-C5 | 3 | 2026-06-26 | Mexico | Serbia | Monterrey |

Mexico's Matchday 3 (vs Serbia) is **2026-06-26**, i.e. tomorrow relative to audit date (today = 2026-06-25). Group stage for Group C is **not yet complete** today.

South Africa's 3 group fixtures:
| ID | Matchday | Date | Home | Away | Venue |
|----|----------|------|------|------|-------|
| GS-J2 | 1 | 2026-06-16 | South Africa | Peru | Philadelphia |
| GS-J3 | 2 | 2026-06-23 | Croatia | South Africa | Foxborough |
| GS-J6 | 3 | 2026-06-29 | Uruguay | South Africa | Philadelphia |

South Africa's Matchday 3 (vs Uruguay) is **2026-06-29**, four days away. Group J is also not complete today.

From `src/data/worldcup/fixtures.json`, Mexico's R32 slot if 1st in Group C:
- **R32-M2**: 1st Group C vs 3rd (D/E/F) — 2026-07-02, 21:00 UTC, Foxborough, MA
- **R32-M13**: 2nd Group C vs 2nd Group D — 2026-07-08, 17:00 UTC, Guadalajara

---

## 2. EXPECTED STATE ON 2026-06-25 (AUDIT DATE)

With Matchdays 1 and 2 completed and Matchday 3 pending (June 26), the expected live data based on results extracted from production snapshots:

**Mexico results so far:**
- Matchday 1 (June 11): Mexico vs South Africa — **Mexico 2–0 South Africa** (from Mexico team page: "Mexico vs South Africa 2-0 Win")
- Matchday 2 (June 20): Mexico vs South Korea — **Mexico 1–0 South Korea** (from Mexico team page: "Mexico vs South Korea 1-0 Win")
- Matchday 3 (June 25): Czechia vs Mexico — **Mexico 3–0 Czechia** (from fixtures/results pages)

WAIT — this is a critical discrepancy. The fixtures data shows Mexico's Matchday 3 opponent is **Serbia** (GS-C5, 2026-06-26 at Monterrey). The results page and fixtures page show **Czechia vs Mexico 0–3** on **June 25**. Czechia is not in Group C at all per the source data. This is the first anomaly.

Additionally: the Mexico team page says recent results include "Mexico vs South Africa 2-0 Win" but South Africa is in Group J, not Group C. Group C contains Mexico, Spain, Australia, Serbia.

Let me now collate all surface readings systematically.

---

## 3. MEXICO TRACE — ALL SURFACES

### 3.1 Hub (/world-cup-2026)

**Raw HTML returned:** Partial HTML (truncated after `<nav>`). No visible Mexico-specific data was extractable from the body content in the provided snapshot. The hub preloads crest images for many teams but the body content was cut off before the group tables or recent results widget rendered.

**Mexico data visible:** None (body cut off in snapshot).  
**Points/Position:** NOT READABLE  
**Qualification status:** NOT READABLE  
**Verdict:** INCONCLUSIVE — snapshot truncated before body content.

---

### 3.2 Groups Page (/world-cup-2026/groups)

**Raw HTML returned:** Partial HTML (truncated after `<nav>`). The `<main>` content containing the 12 group tables was not included in the snapshot.

**Mexico data visible:** None (body cut off in snapshot).  
**Points/Position:** NOT READABLE  
**Qualification status:** NOT READABLE  
**Verdict:** INCONCLUSIVE — snapshot truncated before body content.

---

### 3.3 Group C Page (/world-cup-2026/group-c)

**Source:** WebFetch markdown conversion (not raw HTML). The tool returned structured content.

**Teams listed in Group C (per this page):** Mexico, Spain, Serbia, Australia — matches source data.

**Standings table shown:**
| Team | P | W | D | L | Pts |
|------|---|---|---|---|-----|
| Mexico | 0 | 0 | 0 | 0 | 0 |
| Spain | 0 | 0 | 0 | 0 | 0 |
| Serbia | 3rd-Place Race label | — | — | — | 0 |
| Australia | 0 | 0 | 0 | 0 | 0 |

**All rows show 0 points, 0 played games.** This is a pre-tournament skeleton table with no live data populated. Yet it is June 25 — two matchdays have already been played for Group C (June 11 and June 20) and Matchday 3 was also played June 25 per the results page (Czechia vs Mexico 0–3, though Czechia is not a Group C team — see anomaly note).

**Qualification labels shown:**
- Mexico: "In Contention"
- Spain: "In Contention"
- Serbia: "3rd-Place Race"
- Australia: "In Contention"

**Match results shown:** "No Group C results found" — the page showed results from other groups instead (Morocco/Haiti/Scotland/Brazil).

**FAIL: Group C page shows all standings at 0–0–0 with no match results, despite at minimum two Group C matchdays having occurred (June 11 and June 20). The page is serving a stale ISR cache or static skeleton.**

Mexico points on Group C page: **0** (WRONG — at minimum 2 matches have been played).  
Mexico position: **1st** (only by default ordering, not by actual points).  
Upcoming fixtures: Not shown.  
Qualification status label: **"In Contention"** (arguably correct but not based on real data).

---

### 3.4 Mexico Team Page (/world-cup-2026/teams/mexico)

**Source:** WebFetch markdown conversion (not raw HTML — tool refused to return verbatim HTML). The tool extracted structured content.

**Data shown:**
- Group: C
- FIFA ranking: #15
- Confederation: CONCACAF
- Qualification status: **"84% chance, 1st in Group C"** with "3 matches remaining"
- Recent form: **W-W-W**
- Recent results:
  1. Czechia vs Mexico — **0–3** (Win)
  2. Mexico vs South Korea — **1–0** (Win)
  3. Mexico vs South Africa — **2–0** (Win)
- Route to Final: "5 additional knockout matches required after group stage"

**Standings table shown on Mexico team page:**
| # | Team | P | G | D | W-D-L | Pts |
|---|------|---|---|---|-------|-----|
| 1 | Mexico | 0 | 0 | 0 | 0-0-0 | 0 |

**CRITICAL FAIL: The Mexico team page standings table shows Mexico with 0 played games and 0 points, yet the same page also shows 3 results (W-W-W) and "84% chance, 1st in Group C." These two data blocks on the same page are mutually contradictory.**

- The results section correctly reflects 3 wins (6+ goals scored, 0 conceded from group matches shown)
- The standing table incorrectly shows 0 played, 0 points
- "3 matches remaining" in the qualification text is also wrong — Mexico's Matchday 3 (vs Serbia) is June 26, so only 1 match remains; but the results shown include a "Czechia vs Mexico" result which is not a Group C match at all

**Additional anomaly:** The qualification blurb says "1st in Group C with 3 matches remaining." As of June 25, Mexico has played 3 matches and group stage ends June 26 (Matchday 3). "3 matches remaining" is inconsistent with W-W-W having already been played.

---

### 3.5 Fixtures Page (/world-cup-2026/fixtures)

**Source:** WebFetch markdown extraction (not raw HTML).

**Recent results shown:**
- Mexico 3–0 Czechia (25 June)
- South Africa 1–0 Korea Republic (25 June)
- Germany 7–1 Curaçao (14 June)
- Brazil 3–0 Haiti (20 June)
- France 3–0 Iraq (22 June)

**Upcoming fixtures (June 25 and forward):**
- June 25: Ecuador vs Germany, Curaçao vs Ivory Coast, Tunisia vs Netherlands, Japan vs Sweden
- June 26: Turkey vs USA, Paraguay vs Australia, Norway vs France, Senegal vs Iraq

**Mexico upcoming fixtures:** NOT SHOWN — no Mexico match listed in the upcoming section. This is consistent with Mexico's next match being June 26 (vs Serbia per fixtures.json), but the fixture listed for June 26 is "Paraguay vs Australia" not "Mexico vs Serbia." Note that the fixtures page upcoming section appears to show matches from Groups that have not yet finished but Mexico vs Serbia (GS-C5, June 26) is absent.

**FAIL: Mexico's Matchday 3 fixture (Mexico vs Serbia, June 26, 21:00, Monterrey) is absent from the upcoming fixtures widget on the fixtures page.** The June 26 slot shows "Turkey vs USA" and "Paraguay vs Australia" but not "Mexico vs Serbia."

Also: Australia appears in a June 26 fixture (Paraguay vs Australia) which is nonsensical — Paraguay is not in Group C and Australia's Matchday 3 per fixtures.json is Spain vs Australia on June 26 at Azteca Stadium. "Paraguay vs Australia" does not correspond to any fixture in the source data.

---

### 3.6 Results Page (/world-cup-2026/results)

**Source:** WebFetch markdown extraction (not raw HTML).

**June 25 results shown:**
- Czechia vs Mexico: **0–3 (FT)**
- South Africa vs South Korea: **1–0 (FT)**

**FAIL:** Czechia is not in Group C. Mexico's Matchday 3 opponent per source data is **Serbia** (GS-C5). The result "Czechia vs Mexico 0–3" appears on this page as a June 25 result but the correct Matchday 3 fixture is Mexico vs Serbia on June 26. Either:
1. The result is attributed to the wrong opponent (the feed returned Czechia instead of Serbia), OR
2. The fixture date slipped and a different match was played (impossible within tournament structure), OR
3. A data feed error caused the wrong team name to appear for the Group C Matchday 3 opponent.

**Also:** South Africa vs South Korea result shown on June 25 is anomalous. Per source fixtures, South Africa vs South Korea is not a scheduled WC 2026 fixture at all. South Korea is in Group B; South Africa is in Group J. They do not meet in the group stage. This result is fabricated or misattributed.

**Tournament stats shown:** 54 matches played, 161 goals, 3.0 avg. This means the API is reporting 54 group-stage matches completed as of June 25. With 12 groups × 6 matches = 72 group stage total, 54 out of 72 played would mean all groups through Matchday 2 complete (12 × 4 = 48 matches through MD2) plus 6 Matchday-3 matches on June 25. This is broadly plausible if June 25 is the last day of concurrent group stage matches, but the specific team pairings shown are wrong per source data.

---

### 3.7 Bracket Page (/world-cup-2026/bracket)

**Raw HTML returned:** Partial HTML (truncated after `<nav>`). The bracket body content was not included.

**Mexico data visible:** None (body cut off in snapshot).  
**Mexico bracket slot:** Per `fixtures.json`, Mexico as 1st Group C plays R32-M2 (1st Group C vs 3rd D/E/F) on July 2.  
**Verdict:** INCONCLUSIVE — snapshot truncated before body content.

---

### 3.8 Round of 32 Page (/world-cup-2026/round-of-32)

**Status:** ERROR — "WebFetch tool returned a policy-blocked response." Page exists but content not returned.

**Expected Mexico slot from source data:** R32-M2 — "1st Group C" vs "3rd (D/E/F)" — July 2, 21:00 UTC, Foxborough, MA.  
**Verdict:** NOT AUDITABLE — fetch blocked.

---

## 4. SOUTH AFRICA TRACE — ALL SURFACES

### 4.1 Group J Page (/world-cup-2026/group-j)

**Source:** WebFetch markdown conversion.

**Teams listed in Group J:** Uruguay (FIFA #14), Croatia (FIFA #11), South Africa (FIFA #60), Peru (FIFA #72) — matches source data.

**Standings shown:** All zeros (0 played, 0 points) for all four teams.

**FAIL: Group J also shows an all-zero standings table despite Group J Matchday 1 (June 16) and Matchday 2 (June 23) having been played.** Per the results page, June 23 included "Panama vs Croatia 0-1 (FT)" (Matchday 2 for Croatia) so Group J has at least partially played through MD2.

**Qualification label for South Africa:** Not explicitly stated in the Group J snapshot — the snapshot text ends before reaching individual qualification badges.

---

### 4.2 South Africa Team Page (/world-cup-2026/teams/south-africa)

**Source:** WebFetch markdown (not raw HTML). Noted as converted by the tool.

**Data shown:**
- Group: **J** — CORRECT per source data
- Opening fixture: **vs Mexico** — INCORRECT. Per `fixtures.json`, South Africa's first fixture is GS-J2: South Africa vs Peru on June 16 in Philadelphia. Their first match is against Peru, not Mexico. Mexico is in Group C; South Africa never plays Mexico in the group stage.
- Points: **0**
- Games played: **0**
- Wins/Draws/Losses: 0/0/0
- Qualification status: **"3rd-Place Race"**
- Advancement probability: **50%**

**FAIL: South Africa team page incorrectly states "Opening fixture: vs Mexico." South Africa does not play Mexico in the group stage. South Africa (Group J) plays Croatia, Uruguay, and Peru. Mexico (Group C) plays Spain, Australia, and Serbia. These two teams are not in the same group and do not meet until a potential knockout match.**

This is a data integrity failure in the static content or API name-matching logic for the team page.

**Also FAIL: South Africa shows 0 played games as of June 25 despite Matchday 1 (June 16, vs Peru) and Matchday 2 (June 23, vs Croatia) having passed.**

---

### 4.3 Results Page — South Africa Entries

The results page shows:
- **June 25: South Africa vs South Korea: 1–0 (FT)**
- **June 23: Panama vs Croatia: 0–1 (FT)**

The June 25 result "South Africa vs South Korea 1–0" is anomalous. South Korea is in Group B. South Africa is in Group J. There is no scheduled match between these two teams in the group stage per `fixtures.json`. This result either:
1. Shows an incorrect opponent name in the feed (the real opponent may be Croatia or Uruguay per Group J schedule), OR
2. Represents a feed fabrication or ID remapping error.

The June 23 "Panama vs Croatia 0–1" is also suspicious. Per fixtures.json, Croatia's Matchday 2 is GS-J3: Croatia vs South Africa on June 23. Panama's Matchday 2 is GS-E3: Portugal vs Panama. "Panama vs Croatia" is not a valid Group J or Group E fixture.

**FAIL: The results page shows South Africa defeating South Korea on June 25. South Korea is in Group B. This is a data feed error — the opponent name is wrong.**

---

### 4.4 Fixtures Page — South Africa

The fixtures page recent results show:
- "South Africa 1–0 Korea Republic (25 June)"

This conflicts with Group J's schedule. South Africa's Matchday 3 per fixtures.json is Uruguay vs South Africa on June 29. South Africa has no scheduled match on June 25. The appearance of a June 25 result for South Africa involving South Korea is an impossible fixture per the WC 2026 group structure.

---

### 4.5 Mexico Team Page — South Africa Reference

The Mexico team page shows South Africa as a recent result: "Mexico vs South Africa 2–0 (Win)" listed as a past result.

Per source data, Mexico and South Africa are in **different groups** (C and J respectively) and have no scheduled group-stage meeting. This result is either:
1. A misattribution where the API returned a different match and South Africa's name was incorrectly associated, OR
2. A fabricated result not based on the actual fixture schedule.

**FAIL: Mexico's recent results on the Mexico team page include "Mexico vs South Africa 2–0." No such fixture exists in the WC 2026 group stage schedule.**

---

## 5. DIVERGENCE MATRIX

| Data Point | Source Data Truth | Hub | Groups Page | Group C Page | Mexico Team Page | Fixtures Page | Results Page | Bracket | R32 |
|---|---|---|---|---|---|---|---|---|---|
| Mexico in Group C | YES | N/A (truncated) | N/A (truncated) | PASS | PASS | N/A | N/A | N/A (truncated) | N/A (blocked) |
| Group C teams: Mex/Spain/Aus/Serbia | YES | N/A | N/A | PASS | PASS | N/A | N/A | N/A | N/A |
| Mexico Matchday 3 opponent: Serbia | Serbia | N/A | N/A | NOT SHOWN | NOT SHOWN | **FAIL — shows Czechia** | **FAIL — shows Czechia** | N/A | N/A |
| Mexico Matchday 3 date: June 26 | June 26 | N/A | N/A | N/A | N/A | **FAIL — shown as June 25** | **FAIL — shown as June 25** | N/A | N/A |
| Mexico points (should be 6–9 after 2–3 W) | 6–9 pts | N/A | N/A | **FAIL — shows 0** | **FAIL — shows 0** | N/A | N/A | N/A | N/A |
| Mexico games played (should be 2–3) | 2–3 | N/A | N/A | **FAIL — shows 0** | **FAIL — shows 0** | N/A | N/A | N/A | N/A |
| Mexico qualification: QUALIFIED or near | QUALIFIED likely | N/A | N/A | "In Contention" (unresolved) | **INCONSISTENT — "84% chance, 1st" but 0 pts table** | N/A | N/A | N/A | N/A |
| South Africa in Group J (not same group as Mexico) | YES | N/A | N/A | N/A | **FAIL — shows "opening fixture vs Mexico"** | N/A | N/A | N/A | N/A |
| South Africa opening fixture: vs Peru (June 16) | vs Peru | N/A | N/A | N/A | **FAIL — shows vs Mexico** | N/A | N/A | N/A | N/A |
| South Africa Matchday 3: vs Uruguay, June 29 | vs Uruguay | N/A | N/A | N/A | N/A | **FAIL — shows vs South Korea June 25** | **FAIL — shows vs South Korea June 25** | N/A | N/A |
| Mexico vs South Africa: not a group fixture | NOT SCHEDULED | N/A | N/A | N/A | **FAIL — shown as result** | N/A | N/A | N/A | N/A |
| Group J standings (all played 2+ games by June 25) | P=2+ | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Group J page standings accuracy | P=2+ | N/A | N/A | **FAIL — shows 0** | N/A | N/A | N/A | N/A | N/A |

---

## 6. CONFIRMED FAILURES — ENUMERATED

### FAIL-1: Czechia listed as Mexico's Matchday 3 opponent (Results page, Fixtures page, Mexico team page)
- **Surface:** `/world-cup-2026/results`, `/world-cup-2026/fixtures`, `/world-cup-2026/teams/mexico`
- **Evidence:** Results page: "Czechia vs Mexico: 0-3 (FT)" on June 25. Fixtures page: "Mexico 3–0 Czechia (25 June)". Mexico team page: "Czechia vs Mexico 0-3 (Win)".
- **Truth:** Czechia is not in WC 2026 Group C. Mexico's Matchday 3 opponent is Serbia (GS-C5, June 26 at Monterrey per `fixtures.json`). Czechia does not appear anywhere in `src/data/worldcup/groups.json` or `teams.json` — Czechia is not a WC 2026 participant.
- **Severity:** CRITICAL — wrong opponent name appearing as a completed result for a team's most recent match.

### FAIL-2: Mexico Matchday 3 shown as June 25 instead of June 26
- **Surface:** `/world-cup-2026/results`, `/world-cup-2026/fixtures`
- **Evidence:** Both pages show the Mexico "Matchday 3" result on June 25. Source data: GS-C5 is dated 2026-06-26.
- **Truth:** Mexico vs Serbia (Matchday 3) is June 26. If a result appeared on June 25, it is either misdated or refers to a different match.
- **Severity:** HIGH — wrong date for the match.

### FAIL-3: Mexico standing table shows 0 points / 0 played on Mexico team page
- **Surface:** `/world-cup-2026/teams/mexico`
- **Evidence:** Standing table on the same page as 3 wins (W-W-W) shows "Mexico: P=0, W=0, D=0, L=0, Pts=0."
- **Truth:** Mexico has played at least 2 matches (June 11 and June 20) and the page itself lists 3 wins. Points should be at least 6.
- **Severity:** HIGH — the standings widget is not updating from the same data source as the results/form widget on the same page.

### FAIL-4: Mexico team page says "3 matches remaining" when Mexico already has 3 results
- **Surface:** `/world-cup-2026/teams/mexico`
- **Evidence:** "84% chance, 1st in Group C with 3 matches remaining" while also showing W-W-W form.
- **Truth:** Mexico can have at most 3 group stage matches total. If W-W-W is shown, 0 matches remain in the group stage. "3 matches remaining" suggests the qualification engine is reading 0 played games (consistent with FAIL-3) and computing remaining games as 3 − 0 = 3.
- **Severity:** HIGH — qualification probability label and "matches remaining" are computed from the stale 0-played standing, not the live results.

### FAIL-5: Group C page standing table shows all teams at 0 points
- **Surface:** `/world-cup-2026/group-c`
- **Evidence:** All four Group C teams show P=0, W=0, D=0, L=0, Pts=0 despite at least two matchdays having been played.
- **Truth:** Two rounds of Group C matches played (June 11, June 20). At minimum Mexico, Spain, Australia, Serbia each have 2 played games.
- **Severity:** HIGH — ISR cache for the Group C page has not been refreshed with live standings data.

### FAIL-6: Group C page shows "No Group C results found"
- **Surface:** `/world-cup-2026/group-c`
- **Evidence:** "Match Fixtures/Results: No Group C results found (page showed results from other groups — Morocco/Haiti/Scotland/Brazil)."
- **Truth:** Group C has completed Matchday 1 (June 11) and Matchday 2 (June 20). At least 4 Group C match results exist.
- **Severity:** HIGH — results section is empty for the group that has already played, showing cross-group contamination.

### FAIL-7: Group J page standing table shows all teams at 0 points
- **Surface:** `/world-cup-2026/group-j`
- **Evidence:** All four Group J teams show 0 played, 0 points.
- **Truth:** Group J Matchday 1 was June 16, Matchday 2 was June 23. Both have passed.
- **Severity:** HIGH — same stale ISR cache issue as Group C.

### FAIL-8: South Africa team page shows "Opening fixture: vs Mexico"
- **Surface:** `/world-cup-2026/teams/south-africa`
- **Evidence:** "Opening fixture: vs Mexico" stated on the South Africa team page.
- **Truth:** South Africa (Group J) opens against Peru on June 16 (GS-J2). Mexico is in Group C. South Africa and Mexico do not share a group.
- **Severity:** CRITICAL — fundamentally wrong group/opponent attribution on the team page.

### FAIL-9: South Africa vs South Korea shown as June 25 result on results and fixtures pages
- **Surface:** `/world-cup-2026/results`, `/world-cup-2026/fixtures`
- **Evidence:** Results page: "South Africa vs South Korea: 1–0 (FT)" on June 25. Fixtures page: "South Africa 1–0 Korea Republic (25 June)."
- **Truth:** South Korea is in Group B. South Africa is in Group J. No group-stage match between these two teams exists in `fixtures.json`. South Africa's Matchday 3 is June 29 vs Uruguay; they have no match on June 25.
- **Severity:** CRITICAL — completely wrong opponent name for South Africa's result; the match is also on the wrong date.

### FAIL-10: Mexico vs South Africa listed as a Mexico result on the Mexico team page
- **Surface:** `/world-cup-2026/teams/mexico`
- **Evidence:** Mexico team page lists "Mexico vs South Africa 2–0 (Win)" as a past result.
- **Truth:** Mexico and South Africa are in different groups (C and J) and never meet in the group stage. No such fixture exists.
- **Severity:** CRITICAL — completely wrong opponent for Mexico's opening match. Mexico's Matchday 1 is vs Spain (GS-C1, June 11 at Azteca).

### FAIL-11: Mexico vs Spain (Matchday 1, June 11) not shown anywhere in Mexico results
- **Surface:** `/world-cup-2026/teams/mexico`, `/world-cup-2026/results`
- **Evidence:** The Mexico team page lists three results: Czechia, South Korea, South Africa. The results page shows Czechia and South Africa on June 25. Mexico's actual Matchday 1 opponent (Spain) and actual Matchday 2 opponent (Australia) appear nowhere in the Mexico trace.
- **Truth:** GS-C1 = Mexico vs Spain (June 11). GS-C3 = Mexico vs Australia (June 20).
- **Severity:** CRITICAL — the entire set of reported Mexico opponents is wrong. Spain and Australia are absent; Czechia, South Korea, and South Africa are shown instead.

### FAIL-12: Mexico upcoming fixtures absent from Fixtures page
- **Surface:** `/world-cup-2026/fixtures`
- **Evidence:** June 26 upcoming matches shown are Turkey vs USA and Paraguay vs Australia. No Mexico vs Serbia listed.
- **Truth:** Mexico vs Serbia (GS-C5) is June 26 at 21:00 Monterrey. Paraguay is not a Group C participant (Paraguay is not in WC 2026 at all per `teams.json`).
- **Severity:** HIGH — Mexico's final group match is absent from the upcoming fixtures surface.

---

## 7. ROOT CAUSE HYPOTHESIS

The pattern of failures points to a single systemic root cause: **the data feed (football-data.org API or its KV cache) is returning match records with incorrect team name attributions.** The authority cache appears to contain match records where:

1. Non-WC-2026 teams (Czechia, South Korea, Paraguay, South Africa) are being returned as opponents in WC 2026 group-stage matches.
2. Mexico's actual group opponents (Spain, Australia, Serbia) are absent from the Mexico team page results.
3. South Africa's actual opponents (Peru, Croatia, Uruguay) are absent; instead Mexico and South Korea appear.

This is consistent with the API returning international friendly results or CONCACAF/CAF qualifying results (pre-WC fixtures) mixed into the WC 2026 competition feed, or with incorrect `competition.id` filtering at the authority layer.

The standing table showing 0 points on the Mexico team page while the form section shows W-W-W is consistent with `getStandingsCached` and `getRecentMatchesCached` pulling from different cache slots with different staleness — standings have not been refreshed with Group C data, while the recent matches feed has (but with the wrong opponents).

---

## 8. VERDICT SUMMARY

**OVERALL VERDICT: MULTIPLE CRITICAL FAILURES**

| Surface | Mexico Status | South Africa Status |
|---|---|---|
| Hub | INCONCLUSIVE (snapshot truncated) | INCONCLUSIVE |
| Groups page | INCONCLUSIVE (snapshot truncated) | N/A |
| Group C page | FAIL (0 pts table, no results) | N/A |
| Group J page | N/A | FAIL (0 pts table) |
| Mexico team page | FAIL (wrong opponents, 0 pts table, contradictory qualification text) | FAIL (incorrectly shown as Mexico's opponent) |
| South Africa team page | FAIL (shown as opening vs Mexico) | FAIL (wrong opponent, stale table) |
| Fixtures page | FAIL (Czechia shown, Mexico vs Serbia absent, Paraguay vs Australia invalid) | FAIL (South Korea shown as South Africa opponent) |
| Results page | FAIL (Czechia shown, June 25 date wrong) | FAIL (South Korea shown, June 25 date wrong) |
| Bracket | INCONCLUSIVE (snapshot truncated) | INCONCLUSIVE |
| Round of 32 | NOT AUDITABLE (fetch blocked) | NOT AUDITABLE |

**Cross-surface agreement:** NO surface that returned readable data agrees with any other surface on Mexico's current match record. The Group C static table (all zeros) disagrees with the team page results section (3 wins). The team page results section disagrees with source fixture data (wrong opponents). The results page disagrees with source fixture data (Czechia, wrong date). No two readable surfaces present a consistent, accurate picture of Mexico's tournament status.

**The most severe failure is FAIL-10 and FAIL-11:** Mexico's actual group opponents (Spain, Australia, Serbia) do not appear anywhere in the Mexico team page results or in the results page traces. The team page instead shows South Africa, South Korea, and Czechia — none of whom are Group C opponents. This indicates the live data feed is systematically returning incorrect match records for Mexico's group stage, drawing from a non-WC competition or a broken authority cache.

---

*End of WC_TEAM_TRACE.md*
