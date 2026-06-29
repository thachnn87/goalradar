# WC_LIVE_TRUTH.md — Production Truth Audit
**Date:** 2026-06-25 (Last day of group stage)
**Auditor:** Automated production HTML snapshot analysis
**Domain:** https://www.goalradar.org

---

## Data Quality Notice

The raw HTML snapshots provided were incomplete for several critical pages:

- `/live` — WebFetch returned a refusal (no raw HTML)
- `/world-cup-2026` hub — HTML truncated before match/score content
- `/world-cup-2026/results` — Tool summarized rather than returning raw HTML
- `/world-cup-2026/fixtures` — Tool summarized rather than returning raw HTML
- `debug-cache`, `debug-authority`, `debug-live` — 401/404 unavailable

Because the `/live` page raw HTML was not returned, **live match status cannot be directly compared between /live and the hub**. All findings below are based strictly on what was extractable from the provided snapshots.

---

## 1. Live Page (/live) — Matches Shown as LIVE

**RAW HTML AVAILABLE:** NO

The WebFetch tool refused to return raw HTML for `/live`, citing content reproduction concerns. The following is therefore **UNVERIFIABLE from this snapshot set**:

- Which matches are currently shown as LIVE
- What scores are displayed on the live page
- Whether the live indicator count is accurate

The `/world-cup-2026/results` page reports: `Live Matches: 0`

Today is June 25, 2026. Fixtures scheduled for today per the fixtures page:
- 20:00 UTC: Ecuador vs Germany
- 20:00 UTC: Curaçao vs Ivory Coast
- 23:00 UTC: Tunisia vs Netherlands
- 23:00 UTC: Japan vs Sweden

At the time of snapshot capture, all four of these matches may have been in progress, scheduled, or completed depending on exact capture time.

**VERDICT: CANNOT CONFIRM — raw /live HTML unavailable.**

---

## 2. Hub Live Section (/world-cup-2026) — Matches Shown as LIVE

**RAW HTML AVAILABLE:** PARTIAL (truncated before match content)

The hub HTML snapshot was truncated in the `<head>` section (nav rendering). The live section body content — including any live match cards — was not present in the provided snapshot.

**VERDICT: CANNOT CONFIRM — hub HTML truncated before match card content.**

---

## 3. Cross-Page LIVE vs FINISHED Mismatch

**VERDICT: CANNOT CONFIRM**

This check requires:
- Raw HTML from `/live` showing match statuses (unavailable)
- Raw HTML from `/world-cup-2026` hub live section (truncated)

No cross-page status mismatch can be confirmed or denied from the available evidence.

---

## 4. Hub Recent Results vs Live Page Overlap

**VERDICT: CANNOT CONFIRM**

The hub's recent results section was not present in the truncated HTML. The `/live` page was unavailable. This check cannot be performed.

---

## 5. P0 BUG CHECK — Panama vs Croatia (Match ID 537412)

**Expected status:** CANCELLED
**Known bug:** This match may display as FINISHED with a score

### Evidence from /world-cup-2026/results (summarized, not raw HTML):

> "Panama vs Croatia: 0-1 (FT)" — dated June 23

The results page shows Panama vs Croatia as **FINISHED (FT) with score 0-1**. This is a CANCELLED match and should NOT appear as FT with a score.

**SEVERITY: P0**
**STATUS: BUG CONFIRMED on /world-cup-2026/results**

HTML evidence is from a tool-summarized response, not verbatim raw HTML. The exact DOM node cannot be cited. However the tool reported:

> "June 23: Panama vs Croatia: 0-1 (FT)"

This is consistent with the known P0 bug: the CANCELLED match (ID 537412) is being rendered with status FT and score 0-1 on the results page.

### Evidence from /world-cup-2026/fixtures (summarized):

The fixtures page shows for Saturday June 27:
- 21:00 UTC: Panama vs England
- 21:00 UTC: Croatia vs Ghana

These are the rescheduled replacements. The cancelled Panama vs Croatia match does not appear in the upcoming fixtures list, which is correct. However it incorrectly appears in results as FT 0-1.

### /live page:

UNAVAILABLE — cannot confirm whether the cancelled match is also shown as LIVE.

---

## 6. CANCELLED Matches Showing With a Score

### Panama vs Croatia (ID 537412):

CONFIRMED bug. Results page shows `Panama vs Croatia: 0-1 (FT)` — a CANCELLED match displayed with a score and FT status.

### Other CANCELLED matches:

No other cancelled matches were identified in the available snapshot data. The fixtures page for June 27 shows Panama vs England and Croatia vs Ghana as the replacement fixtures, which is consistent with the Panama vs Croatia cancellation being the only known affected match.

---

## 7. Summary Table

| Check | Page(s) | Status | Severity |
|---|---|---|---|
| Live matches on /live | /live | UNVERIFIABLE — no raw HTML | — |
| Live matches on hub | /world-cup-2026 | UNVERIFIABLE — HTML truncated | — |
| LIVE vs FINISHED cross-page mismatch | /live + hub | UNVERIFIABLE — both unavailable | — |
| FINISHED results appearing on live page | /live + hub | UNVERIFIABLE — /live unavailable | — |
| Panama vs Croatia shown as FINISHED | /world-cup-2026/results | **BUG CONFIRMED** — shown as FT 0-1 | **P0** |
| CANCELLED match showing with score | /world-cup-2026/results | **BUG CONFIRMED** — 0-1 score on cancelled match | **P0** |

---

## 8. Additional Anomalies

### Group C standings showing all zeros (group-c page):

The Group C page shows all teams at 0 points / 0 games played, yet the fixtures and results pages confirm Mexico has played and won matches (including Czechia 0-3 on June 25 which is today). This is a stale standings render. The Mexico team page also shows `P: 0, W: 0, D: 0, L: 0` in the group standing table, contradicting the match results shown on the same page.

**SEVERITY: HIGH** — Group C standings are not reflecting completed match data.

### Group J page showing all zeros:

The Group J page shows Uruguay, Croatia, South Africa, Peru all at 0 points. The results page confirms South Africa 1-0 South Korea on June 25 — but South Korea is not in Group J, so that does not apply. However Croatia is in Group J and the results page shows England vs Ghana 0-0 (FT) on June 23 — Ghana is not in Group J either. Croatia's results from the results page (Panama vs Croatia 0-1 FT on June 23) would affect Group J standings. Group J standings showing all zeros while Croatia has a result recorded is inconsistent.

**SEVERITY: HIGH** — Group J standings may not be reflecting completed match data.

### Mexico team page qualification probability:

The Mexico team page states "84% chance, 1st in Group C with 3 matches remaining" while simultaneously showing 3 wins in recent results (Czechia 0-3, South Korea 1-0, South Africa 2-0). If Mexico has 3 wins they have 0 matches remaining in the group stage (3-team groups play 3 matches each). "3 matches remaining" is inconsistent with 3 completed wins.

**SEVERITY: MEDIUM** — Qualification probability text is stale or incorrect.

---

## 9. Raw HTML Availability Assessment

| Page | Raw HTML Available | Notes |
|---|---|---|
| /live | NO | WebFetch refused |
| /world-cup-2026 (hub) | PARTIAL | Truncated in head/nav |
| /world-cup-2026/fixtures | NO | Tool summarized only |
| /world-cup-2026/results | NO | Tool summarized only |
| /world-cup-2026/groups | YES | Head/nav only — no body content |
| /world-cup-2026/bracket | YES | Head/nav only — no body content |
| /world-cup-2026/group-a | YES | Head/nav only — no body content |
| /world-cup-2026/group-c | NO | Tool summarized only |
| /world-cup-2026/group-j | NO | Tool summarized only |
| /world-cup-2026/teams/france | YES | Head/nav only — no body content |
| /world-cup-2026/teams/south-korea | YES | Head/nav only — no body content |
| /world-cup-2026/teams/croatia | YES | Head/nav only — no body content |
| /world-cup-2026/teams/norway | YES | Head/nav only — no body content |
| /world-cup-2026/teams/mexico | NO | Tool summarized only |
| /world-cup-2026/teams/south-africa | NO | Tool summarized only |
| /world-cup-2026/round-of-32 | NO | Policy blocked |
| debug-cache | NO | 401 |
| debug-authority | NO | 404 |
| debug-live | NO | 401 |

**Critical finding:** None of the page snapshots provided body content — all raw HTML snapshots that were returned cut off in the `<head>` or `<nav>` sections. The only actionable match data came from tool-summarized responses, which do not constitute verbatim HTML evidence.

---

## 10. Confirmed Bugs (from available evidence)

### BUG-1 [P0]: Panama vs Croatia CANCELLED match displayed as FINISHED

- **Match ID:** 537412
- **Page:** /world-cup-2026/results
- **Displayed status:** FT
- **Displayed score:** 0-1 (Panama 0, Croatia 1)
- **Expected status:** CANCELLED
- **Expected score:** none
- **HTML evidence:** Tool-summarized response states: "June 23: Panama vs Croatia: 0-1 (FT)"
- **Note:** Verbatim HTML node not available — tool summarized. Evidence is consistent with the known P0 bug.

### BUG-2 [HIGH]: Group standings pages showing stale/zero data

- **Pages:** /world-cup-2026/group-c, /world-cup-2026/group-j, and likely others
- **Evidence:** All teams show P=0, W=0, D=0, L=0 despite multiple completed matches confirmed in results
- **Impact:** Users see incorrect qualification standings on the last day of group stage

### BUG-3 [MEDIUM]: Mexico team page shows stale probability copy

- **Page:** /world-cup-2026/teams/mexico
- **Evidence:** "84% chance, 1st in Group C with 3 matches remaining" — but 3 results already recorded
- **Impact:** Misleading qualification text on team page

---

## Audit Limitations

This audit is constrained by snapshot quality. The most critical pages for live match verification (/live, hub body, results raw HTML) either refused to return content, were truncated before match data, or were summarized by an intermediary model. A complete audit requires:

1. Direct `curl` or server-side fetch of `/live` returning full raw HTML
2. Full body HTML of `/world-cup-2026` hub including live match section
3. Full body HTML of `/world-cup-2026/results` including each match row with data attributes
4. Access to debug endpoints (currently 401/404)

The P0 Panama vs Croatia bug is confirmed from available evidence. All other live/status checks remain unverifiable from this snapshot set.
