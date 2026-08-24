# INC-WC-DATA-001 — Containment Closeout & Frozen-Data Readiness Gate

Status: Containment CLOSED · Recovery OPEN (owner-blocked)
Owner: Project maintainer
Date: 2026-08-20
Authority: Incident closeout + GO gate for EPIC-WC-FROZEN-DATA-001. Governed by DGP-001, ADR-007 v2, DESIGN-CHANGE-001.

> **Contained does not mean recovered.** Production no longer presents synthetic WC-2026 data as historical fact, but the real completed tournament is still not available to the application. The "unavailable" state is CORRECT until an authoritative frozen dataset exists.

---

## 0. Status ledger
| Dimension | State |
|---|---|
| Containment | **CLOSED / PASS** |
| Production integrity | **SAFE** (real-or-honestly-unavailable) |
| Recovery | **OPEN** |
| Frozen dataset | **MISSING** |
| Owner dependency | **OPEN** |

Production SHA: `d756cc3` (Phase 2) · prior: `17088d8` (Phase 1 authority), `19a60b0` (standings guard).

## 1. Containment audit (commits `19a60b0`, `17088d8`, `d756cc3`)
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | No synthetic WC-2026 historical surface remains | ✅ | production scan: standings/groups/group-detail/results/fixtures/hub/teams/team-page/bracket all real-or-unavailable |
| 2 | No negative-id A2 matches reach production | ✅ | `authority-cache.ts` `realOnly = matches.filter(id > 0)` on every read path (primary/DR/cold); A2 seed removed |
| 3 | No WC_ALL_TEAMS historical roster reaches production | ✅ | standings return `[]` (not `getStaticWCGroupTables`); hub grid + teams list + team pages gated on `WC_2026_HISTORICAL_AVAILABLE` (false) |
| 4 | No synthetic historical JSON-LD | ✅ | team-page/teams-list gated (no SportsTeam/SportsEvent); `[group]` JSON-LD derives from now-empty authority |
| 5 | No synthetic historical FAQ | ✅ | `[group]` FAQ derives team names from empty standings → blank list |
| 6 | No synthetic bracket participants | ✅ | bracket positional fallback gated on frozen flag; authority empty → neutral TBD |
| 7 | No fabricated scores/standings/results | ✅ | none introduced; empty/unavailable everywhere |
| 8 | Live competitions unaffected | ✅ | all guards scoped to `competition === 'WC'` / WC-only `wc-frozen.ts`; league paths untouched |

Verification: `tsc` clean · `eslint` 0 · `jest` 99/99 · production build success · production scan clean.

## 2. Frozen Data Input Contract (minimum authoritative input for NO-GO → GO)
No field below may be populated with guessed values. Source must be authoritative (see §3).
- Tournament identity (FIFA World Cup) + season/year (2026)
- 48 real teams + canonical team names
- Group assignment A–L (real draw)
- 72 group-stage matches
- 32 knockout matches
- Final scores (all 104)
- Final match states (all FINISHED)
- Final group standings (or derivable + reconciled)
- Knockout progression (bracket participants + winners)
- Venues (16) + chronology (valid: SF before Final)
- Source provenance + authoritative source + capture timestamp
- Source-diff policy (provider vs official reconciliation)
- Sign-off owner (Business + Historical Authority)

## 3. Authority distinction (must not be conflated)
| Role | Definition |
|---|---|
| **Authoritative Source** | official FIFA / authoritative record — the truth of what happened |
| **Acquisition Source** | football-data.org or another approved capture channel — how we obtain it |
| **Operational Dataset** | the frozen canonical dataset (once produced) |
| **Presentation Dataset** | derived pages / JSON-LD |

Provider data must **never** become historical authority merely because it is technically reachable. Re-enabling the provider as historical authority is prohibited.

## 4. GO evidence (owner must supply; all required)
- **G1** Real completed WC-2026 dataset is retrievable
- **G2** Source provenance established
- **G3** Real 48-team roster + group composition available
- **G4** All 104 matches + final results available
- **G5** Standings/bracket derivable and reconciled
- **G6** Official source for awards/venues/statistics identified
- **G7** Settle/correction window confirmed
- **G8** Business + Historical Authority sign-off path identified

Until all eight hold, EPIC-WC-FROZEN-DATA-001 remains **NO-GO** and `wc-frozen.ts` returns null (surfaces stay "unavailable").

## 5. Predictions pages classification (audit only — do not modify)
`predictions`, `winner-predictions`, `golden-boot-predictions`, `group-*-predictions`.
- Clearly labelled as predictions/forecasts (titles, headers, "Favorites, Odds & Expert Picks"). "Champions" = predicted paths; "Historical" tables = **past** tournaments (2022 etc.), not WC-2026.
- They do **not** assert completed WC-2026 results → **not a containment breach** (not "history").
- However they name synthetic teams in pre-tournament future tense for a now-finished tournament (stale framing).
- **Verdict: REQUIRES PRODUCT DECISION** — retain as clearly-labelled (archived) forecasts, update, or gate. Not implemented here.

## 6. Guardrails (do not weaken)
Do NOT: guess the real roster in WC_ALL_TEAMS · manually enter results/standings/bracket · use a random third-party source as authority · re-enable the provider as historical authority · add another fallback · weaken the frozen gate · restore synthetic historical content · change live-league architecture · SEO redesign. The `wc-frozen` gate + integrity guard (`jest`) enforce this in CI.

## 7. Recommended next owner action
Execute the GO-gate evidence collection (G1–G8), starting with **G1/G3/G4**: obtain the real completed WC-2026 dataset (teams, groups, 104 matches, results) from the authoritative source. On GO, wire it into `getFrozenWCTournament()` — every gated surface flips from "unavailable" to real at once, with no further runtime change.

---

**FINAL: CONTAINMENT CLOSED · RECOVERY BLOCKED — AUTHORITATIVE FROZEN DATA REQUIRED.** The incident is not recovered.
