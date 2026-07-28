# Provider Recovery Handoff — WC 2026 Live Data (WS1)

Status: OPEN — blocked on owner action (not code)
Owner: Project maintainer (thach.nguyen@vietjetair.com)
Created: 2026-07-28
Authority: Operational handoff for the one remaining Production Recovery gap. Complements `.ai/HANDOFF.md` (WS1) and `docs/analysis/reliability-loop-2026-07-03/OPERATION_RUNBOOK.md`.

---

## 1. One-line summary

The World Cup **structure** (Groups, Standings, Fixtures, Bracket, hub) is fully restored in production by code (recovery items A0–A4). The only outstanding gap is **live data** — real scores, results, and live standings stats. That data does not exist in our cache and **cannot be produced by code**; it requires restoring the external data providers, which only the owner can do.

## 2. Why this is a handoff (what AI cannot do)

The following are outside AI capability and/or prohibited by policy — they must be performed by the owner:

- Restoring or re-authenticating third-party **provider accounts** (api-football, football-data.org).
- Handling **API keys / credentials / secrets** or setting **environment variables**.
- Provider **billing / quota / subscription** changes.
- Vercel / Upstash **dashboard** actions (plan/quota).

Code cannot fabricate match results. Any "results" not sourced from a provider would be invented data — explicitly refused.

## 3. Confirmed root cause (evidence)

Live WC feeds are **empty** in production, so the authority cache (`goalradar:wc:authority:v1`) rebuilds with zero provider matches.

- **Provider outage (from `.ai/HANDOFF.md` + `reliability-loop-2026-07-03/ROOT_CAUSE_DECISION.md`):** api-football account **suspended** + football-data **403** → `RATE_SAFE` mode → orchestrator runs but all refresh tasks **no-op** → WC match/standings feeds never written to KV.
- **Confirmed live on 2026-07-28:** the A2 static-seed branch (which fires **only** when every provider feed is empty) is active in production — proving the feeds hold zero readable WC matches. The Fixtures page shows the bundled **static** 48-team draw (USA v France, Mexico v Spain…), not real provider data.
- **Possible compounding factor:** Vercel KV (Upstash) request quota exhausted (`ERR max requests limit exceeded. Limit: 500000`) — may block feed reads/writes and DR. Observed against the shared instance; not independently confirmed for the production database (no KV access from the engineering side).

Distinguishing "provider down" vs "KV quota" requires reading production KV / the `CRON_SECRET`-gated debug endpoints — not available to the engineering (AI) side.

## 4. What code already did (no owner action required)

All live and verified in production (`origin/main`):

| Item | Commit | Effect |
|---|---|---|
| A0 | `99b9ee5` | `WC_ALL_TEAMS` roster corrected — Groups/Standings show correct 12×4, no phantom teams |
| A1 | `f351e4b` | Malformed live standings tables (≠4 teams) rejected → static skeleton |
| A2 | `0eacb96` | Authority cache **seeded from static structure** when provider feeds empty → Fixtures/Bracket/hub stay populated |
| A3 | `28ea945` | Bracket tree page-level static fallback |
| A4 | `9e8147e` | CI data-integrity guard test |

Net: the outage is now **graceful** — structural pages render the canonical schedule instead of blank/placeholder. **Results correctly stays empty** (no fabrication).

## 5. Owner recovery steps

1. **api-football** (dashboard.api-football.com): check the suspension reason (quota / billing / ToS); restore the account. Confirm `API_FOOTBALL_KEY` is valid.
2. **football-data.org**: resolve the **403** (key validity, plan/tier, rate limits); confirm access to the World Cup competition. Confirm `FOOTBALL_API_KEY`.
3. **Vercel KV (Upstash)**: check the request-quota status; upgrade the plan or wait for the reset window; confirm `KV_REST_API_URL` / `KV_REST_API_TOKEN`.
4. **Env sanity** (Vercel project `goalradar-v2`): `FOOTBALL_API_KEY`, `API_FOOTBALL_KEY`, `ENABLE_API_FOOTBALL` (must not be `false`), `CRON_SECRET` present.
5. **Repopulate feeds → authority cache** (with `CRON_SECRET`):
   - `POST /api/cron/orchestrator` (full refresh), or targeted:
   - `POST /api/refresh/wc-fixtures` and `POST /api/refresh/standings`.
   - Follow `docs/analysis/reliability-loop-2026-07-03/OPERATION_RUNBOOK.md` for the exact runbook.

## 6. Verification (owner — proves live data restored)

- `GET /api/debug/authority-freshness?secret=$CRON_SECRET` → `source: "primary"`, `matchCount ≈ 104`, `stale: false`.
- Logs: **`[RATE_SAFE]` disappears**; `[Authority] REBUILT` shows matches from the provider; **`[Authority] STATIC-SEED` line disappears** (feeds non-empty → A2 dormant).
- Production pages:
  - `/world-cup-2026/results` → shows real full-time scores (no longer "No results yet").
  - `/world-cup-2026-standings` → real P/W/D/L/points (not all zeros).
  - `/world-cup-2026/fixtures` → real matches with team crests and **linkable** match pages (static seed uses non-linkable negative ids).

## 7. Safety / rollback

- **No code rollback needed.** A0–A2 guards are self-yielding: A2's seed is skipped the moment provider feeds return data; A1 only rejects malformed tables. Provider recovery cannot conflict with them.
- If recovery introduces bad provider data (e.g. a malformed standings snapshot), A1 already rejects it and A2 already backstops emptiness — the structure stays correct.

## 8. Cross-references

- `.ai/HANDOFF.md` — WS1 (operational recovery) / WS2 (engineering hardening).
- `docs/analysis/reliability-loop-2026-07-03/` — `OPERATION_RUNBOOK.md`, `ROOT_CAUSE_DECISION.md`, `PRODUCTION_RUNTIME_EVIDENCE.md`, `NEXT_IMPLEMENTATION.md`.
- Recovery-program classification & backlog: this session's Production Recovery report (A0–A5, Workstream A).

## 9. Status ledger

- Code side (A0–A4): **COMPLETE + verified live**.
- Live data (WS1): **BLOCKED on owner** — provider + KV restoration.
- WS2 (systemic hardening: shared rate limiter, circuit breaker, enrichment throttle) and Architecture Modernization (Workstream B): **deferred**, out of scope for this recovery.
