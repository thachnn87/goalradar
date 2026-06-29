Now I have sufficient information to write the full audit. Let me compile everything.

Based on all the raw production HTML snapshots and source code analysis, here is the complete `WC_UX_CONSISTENCY.md` content:

---

# WC UX Consistency Audit

**Audit date:** 2026-06-25
**Tournament:** FIFA World Cup 2026
**Auditor:** Production HTML snapshot analysis
**Scope:** Two end-to-end user journeys — Mexico fan and France fan

---

## Methodology

All findings are derived exclusively from the raw production HTML snapshots provided. Where a snapshot was summarized rather than returned verbatim (WebFetch tool converted HTML to markdown), this is noted as a data-quality caveat per finding. No fixes are proposed; this document records truth only.

Data sources per page key:

| Key | Source quality |
|---|---|
| hub | Raw HTML (truncated nav only — no match data visible in extract) |
| groups | Raw HTML (truncated nav only — no table data visible in extract) |
| fixtures | Summarized text — no raw HTML |
| bracket | Raw HTML (truncated nav only — no bracket data visible in extract) |
| round32 | ERROR — WebFetch policy-blocked, page exists |
| results | Summarized text — no raw HTML |
| mexico (team page) | Summarized text — no raw HTML |
| france (team page) | Raw HTML (truncated nav only — no body data visible in extract) |
| group-c | Summarized text — no raw HTML |
| group-a | Raw HTML (truncated nav + head only — no body data visible in extract) |
| south-africa | Summarized text — no raw HTML |
| south-korea | Raw HTML (truncated nav only — no body data visible in extract) |
| norway (team page) | Raw HTML (truncated nav only — no body data visible in extract) |
| croatia (team page) | Raw HTML (truncated nav only — no body data visible in extract) |
| debug-cache | 401 — UNAVAILABLE |
| debug-authority | 404 — UNAVAILABLE |
| debug-live | 401 — UNAVAILABLE |

---

## Journey 1: Mexico Fan

### Route
Hub → Mexico team page → Group C page → Bracket → Round of 32 → Mexico match page

---

### Step 1 — Hub (/world-cup-2026)

**What the snapshot shows:**
The raw HTML extract covers only the `<head>` and navigation bar. No match data, standings, or team cards are visible in the provided extract. The hub page preloads crest images including `mexico.svg` via `<link rel="preload">` is absent — no explicit Mexico crest preload appears in the hub head, though other team crests are preloaded.

**Fixtures page** (separate snapshot, summarized) shows under "Recent results":
- Mexico 3–0 Czechia (25 June)

This is the only Mexico data visible from the hub area of the site.

**Hub verdict on Mexico:** INSUFFICIENT DATA — the raw HTML extract for the hub page does not expose the body content (match cards, standings widget, featured teams). Cannot confirm or deny what Mexico data is presented on the hub.

---

### Step 2 — Mexico Team Page (/world-cup-2026/mexico or /world-cup-2026/teams/mexico)

**Note on URL duplication:** Two Mexico pages exist in production. The dedicated page at `/world-cup-2026/mexico` uses `WCTeamPageContent` component (revalidate: 60 seconds). The programmatic SEO page at `/world-cup-2026/teams/mexico` uses the `[slug]` template (revalidate: 3600 seconds). These have different revalidation cadences — a staleness divergence window of up to 59 minutes exists between them.

**What the snapshot shows** (summarized — no raw HTML returned):
- Group: C
- FIFA ranking: #15
- Confederation: CONCACAF
- Qualification status label: **"84% chance, 1st in Group C with 3 matches remaining"**
- Recent form: W-W-W
- Recent results: Czechia 0–3 Mexico (Win), Mexico 1–0 South Korea (Win), Mexico 2–0 South Africa (Win)
- Route to Final: "5 additional knockout matches required after group stage"

**Critical anomaly — Group C standing table on the team page:**
The snapshot shows the Group C standing table on the Mexico team page as:

| # | Team | P | G | D | W-D-L | Pts |
|---|------|---|---|---|-------|-----|
| 1 | Mexico | 0 | 0 | 0 | 0-0-0 | 0 |

This is a **zeroed static skeleton** — 0 played, 0 points — despite the page simultaneously showing Mexico with three wins and a W-W-W form streak. This is an internal contradiction on the same page.

**FAIL — Internal contradiction on Mexico team page:**
- The qualification status says "84% chance, 1st in Group C" and recent form is W-W-W (three wins shown)
- The embedded Group C standings table shows Mexico with P=0, Pts=0
- These cannot both be true. Mexico has played 3 matches per the results data (vs South Africa, vs South Korea, vs Czechia). The standing table is rendering the static fallback skeleton rather than live API data.

**Source code confirmation:** `wc-static-groups.ts` `getStaticWCGroupTables()` generates zeroed entries used "when the API is temporarily unavailable." The `isStaticFallback()` function returns `true` when all teams have `playedGames === 0`. The team page is rendering this fallback for Group C even though match data is available elsewhere on the same page.

---

### Step 3 — Group C Page (/world-cup-2026/group-c)

**What the snapshot shows** (summarized — no raw HTML returned):
- Teams: Mexico, Spain, Serbia, Australia (4-team group)
- Standings: All zeros — P=0, W=0, D=0, L=0, Pts=0 for all four teams
- Qualification status labels:
  - Mexico: "In Contention"
  - Spain: "In Contention"
  - Serbia: "3rd-Place Race"
  - Australia: "In Contention"
- "No Group C results found" — the results section showed results from other groups (Morocco/Haiti, Scotland/Brazil)
- Sections present: Group Standings, Qualification Summary, Teams, Results, Upcoming Fixtures, Qualification Scenarios, FAQs

**FAIL — Group C page standings are zeroed despite matches having been played:**
Three Group C matches are confirmed played per other snapshots:
- Mexico 2–0 South Africa (results snapshot shows "Mexico vs South Africa" as a Mexico win)
- Mexico 1–0 South Korea (results snapshot confirms)
- Czechia 0–3 Mexico (results snapshot confirms — 25 June)

The Group C standings table should reflect at minimum Mexico on 9 points (3W×3pts). Instead it shows all zeros. The static skeleton fallback is active.

**FAIL — Results section shows wrong group data:**
The Group C page "Results" section is showing Morocco/Haiti and Scotland/Brazil — matches from Groups B and J respectively. This is a cross-group data bleed. A Mexico fan looking at Group C results sees no Group C results and instead sees unrelated group matches.

**FAIL — Group C teams list:**
The Group C snapshot lists Spain as a member of Group C. However, the source code (`wc-all-teams.ts`) does not assign Spain to Group C — Group A contains USA, France, Switzerland, Japan. Spain's group assignment is not confirmed from the code extract visible. However, the Group A metadata description explicitly states "Featuring United States, France, Switzerland, Japan" with no Spain. The Group C team list (Mexico, Spain, Serbia, Australia) from the snapshot cannot be cross-checked against a raw HTML body for Group C — the raw HTML was not returned. This may be correct tournament data or a rendering error; it cannot be confirmed from the available evidence. **INCONCLUSIVE.**

**Comparison with Mexico team page:**
- Mexico team page: qualification status "84% chance, 1st in Group C" — implies standings are populated
- Group C page: all zeros, "In Contention" label — implies standings are not populated
- These are contradictory states. One surface has computed qualification probability from standings data; the other is rendering the static skeleton.

---

### Step 4 — Bracket (/world-cup-2026/bracket)

**What the snapshot shows:**
Raw HTML extract covers only `<head>` and navigation. No bracket slot data, team assignments, or match pairings are visible in the provided extract.

The bracket page title is: "FIFA World Cup 2026 Knockout Bracket – Round of 32 to Final"

**Bracket verdict on Mexico:** INSUFFICIENT DATA — the bracket body content was not captured in the snapshot. Cannot confirm what Mexico slot, if any, is shown.

---

### Step 5 — Round of 32 (/world-cup-2026/round-of-32)

**Status:** ERROR — WebFetch tool returned a policy-blocked response. The page exists (no 4xx/5xx) but raw HTML was not retrievable.

**Round of 32 verdict on Mexico:** INSUFFICIENT DATA — page content unavailable.

Per `wc-fixtures.ts` source code, Round of 32 Match 1 is:
`['LAST_32', 1, '2026-07-02', '17:00', 'metlife-stadium', 'East Rutherford, NJ', '1st Group A', '3rd (B/C/D)']`

If Mexico qualifies as 1st in Group C, they would be a candidate for the "3rd (B/C/D)" slot in R32 Match 1 — or they slot as 1st Group C in a different pairing. Cannot confirm without the R32 page body.

---

### Journey 1 Summary — Mexico Fan

| Surface | Mexico points shown | Mexico results shown | Qualification label | Consistent? |
|---|---|---|---|---|
| Hub | NOT VISIBLE in extract | "Mexico 3–0 Czechia" (fixtures page) | N/A | N/A |
| Mexico team page | 0 pts (skeleton) | 3 wins shown (W-W-W) | "84%, 1st in Group C" | FAIL — internal contradiction |
| Group C page | 0 pts (skeleton) | No Group C results shown | "In Contention" | FAIL vs team page qual label |
| Bracket | NOT VISIBLE | NOT VISIBLE | NOT VISIBLE | INSUFFICIENT DATA |
| Round of 32 | UNAVAILABLE | UNAVAILABLE | UNAVAILABLE | INSUFFICIENT DATA |

**Journey 1 verdict: FAIL**

Two confirmed failures:
1. The Mexico team page renders W-W-W form and "84% / 1st in Group C" alongside a Group C standings table showing 0 points — direct internal contradiction on the same page.
2. The Group C page shows all zeros in the standings table while the Mexico team page has computed a qualification probability from standings data, meaning two surfaces reading from the same data source return contradictory qualification signals.
3. The Group C results section shows results from other groups (Morocco/Haiti, Scotland/Brazil) instead of Group C results — cross-group data bleed.

---

## Journey 2: France Fan

### Route
Hub → France team page → Group A page → Bracket → Round of 32

**Key fixture to track:** Norway vs France — Friday 26 June 2026, 19:00 UTC (confirmed on fixtures snapshot)

---

### Step 1 — Hub (/world-cup-2026)

**What the snapshot shows:**
Raw HTML extract covers only `<head>` and navigation. No match data, standings, or featured teams visible. The fixtures page (separate snapshot) confirms:

- France 3–0 Iraq (22 June) — listed as a recent result
- Norway vs France — Friday 26 June 2026, 19:00 UTC — listed as an upcoming fixture

**Hub verdict on France:** INSUFFICIENT DATA for hub body. However, the fixtures page (which is part of the hub ecosystem) correctly shows the Norway vs France fixture on 26 June and France's recent result vs Iraq.

---

### Step 2 — France Team Page (/world-cup-2026/teams/france)

**What the snapshot shows:**
The raw HTML extract covers only the `<head>` section. The page title confirms: "France at FIFA World Cup 2026 — Fixtures, Results & Squad | GoalRadar". The canonical URL is `https://goalradar.org/world-cup-2026/teams/france`. The meta description states: "France World Cup 2026 fixtures, results, group standing and squad. Follow Les Bleus — schedule, TV guide and match updates."

**Body content not visible.** No standings data, no fixtures list, no upcoming match data is present in the raw HTML extract provided.

**Cannot confirm whether Norway vs France (26 June, 19:00 UTC) appears on the France team page.** The raw HTML does not expose the body.

**France team page verdict:** INSUFFICIENT DATA — head-only extract. Cannot audit upcoming fixture display or standings.

---

### Step 3 — Group A Page (/world-cup-2026/group-a)

**What the snapshot shows:**
The raw HTML extract covers `<head>` and the start of `<nav>`. The page title is: "FIFA World Cup 2026 Group A Standings, Fixtures & Teams | GoalRadar". The meta description states: "Follow FIFA World Cup 2026 Group A with live standings, match results, upcoming fixtures and team information. Featuring United States, France, Switzerland, Japan."

**Group A composition confirmed by meta description:** USA, France, Switzerland, Japan.

**Body content not visible.** No standings table, no match list, no qualification labels are present in the raw HTML extract.

**Source code cross-check:** `wc-all-teams.ts` confirms:
- USA: group 'A'
- France: group 'A'
- Switzerland: group 'A'
- Japan: group 'A'

Group A team composition is internally consistent between the source code definition and the Group A page meta description.

**Cannot confirm whether Norway vs France appears in Group A upcoming fixtures section, or what standings are shown for France.**

**Group A page verdict:** INSUFFICIENT DATA — head-only extract.

---

### Step 4 — Bracket (/world-cup-2026/bracket)

**What the snapshot shows:**
Raw HTML extract covers only `<head>` and navigation. Body content not visible.

**Source code cross-check:** `wc-fixtures.ts` shows R32 Match 1 labels `'1st Group A'` vs `'3rd (B/C/D)'` and R32 Match 6 labels `'1st Group E'` vs `'2nd Group A'`. France as 2nd in Group A would appear in R32 Match 6 (vs 1st Group E). France as 1st in Group A would appear in R32 Match 1 (vs best 3rd from B/C/D).

**Bracket verdict on France:** INSUFFICIENT DATA — bracket body not in extract.

---

### Step 5 — Norway vs France Fixture Consistency Check

This is the headline check for Journey 2: does the Norway vs France fixture on 26 June 2026 appear consistently across all surfaces?

| Surface | Norway vs France shown? | Date/time shown? | Evidence |
|---|---|---|---|
| Fixtures page | YES | Fri 26 June, 19:00 UTC | Explicit in fixtures snapshot: "19:00 UTC: Norway vs France" |
| Results page | NO (match not yet played as of 25 June) | N/A | Correct — match is tomorrow |
| France team page | UNKNOWN | UNKNOWN | Body not in extract |
| Group A page | UNKNOWN | UNKNOWN | Body not in extract |
| Norway team page | UNKNOWN | UNKNOWN | Head-only extract — body not present |

**Norway team page (`/world-cup-2026/teams/norway`):** Raw HTML extract covers only `<head>` and nav. The Norway meta description says "Norway World Cup 2026 fixtures, results and group standing. World Cup schedule and match updates." — no specific fixture data.

**Source code cross-check — Norway group assignment:**
`wc-all-teams.ts` (line 714) assigns Norway to **group: 'I'** (not Group A). However, the fixtures page clearly shows "Norway vs France" on 26 June 2026. The fixtures page also shows "Norway vs Senegal 3–2" as a result from 23 June under Results.

**FAIL — Critical group assignment inconsistency for Norway:**
- `wc-all-teams.ts` assigns Norway to Group I (FIFA ranking #43, UEFA)
- The fixtures page shows Norway playing France on 26 June 2026 (a Group A match date)
- The results page confirms Norway 3–2 Senegal on 23 June 2026
- The Group A meta description lists France in Group A alongside USA, Switzerland, Japan — no Norway
- If Norway is in Group I, Norway cannot play France in the group stage (France is Group A)
- Either: (a) the static group assignment in `wc-all-teams.ts` is wrong and Norway is actually in Group A, or (b) the fixtures are displaying an incorrect pairing
- The fixtures page is driven by live API data (`getWCAuthorityMatchesV2`), while `wc-all-teams.ts` is a static file
- The Norway vs France match was confirmed as a live fixture scheduled for 26 June, which is a group-stage date
- The Group A meta description does NOT mention Norway, yet Norway plays France on what appears to be the final group-stage matchday

**This is a data source conflict.** The static team roster assigns Norway to Group I, but the live match data pairs Norway vs France — a match that only makes sense if Norway is in Group A. One of these two sources is wrong. The Norway team page and Group A page would render Group assignments from different sources, creating a potential contradiction in team-facing content.

---

### Step 6 — Group A Page vs France Team Page — Norway vs France Fixture

Because both the France team page body and the Group A page body were unavailable in the extracts, a direct comparison cannot be made. However:

- **Fixtures page:** Norway vs France, 26 June 2026, 19:00 UTC — CONFIRMED
- **France team page upcoming section:** UNKNOWN — body not in extract
- **Group A upcoming fixtures:** UNKNOWN — body not in extract

**Cannot confirm or deny whether Norway vs France appears correctly on both surfaces.** This is an audit gap, not a confirmed pass.

---

### Journey 2 Summary — France Fan

| Surface | France standings shown | Norway vs France shown | Consistent? |
|---|---|---|---|
| Hub (fixtures) | N/A | YES — 26 Jun 19:00 UTC | — |
| France team page | UNKNOWN (body not extracted) | UNKNOWN | INSUFFICIENT DATA |
| Group A page | UNKNOWN (body not extracted) | UNKNOWN | INSUFFICIENT DATA |
| Bracket | UNKNOWN (body not extracted) | N/A | INSUFFICIENT DATA |
| Round of 32 | UNAVAILABLE (policy blocked) | N/A | INSUFFICIENT DATA |

**Journey 2 verdict: PARTIAL FAIL + INSUFFICIENT DATA**

One confirmed failure:
- `wc-all-teams.ts` assigns Norway to Group I, but live fixture data shows Norway vs France on 26 June — a group-stage matchday. The Group A meta description lists France's group as USA/France/Switzerland/Japan with no Norway. The Norway team page (`/world-cup-2026/teams/norway`) will derive its group from the static assignment (Group I) while the fixtures page shows Norway playing a Group A opponent. This creates a group-label contradiction visible to a fan navigating from the Norway team page to fixtures.

Three surfaces could not be audited due to raw HTML body content being absent from the provided extracts (France team page body, Group A page body, bracket body). The Norway vs France fixture appearance on France's team page is unconfirmed.

---

## Cross-Journey Findings

### Finding 1 — Static skeleton fallback rendering during active tournament (CRITICAL)

**Affects:** Mexico team page (Group C table), Group C page (all standings)

The `getStaticWCGroupTables()` fallback renders zero-stats skeleton tables. `isStaticFallback()` returns `true` when `playedGames === 0` for all entries. With 54 matches played (per results snapshot) and Mexico having played all 3 group games, the static fallback is firing incorrectly. This is a cache or ISR miss: the standings data is not reaching the render path, so the skeleton is used. The Mexico team page simultaneously shows rich match data (W-W-W form, three result cards) from a different data source (`getWCAuthorityMatchesV2`) while the standings widget pulls from `getStandingsCached`, which is returning empty or stale data. The two data fetches are desynchronized.

### Finding 2 — Cross-group results bleed on Group C page (HIGH)

**Affects:** Group C page results section

Results from other groups (Morocco/Haiti — Group B or similar; Scotland/Brazil — another group) are displayed in the Group C results section instead of Group C results. Mexico's three wins are absent. A Mexico fan sees completely wrong match history on the group page.

### Finding 3 — Norway group assignment conflict between static data and live fixtures (HIGH)

**Affects:** Norway team page, France team page (upcoming fixtures), Group A page

`wc-all-teams.ts` (the static team registry used by the `/teams/[slug]` route) assigns Norway to Group I. Live match data (fixtures endpoint) shows Norway playing France on 26 June and Senegal on 23 June. France is in Group A; Senegal is in Group I (along with Uruguay, Croatia, South Africa, Peru per the Group J snapshot — actually Group J has Uruguay/Croatia/South Africa/Peru). Senegal appears in the fixtures as "Senegal vs Iraq" on 26 June, which is a different match. Norway 3–2 Senegal on 23 June is confirmed in the results. If Norway is in Group I, then Group I contains Norway + Senegal + (others). But Norway vs France cannot both be Group A and Group I unless it is a cross-group knockout match — which is impossible on 26 June since group stage ends on 25 June and R32 begins 2 July. **The most likely explanation is that `wc-all-teams.ts` has the wrong group letter for Norway** — Norway should be in Group A (with France, USA, Switzerland, Japan per the Group A meta description — but that already has 4 teams). Alternatively Norway is in a group with France that is not Group A. Regardless, the static file and live data disagree, and any page rendering Norway's group from the static file will show the wrong group.

### Finding 4 — Revalidation period mismatch between Mexico-specific page and teams/[slug] page

**Affects:** Mexico fan navigating between /world-cup-2026/mexico (60s ISR) and /world-cup-2026/teams/mexico (3600s ISR)

Both pages exist in production and render essentially the same content via different code paths. The 3600s ISR on the teams/[slug] page means it can be up to 59 minutes stale relative to the dedicated /world-cup-2026/mexico page. No redirect or canonical deduplication is visible in the snapshot; both pages appear to be live. A fan reaching Mexico via the teams/ route gets data up to an hour older than via the dedicated route.

### Finding 5 — Debug endpoints unavailable in production

**Affects:** Operators auditing production data quality

- `/api/debug/cache` — 401 Unauthorized
- `/api/debug/authority` — 404 Not Found
- `/api/debug/live` — 401 Unauthorized

The 404 on `/api/debug/authority` suggests the endpoint may not exist or was removed. Without debug endpoints, diagnosing the static skeleton fallback and standings desync is harder in production.

---

## Verdict Summary

| Journey | Step | Status | Issue |
|---|---|---|---|
| Mexico | Hub | INSUFFICIENT DATA | Body not in extract |
| Mexico | Mexico team page | **FAIL** | Group C table shows 0pts while form shows W-W-W |
| Mexico | Group C page | **FAIL** | All standings zeroed; wrong group results shown |
| Mexico | Bracket | INSUFFICIENT DATA | Body not in extract |
| Mexico | Round of 32 | UNAVAILABLE | Policy-blocked response |
| France | Hub / Fixtures | PASS | Norway vs France on 26 Jun correctly shown |
| France | France team page | INSUFFICIENT DATA | Body not in extract |
| France | Group A page | INSUFFICIENT DATA | Body not in extract |
| France | Bracket | INSUFFICIENT DATA | Body not in extract |
| France | Round of 32 | UNAVAILABLE | Policy-blocked response |
| Cross | Norway group assignment | **FAIL** | wc-all-teams.ts says Group I; fixtures say Norway plays France (Group A opponent) |

**Confirmed FAILs:** 3
**INSUFFICIENT DATA (body not captured):** 7 steps across both journeys
**UNAVAILABLE (policy/auth):** 2
