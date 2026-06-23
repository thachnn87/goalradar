# TEAM COVERAGE AUDIT — DATA-18TEAM.1B Phase 3

**Task:** DATA-18TEAM.1B Phase 3
**Date:** 2026-06-23

---

## Coverage

| Metric | Value | Basis |
|--------|-------|-------|
| Teams in standings (WC) | **48** | 12 groups × 4 (football-data WC standings, HTTP 200) |
| Teams cached (`goalradar:/teams/{id}` present) | **0** | no deployed writer; every probed team renders null |
| Coverage | **0%** | — |

> Multi-competition note: the deployed orchestrator refreshes standings for the
> WC plus a handful of league codes, so the full extractor set (`extractTeamIdsFromStandings`
> CODES = WC, PL, PD, BL1, SA, FL1, CL) would target more than 48 once deployed.
> Regardless of the exact denominator, the cached count is **0**, so coverage is
> **0%** for every competition.

---

## Classification

| Class | Count | Notes |
|-------|-------|-------|
| **Missing** (in standings, no KV entry) | **ALL** (≈48 WC + league teams) | nothing writes team KV in deployed code |
| **Stale** (KV entry past fresh, not refreshed) | 0 | n/a — no entries exist to be stale |
| **Orphaned** (KV entry for a team not in standings) | 0 | n/a — no entries exist |

There are no stale or orphaned entries because **no team KV entries exist at all**.
This is a total cold-cache condition, not partial coverage decay.

---

## Why coverage is exactly 0 (not merely low)

Coverage decay (e.g. 24h TTL outpacing a 25-team/run warmer) would produce
*partial* coverage — some teams cached, some expired. The observed state is
**zero** cached across all sampled teams. That is only possible if **no writer
ever runs**, which matches the deployed orchestrator having no team-warming phase
(TEAM_WARMING_AUDIT.md) and the deployed reader having no provider-fallback write
(TEAM_SOURCE_MAP.md).

---

## Evidence basis

Direct per-team KV enumeration was unavailable (`/api/debug/kv` needs `ADMIN_SECRET`;
the `/api/debug/team-cache` coverage probe is built but undeployed). Coverage = 0%
is established by: (a) deployed `getTeamCached` is KV-read-only, and (b) all sampled
team pages render null → their KV keys are empty. A representative sample (Argentina,
France, Brazil, Spain, Germany) is 0/5; combined with the absence of any writer, the
population coverage is 0%.

**Phase 3 complete. Coverage 0% — total cold cache, no stale/orphaned entries.**
