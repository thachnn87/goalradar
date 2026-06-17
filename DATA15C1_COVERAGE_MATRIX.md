# DATA-15C.1 Coverage Matrix
## ESPN Enrichment Coverage — All Finished WC 2026 Matches

Date: 2026-06-17
Source: live ESPN summary endpoints, parsed with DATA-14A/15C production logic
(`scoringPlay===true` goals, positional assists, card type IDs 94/95/96, subs type 76).

---

## Legend

- **Goals** — count of `scoringPlay===true` key events (matches FD score).
- **Assists** — goals carrying a second participant (assister).
- **Cards** — yellow (94) + red (95) + second-yellow (96).
- **Subs** — substitution (76) events.
- **Stats** — Match Statistics panel basis; "computed" = derivable from
  goals+cards+subs (the free-tier method); requires the DATA-14A team-ID fix so
  per-team filters work.
- **Lineups** — ESPN `rosters` present (starting XI + bench + formationPlace).
  Available but not surfaced in the UI (out of scope; researched in DATA-14A).
- **GoalChk** — parsed goal count vs FD final score.

---

## Matrix (ESPN ground truth — what enrichment delivers once deployed)

| FD ID | Match | Score | Goals | Assists | Cards | Subs | Stats | Lineups | GoalChk |
|-------|-------|-------|-------|---------|-------|------|-------|---------|---------|
| 537327 | Mexico vs South Africa | 2–0 | 2 | 2 | 3 | 9 | computed | yes | ✅ |
| 537328 | South Korea vs Czechia | 2–1 | 3 | 3 | 1 | 9 | computed | yes | ✅ |
| 537333 | Canada vs Bosnia-Herzegovina | 1–1 | 2 | 2 | 5 | 10 | computed | yes | ✅ |
| 537334 | Qatar vs Switzerland | 1–1 | 2 | 1 | 3 | 10 | computed | yes | ✅ |
| 537339 | Brazil vs Morocco | 1–1 | 2 | 2 | 2 | 10 | computed | yes | ✅ |
| 537340 | Haiti vs Scotland | 0–1 | 1 | 0 | 4 | 8 | computed | yes | ✅ |
| 537345 | United States vs Paraguay | 4–1 | 5 | 4 | 6 | 9 | computed | yes | ✅ |
| **537346** | **Australia vs Turkey** | **2–0** | **2** | **1** | **1** | **10** | computed | yes | ✅ |
| 537351 | Germany vs Curaçao | 7–1 | 8 | 6 | 0 | 8 | computed | yes | ✅ |
| 537352 | Ivory Coast vs Ecuador | 1–0 | 1 | 1 | 4 | 9 | computed | yes | ✅ |
| 537357 | Netherlands vs Japan | 2–2 | 4 | 4 | 3 | 10 | computed | yes | ✅ |
| 537358 | Sweden vs Tunisia | 5–1 | 6 | 5 | 1 | 10 | computed | yes | ✅ |
| 537363 | Belgium vs Egypt | 1–1 | 2 | 1 | 4 | 10 | computed | yes | ✅ |
| 537364 | Iran vs New Zealand | 2–2 | 4 | 3 | 1 | 9 | computed | yes | ✅ |
| 537369 | Spain vs Cape Verde Islands | 0–0 | 0 | 0 | 2 | 9 | computed | yes | ✅ (true 0-0) |
| 537370 | Saudi Arabia vs Uruguay | 1–1 | 2 | 0 | 1 | 10 | computed | yes | ✅ |
| 537391 | France vs Senegal | 3–1 | 4 | 3 | 0 | 7 | computed | yes | ✅ |
| 537392 | Iraq vs Norway | 1–4 | 5 | 3 | 1 | 10 | computed | yes | ✅ |

### Totals

- Matches: **18**
- Goal count == FD score: **18 / 18** ✅
- Goals (all): 53 · Assists: 40 · Cards: 42 · Subs: 163
- Lineups (`rosters`) available: **18 / 18**
- Genuine goalless: **1** (Spain 0–0 Cape Verde)

> Note on Australia vs Turkey: 2 goals, 1 assist (one goal unassisted) — both goals
> are type-70 shots; the match resolves only with the DATA-15C `turkey→turkiye`
> alias (ESPN event 760421).

---

## Current production coverage (pre-deploy, 2026-06-17)

Verified via public match pages. DATA-14A/14B/15C are **not deployed** and ESPN
12h event caches have expired → broad regression.

| Match | ESPN-available goals | Currently on production | Gap |
|-------|----------------------|--------------------------|-----|
| Iran vs New Zealand | 4 | 0 (FAQ goalless) | −4 |
| Sweden vs Tunisia | 6 | 0 (FAQ goalless) | −6 |
| Ivory Coast vs Ecuador | 1 | 0 ("won." no scorer) | −1 |
| Netherlands vs Japan | 4 | 0 (FAQ goalless) | −4 |
| Australia vs Turkey | 2 | 0 (FAQ goalless) | −2 |
| Germany vs Curaçao | 8 | 0 ("won." no scorer) | −8 |
| Mexico vs South Africa | 2 | 0 ("won." no scorer) | −2 |
| Spain vs Cape Verde | 0 | 0 (correct) | 0 |

**Production coverage today: effectively 0 enriched matches.** Target after deploy +
revalidation: 17/18 enriched (the 18th genuinely 0-0). See the runbook in
`DATA15C1_PRODUCTION_AUDIT.md` §5.

---

## Statistics panel note

The Match Statistics panel (Goals / Yellow / Red / Subs per team) is **computed**
from the events above. It renders correct per-team splits only with the DATA-14A
team-ID resolution (`applyEspnEvents` mapping ESPN team → FD team). That fix is in
the undeployed stack — until deployed, even an enriched match would show 0–0 stats
(the original DATA-14A symptom). Deploying DATA-14A→15C resolves both goals and
statistics together.
