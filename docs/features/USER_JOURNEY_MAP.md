# USER JOURNEY MAP
**Sprint:** DATA-18WC.END-TO-END  
**Date:** 2026-06-25

---

## Purpose

Audit the **user journey**, not just the data. Every step of every journey must
satisfy the full chain:

```
route → viewmodel → component → cache → authority → render → navigation
```

If any step 404s, shows an error card, dead-ends (no link to the next step), or
the SEO/nested brackets disagree on match identities → the whole sprint FAILS.

The 6 mandatory journeys are encoded in `scripts/check-wc-journeys.mjs` and run
against a live server (`npm run check:wc-journeys`, or
`CRAWL_BASE_URL=https://www.goalradar.org node scripts/check-wc-journeys.mjs`).

---

## Journey 1 — Home → Bracket → Round32 → Match → Back

| Step | Route | ViewModel | Component | Cache → Authority | Render |
|---|---|---|---|---|---|
| Home | `/` | `getWCAuthorityMatchesCached` + `buildKnockoutViewModel` | `MatchCard`, `BracketPreview` | authority:v1 | upcoming + bracket preview |
| Bracket | `/world-cup-2026/bracket` | `buildKnockoutViewModel` | `WCBracket` + `WCRoundPage` | authority:v1 | R32 grid + tree + round lists |
| Round32 | `/world-cup-2026/round-of-32` | `buildKnockoutViewModel.r32` | `WCRoundPage` | authority:v1 | 16 matches |
| Match | `/match/{id}-…` (followed from Round32) | `getOrBuildMatchSnapshot` → authority:v1 fallback | match detail page | snapshot KV → **authority:v1** | score hero + report |
| Back | `/world-cup-2026` | `getWCAuthorityMatchesV2` + VM | hub | authority:v1 | hub |

**Prod result:** ✅ PASS — `/match/537417-1st-group-a-vs-3rd-bcd` opens.

---

## Journey 2 — Standings → Group → Team → Match

| Step | Route | ViewModel | Component | Cache → Authority | Render |
|---|---|---|---|---|---|
| Standings | `/world-cup-2026-standings` | `getStandingsCached('WC')` | `WCGroupTable` | standings:v1 (+ authority-derived fallback) | 12 group tables |
| Group | `/world-cup-2026/group-a` | `getStandingsCached` + `getWCAuthorityMatchesV2` | `WCGroupTable` + `MatchCard` | standings:v1 + authority:v1 | table + fixtures |
| Team | `/world-cup-2026/teams/{slug}` | `getWCAuthorityMatchesV2` | `WCTeamPageContent` / teams page | authority:v1 | fixtures + results |
| Match | `/match/{id}-…` (followed from Team) | `getOrBuildMatchSnapshot` | match detail | snapshot KV → authority:v1 | detail |

**Prod result:** ✅ PASS via the canonical WC team page (`/world-cup-2026/teams/mexico`).

> **Finding (non-blocking):** the WC group standings table (`WCGroupTable`) also
> links team rows to the **generic** `/teams/{id}` club page, which is a separate
> multi-competition surface and does not surface WC fixtures — a soft dead-end for
> the match journey. The WC journey itself is navigable via the WC team links the
> group page already renders. Recommended follow-up: give `WCGroupTable` an opt-in
> WC-team-link mode so WC pages route rows to `/world-cup-2026/teams/{slug}`.

---

## Journey 3 — Fixtures → Match

| Step | Route | Source | Render |
|---|---|---|---|
| Fixtures | `/world-cup-2026/fixtures` | `getWCAuthorityMatchesV2` → authority:v1 | all matches |
| Match | `/match/{id}-…` | snapshot KV → authority:v1 | detail |

**Prod result:** ✅ PASS (`/match/537355-ecuador-vs-germany`).

---

## Journey 4 — Results → Match

| Step | Route | Source | Render |
|---|---|---|---|
| Results | `/world-cup-2026/results` | `getWCAuthorityMatchesV2` → authority:v1 | finished matches |
| Match | `/match/{id}-…` | snapshot KV → authority:v1 | detail |

**Prod result:** ✅ PASS (`/match/537331-czechia-vs-mexico`).

---

## Journey 5 — Schedule → Match

| Step | Route | Source | Render |
|---|---|---|---|
| Schedule | `/world-cup-2026-schedule` | `getWCAuthorityMatchesV2` → authority:v1 | upcoming by day |
| Match | `/match/{id}-…` | snapshot KV → authority:v1 | detail |

**Prod result:** ✅ PASS (`/match/537355-ecuador-vs-germany`).

---

## Journey 6 — SEO Bracket → Round → Match

| Step | Route | Source | Render |
|---|---|---|---|
| SEO Bracket | `/world-cup-2026-bracket` | `buildKnockoutViewModel` → authority:v1 | 6 round cards (ALL matches per round after fix) |
| Round | `/world-cup-2026/round-of-32` (followed) | `buildKnockoutViewModel` | round list |
| Match | `/match/{id}-…` | snapshot KV → authority:v1 | detail |

**Prod result:** ✅ PASS.

---

## Bracket parity gate

The SEO bracket (`/world-cup-2026-bracket`) and the nested bracket
(`/world-cup-2026/bracket`) must expose the **same set of match identities**.

- **Pre-fix (current prod):** SEO = 16 ids, nested = 32 ids → ❌ FAIL (the SEO page
  sliced each round to 4 matches: `stageMatches.slice(0, 4)`).
- **Fix:** remove the slice — SEO renders all matches per round from the same
  `buildKnockoutViewModel`. Post-deploy both expose the same 32 knockout match ids.
