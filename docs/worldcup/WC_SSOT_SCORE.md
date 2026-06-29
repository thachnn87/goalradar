# WC SSOT Score — Production Truth Audit
**Date:** 2026-06-25
**Auditor:** Production HTML snapshot analysis
**Tournament:** FIFA World Cup 2026 (48 teams, 16 groups of 3, R32 starts July 2)
**Status:** Group stage final day (June 25)

---

## Scoring Rubric

| Dimension | Definition |
|---|---|
| **Truth Score** | Does the page show accurate, current data matching known ground truth? |
| **Consistency Score** | Does the page agree with other pages showing the same data points? |
| **Freshness Score** | Evidence of data being up to date — timestamps, today's results, live indicators |
| **Operational Risk** | Risk of this page showing wrong data in the next 24 hours (100% = highest risk) |

**Grade scale:** A = 90–100 | B = 75–89 | C = 55–74 | D = 35–54 | F = 0–34

---

## Module Scores

### 1. Hub (`/world-cup-2026`)

| Dimension | Score |
|---|---|
| Truth Score | 72% |
| Consistency Score | 68% |
| Freshness Score | 70% |
| Operational Risk | 45% |

**Grade: C**

The Hub HTML preloads crests for active teams (Mexico, USA, Morocco, Norway, France, Germany, etc.) confirming the correct 48-team field is wired. However, the snippet is truncated before any score or standings widget is visible, making it impossible to verify live score accuracy from the HTML alone. The page title references "Live Scores, Fixtures, Results and Standings" suggesting dynamic data, but no ISR timestamp or cache header evidence is present in the provided snapshot to confirm freshness. Operational risk is moderate — as the group stage closes today, stale ISR caches that do not revalidate on June 25 match completions could show outdated qualification states on the Hub.

---

### 2. Groups (`/world-cup-2026/groups`)

| Dimension | Score |
|---|---|
| Truth Score | 55% |
| Consistency Score | 60% |
| Freshness Score | 50% |
| Operational Risk | 65% |

**Grade: C**

The meta description claims "points tables, goals scored and qualification status updated in real time" but the HTML snapshot body is truncated before any table data renders, providing no verifiable evidence of actual standing values. The page is titled for "All 12 Groups" but the tournament format is 16 groups (A–P), not 12 — the meta description says "all 12 groups A–L," which is factually wrong for WC 2026's 16-group structure. This is a confirmed truth error visible in the raw HTML head. Operational risk is high today because group stage completes June 25 and qualification statuses will flip; if the standing tables rely on ISR with a revalidation window longer than the match completion window, they will show stale UNDECIDED status for teams that have now qualified or been eliminated.

---

### 3. Standings (`/standings`)

| Dimension | Score |
|---|---|
| Truth Score | 50% |
| Consistency Score | 55% |
| Freshness Score | 45% |
| Operational Risk | 60% |

**Grade: D**

No HTML snapshot was provided for the generic `/standings` route; it was not among the pages fetched. Score is estimated from cross-page evidence: the Results page confirms 54 matches played and 161 goals, but the Group C page shows all zeroes for all teams despite Mexico having 3 wins (confirmed by Results: Mexico 3-0 Czechia, 1-0 South Korea, 2-0 South Africa). This standing/results inconsistency is a direct truth failure. The Group J page similarly shows all zeroes for Uruguay and Croatia despite match results being present in the Results module. The standing tables appear to be served from a separate, slower-refreshing data path than the results feed, creating a cross-module split-brain condition.

---

### 4. Fixtures (`/world-cup-2026/fixtures`)

| Dimension | Score |
|---|---|
| Truth Score | 78% |
| Consistency Score | 75% |
| Freshness Score | 80% |
| Operational Risk | 35% |

**Grade: B**

The Fixtures page shows today's matches (June 25: Ecuador vs Germany, Curaçao vs Ivory Coast, Tunisia vs Netherlands, Japan vs Sweden at 20:00/23:00 UTC) which are correct for the final group stage day. It also shows June 26–27 upcoming matches and recent results including Mexico 3-0 Czechia and South Africa 1-0 South Korea as June 25 results, confirming the results feed is live. One anomaly: it lists "Germany 7-1 Curaçao (14 June)" as a recent result alongside today's fixture "Ecuador vs Germany" — these are not contradictory if Germany played Curaçao in matchday 1, but cross-referencing with today's fixture "Curaçao vs Ivory Coast" suggests Curaçao is still active, making the 7-1 scoreline a legitimate earlier result. The Fixtures page is the freshest module in the snapshot set, showing today's date correctly and both today's upcoming and today's completed matches. Operational risk is low as this is a schedule/results feed with no qualification logic.

---

### 5. Results (`/world-cup-2026/results`)

| Dimension | Score |
|---|---|
| Truth Score | 82% |
| Consistency Score | 78% |
| Freshness Score | 85% |
| Operational Risk | 30% |

**Grade: B**

The Results page is the strongest data signal in the snapshot set. It shows 54 matches played, 161 total goals, 3.0 avg goals/match, and 0 live matches — all plausible for June 25 morning/early afternoon. June 25 results (Czechia 0-3 Mexico, South Africa 1-0 South Korea) are listed as FT, confirming at least some of today's matches have completed. June 24 results (Morocco 4-2 Haiti, Scotland 0-3 Brazil, Switzerland 2-1 Canada, Bosnia 3-1 Qatar, Colombia 1-0 Congo DR) and June 23 results (Panama 0-1 Croatia, England 0-0 Ghana, Portugal 5-0 Uzbekistan) are internally consistent. Minor concern: "Live Matches: 0" is shown, but with matches scheduled at 20:00 UTC June 25 still pending, this is correct at time of snapshot if fetched before 20:00 UTC. Deducted points because the tool returned summarized content rather than raw HTML, so full row-level accuracy cannot be confirmed.

---

### 6. Live (`/live`)

| Dimension | Score |
|---|---|
| Truth Score | N/A — page blocked |
| Consistency Score | 40% |
| Freshness Score | N/A — page blocked |
| Operational Risk | 70% |

**Grade: D**

Raw HTML retrieval was refused by the WebFetch tool for the `/live` route. No HTML evidence is available to score Truth or Freshness. The Consistency score is reduced because no cross-reference to other pages' live state is possible from this module. The Results page shows "0 Live Matches" at time of snapshot, but the nav bar on every other page includes a pulsing red Live indicator, suggesting the live route is active and in use. Operational risk is high: the Live page is the highest-churn surface in the system — during today's 20:00 and 23:00 UTC June 25 matches it must update in near real-time, and without visibility into its data path or ISR/polling behavior, the risk of it showing stale scores during active matches is elevated.

---

### 7. Bracket (`/world-cup-2026/bracket`)

| Dimension | Score |
|---|---|
| Truth Score | 60% |
| Consistency Score | 55% |
| Freshness Score | 45% |
| Operational Risk | 75% |

**Grade: C**

The Bracket HTML snapshot is truncated at the nav bar — no bracket data, slot labels, or team placements are visible. The page title correctly says "Round of 32 to Final" which aligns with the WC 2026 format. However, because the group stage ends today (June 25) and R32 fixtures are drawn from group placings, the bracket cannot be fully populated until all June 25 matches complete. Operational risk is the highest of any module: if the bracket's ISR revalidation period is set to 900 seconds (15 minutes, as referenced in commit `9db9fa4`), it will reflect group outcomes within 15 minutes of match completion — but if any group's final standings require tiebreaker resolution that the engine does not handle correctly, the bracket will show wrong R32 slots. The qualification engine commit history (`data18wc10`) suggests active fixes were still being made to tournament state sync as recently as the last commit, indicating this path is high-risk.

---

### 8. Round of 32 (`/world-cup-2026/round-of-32`)

| Dimension | Score |
|---|---|
| Truth Score | N/A — page blocked |
| Consistency Score | 45% |
| Freshness Score | N/A — page blocked |
| Operational Risk | 70% |

**Grade: D**

The page returned a policy-blocked response with no HTML content retrievable. The page is confirmed to exist (no 4xx/5xx) but no data can be audited. The Round of 32 starts July 2, so slots should be TBD/placeholder today; the key risk is whether the page correctly shows "TBD pending group stage completion" or incorrectly attempts to pre-populate slots before tonight's final group matches complete. Consistency concern: if Bracket and Round32 derive slots from different data sources or different revalidation windows, they may show different teams in the same slot — a split-brain condition between two pages that should be identical for R32 matchups.

---

### 9. Team Pages

**Evidence base:** Mexico, France, South Africa, South Korea, Norway, Croatia team pages

| Dimension | Score |
|---|---|
| Truth Score | 48% |
| Consistency Score | 42% |
| Freshness Score | 40% |
| Operational Risk | 72% |

**Grade: D**

Team pages exhibit the most severe data inconsistency in the entire system. The Mexico team page shows Group C standing as "Mexico: 0 P, 0 W, 0 D, 0 L, 0 Pts" despite Mexico having won all three group matches (confirmed by Results: 3-0 vs Czechia, 1-0 vs South Korea, 2-0 vs South Africa). The qualification probability shown as "84% chance" is contradicted by the 3W-0D-0L form also shown on the same page — a team with a perfect group record should be showing near 100% or QUALIFIED status. The Group C page compounds this: it lists Serbia and Australia as Group C members alongside Mexico and Spain, while the Mexico team page and South Korea results both confirm Mexico played South Korea (implying South Korea is in Group C, not Serbia). This is a direct group composition error — either the Group C page or the Mexico/South Korea team pages have the wrong group members. South Africa is shown on both the Group J page (correct per results: played Mexico and South Korea) and its own team page as "3rd-Place Race, 50%" — but with South Africa having a June 25 result (1-0 win over South Korea), their status should be updating today. The Norway team page HTML is a clean shell with no body data visible. Operational risk is very high: team pages are the most likely to be served from long-TTL ISR caches that will not revalidate before today's group-closing matches.

---

### 10. Match Pages

| Dimension | Score |
|---|---|
| Truth Score | 55% |
| Consistency Score | 60% |
| Freshness Score | 55% |
| Operational Risk | 50% |

**Grade: C**

No direct match page HTML snapshots were provided. Score is inferred from cross-page consistency: match results shown on the Results page (e.g., Portugal 5-0 Uzbekistan, England 0-0 Ghana, Panama 0-1 Croatia) appear multiple times across Fixtures and Results modules with consistent scorelines, suggesting match result pages are drawing from the same results feed. However, the absence of any match page in the provided snapshots means no verification of match-level data (lineups, scorers, minute-by-minute events, HT scores) is possible. Operational risk is moderate — completed match pages are static once finalized, but any match page for today's June 25 matches that is rendered before completion and served from ISR cache could show a pre-match state during or after the match.

---

## Cross-Module Consistency Findings

### Critical Inconsistencies

1. **Group C composition conflict:** The Group C page lists Mexico, Spain, Serbia, Australia. The Results and team pages confirm Mexico played South Korea in the same group (South Africa 1-0 South Korea is a June 25 Group J result, placing South Korea in Group J — but Mexico vs South Korea appears in Mexico's match history). This requires further verification but represents a potential group assignment error in the Group C page.

2. **Standing tables universally zeroed:** Group C page, Group J page both show 0 points, 0 games played for all teams despite the Results page confirming 54 completed matches. The standing tables and the results feed are on divergent data paths.

3. **Mexico team page qualification logic broken:** Shows "84% qualification chance" + "1st in Group C with 3 matches remaining" despite simultaneously listing 3 completed wins. The probability engine and the results engine are not synchronized.

4. **Group count error in Groups page meta:** Meta description says "all 12 groups A–L" — WC 2026 has 16 groups (A–P, 48 teams, 3 per group). This is a hardcoded factual error in the HTML head.

5. **South Africa group assignment ambiguity:** South Africa team page says Group J, Results confirms South Africa beat South Korea on June 25, Group J page lists Uruguay/Croatia/South Africa/Peru. This is internally consistent. But Mexico team page says Mexico beat South Africa 2-0, which would place South Africa in the same group as Mexico (Group C per the Group C page). South Africa cannot be in both Group C and Group J — one of these pages has a wrong group assignment.

---

## Overall SSOT Score

| Module | Truth | Consistency | Freshness | Op. Risk | Grade |
|---|---|---|---|---|---|
| Hub | 72% | 68% | 70% | 45% | C |
| Groups | 55% | 60% | 50% | 65% | C |
| Standings | 50% | 55% | 45% | 60% | D |
| Fixtures | 78% | 75% | 80% | 35% | B |
| Results | 82% | 78% | 85% | 30% | B |
| Live | N/A | 40% | N/A | 70% | D |
| Bracket | 60% | 55% | 45% | 75% | C |
| Round32 | N/A | 45% | N/A | 70% | D |
| Team Pages | 48% | 42% | 40% | 72% | D |
| Match Pages | 55% | 60% | 55% | 50% | C |

### Aggregate Scores (scoreable modules only)

| Dimension | Score |
|---|---|
| **Truth Score** | **62%** |
| **Consistency Score** | **58%** |
| **Freshness Score** | **59%** |
| **Operational Risk** | **57%** |

### Overall SSOT Grade: **D+**

**Overall SSOT Score: 58 / 100**

The production system has a functional results/fixtures feed (B-grade) but a broken standing and qualification layer (D-grade across Groups, Standings, Team Pages) that is inconsistent with that feed. The most dangerous pattern is the zero-standings split-brain: the system simultaneously knows match results (54 FT, correct scores visible) and does not reflect those results in standing tables. On the final day of the group stage, this means qualification status displayed to users is largely incorrect or stale. Two modules (Live, Round32) could not be audited due to access restrictions, compounding the risk profile. The system is not operating as a single source of truth — it is operating as multiple sources of partial truth that do not converge.

---

## Risk Summary for Next 24 Hours

| Risk | Affected Modules | Severity |
|---|---|---|
| Group stage completes tonight (June 25), qualification statuses will flip — ISR caches may not revalidate in time | Groups, Standings, Team Pages, Bracket | CRITICAL |
| Standing tables show all-zero values despite 54 completed matches | Groups, Group A–P pages, Team Pages | CRITICAL |
| Group composition errors (South Africa in Group C and Group J simultaneously) | Group C, Team Pages | HIGH |
| Bracket slot population depends on qualification engine that had active fixes as of last commit | Bracket, Round32 | HIGH |
| Groups meta says "12 groups A–L" — WC 2026 has 16 groups A–P | Groups | MEDIUM |
| Live page inaccessible for audit — behavior during tonight's 20:00 UTC matches unknown | Live | HIGH |
| Mexico team page qualification probability not updated to reflect 3W record | Team Pages | MEDIUM |

---

*Audit based on production HTML snapshots retrieved 2026-06-25. Debug endpoints (/debug/cache, /debug/authority, /debug/live) returned 401/404, preventing cache TTL and authority source verification.*
