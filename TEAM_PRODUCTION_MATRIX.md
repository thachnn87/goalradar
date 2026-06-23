# TEAM PRODUCTION MATRIX — DATA-18TEAM.1B Phase 2

**Task:** DATA-18TEAM.1B Phase 2
**Date:** 2026-06-23 ~03:1x UTC
**Production:** https://www.goalradar.org (deployed commit ≈ `cb5f8d6`/`37267d0`)

---

## Matrix

| Team | id | URL | KV `goalradar:/teams/{id}` | KV age | Provider `GET /v4/teams/{id}` | Render |
|------|----|-----|----------------------------|--------|-------------------------------|--------|
| Argentina | 762 | `/teams/762-argentina` | **MISSING** | — | **200 OK** (name=Argentina, tla=ARG, squad=26) | **Team Data Unavailable** |
| France | 773 | `/teams/773-france` | **MISSING** | — | **200 OK** | **Team Data Unavailable** |
| Brazil | 764 | `/teams/764-brazil` | **MISSING** | — | **200 OK** | **Team Data Unavailable** |
| Spain | 760 | `/teams/760-spain` | **MISSING** | — | **200 OK** | **Team Data Unavailable** |
| Germany | 759 | `/teams/759-germany` | **MISSING** | — | **200 OK** | **Team Data Unavailable** |

All pages return **HTTP 200** with the generic title `Team | GoalRadar`
(generateMetadata also received null), confirming the failure is data-layer, not routing.

---

## How each column was established (evidence, not assumption)

- **Render** — direct fetch of all 5 pages; each contains the literal string
  "Team Data Unavailable" (`page.tsx` renders this only when `getTeamCached()` returns null).
- **KV MISSING** — the deployed `getTeamCached()` (HEAD `api.ts:672`) is
  `readKVOnly(key); return data ?? null` with **no provider fallback**. A null
  render therefore proves `readKVOnly` returned null → the KV key
  `goalradar:/teams/{id}` is absent/expired for every team. (Direct KV read was
  not available: `/api/debug/kv` requires `ADMIN_SECRET`; the purpose-built
  `/api/debug/team-cache` instrument was committed at `e245f8b` but has not
  deployed — see note below.)
- **Provider 200** — direct `curl -H "X-Auth-Token: <key>" https://api.football-data.org/v4/teams/{id}`
  for all 5 ids returned HTTP 200; `762` returned `{id:762, name:"Argentina", tla:"ARG", squad:[26]}`.
  The provider layer is healthy.

---

## Interpretation

The provider works and the KV keys are empty, yet pages still fail — because the
**deployed reader has no provider fallback** and **no deployed job writes team KV**.
The team is reachable from the provider but nothing in production ever fetches it
into KV, and the reader never falls back to the provider. See TEAM_WARMING_AUDIT.md
and the root-cause section of DATA18TEAM1B_FINAL_VERDICT.md.

---

## Deploy anomaly note

The audit instrument `/api/debug/team-cache` (commit `e245f8b`, pushed ~03:0x)
returned HTTP 404 for 30+ minutes while older endpoints (`live-source-map`
`37267d0`, `state-divergence` `e288af2`) serve 200. A local `next build` of the
same code passes (exit 0). This suggests **Vercel is not currently deploying new
commits** — a second, independent issue that also affects the recovery path (the
team fix cannot reach production until deploys resume). Flagged in TEAM_RECOVERY_PLAN.md.

**Phase 2 complete. 5/5 teams: provider OK, KV missing, render unavailable.**
