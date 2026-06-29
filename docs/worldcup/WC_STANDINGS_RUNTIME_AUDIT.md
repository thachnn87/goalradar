# WC_STANDINGS_RUNTIME_AUDIT — DATA-18WC.4

**Date:** 2026-06-23
**Method:** Production probe via `/api/debug/standings-audit`

---

## KV entry status at audit time

| Field | Value |
|-------|-------|
| Key | `goalradar:/competitions/WC/standings` |
| Exists | ✅ YES |
| Fetched at | 2026-06-23T06:10:25.816Z |
| Fresh until | 2026-06-23T07:10:25.816Z |
| TTL remaining | 4635 s (~77 min) |
| Is fresh | ✅ YES |
| DR key exists | ❌ NO (not yet written — DR written only by `withKVCache`, not `refreshEndpoint`) |

**The KV entry existed and was fresh.** The orchestrator is running correctly and writing standings. The bug was entirely in the read/merge path.

---

## Raw group keys from football-data.org

API returns `type: "TOTAL"`, `stage: "ALL"`, `group: "Group X"` format:

| API group key | Actual teams (lead) | P | PTS |
|---------------|---------------------|---|-----|
| `"Group A"` | Mexico | 2 | 6 |
| `"Group B"` | Canada | 2 | 4 |
| `"Group C"` | Brazil | 2 | 4 |
| `"Group D"` | United States | 2 | 6 |
| `"Group E"` | Germany | 2 | 6 |
| `"Group F"` | Netherlands | 2 | 4 |
| `"Group G"` | Egypt | 2 | 4 |
| `"Group H"` | Spain | 2 | 4 |
| `"Group I"` | France | 2 | 6 |
| `"Group J"` | Argentina | 2 | 6 |
| `"Group K"` | Colombia | 1 | 3 |
| `"Group L"` | England | 1 | 3 |

Live data is **real and correct** — 43 matches played, 123 goals, real P/W/D/L/PTS.

---

## Merge diagnostic (pre-fix)

| Static key | API key in map | liveFound | Source |
|------------|---------------|-----------|--------|
| `GROUP_A` | (not in map) | ❌ | STATIC |
| `GROUP_B` | (not in map) | ❌ | STATIC |
| … ×12 | — | ❌ | STATIC |

Map contained keys `"Group A"`…`"Group L"` but lookup used `"GROUP_A"`…`"GROUP_L"`.
**100% miss rate** → every group served static seed data → P=0, PTS=0.

---

## Merge diagnostic (post-fix)

After normalizing `"Group A"` → `"GROUP_A"` in the map key:

| Static key | Normalized API key | liveFound | Source |
|------------|-------------------|-----------|--------|
| `GROUP_A` | `GROUP_A` | ✅ | LIVE |
| `GROUP_B` | `GROUP_B` | ✅ | LIVE |
| … ×12 | `GROUP_A`…`GROUP_L` | ✅ | LIVE |

Expected verdict post-deploy: `KV_FULL — all 12 groups from live data`.

---

## Match counts comparison

| Metric | API data | Standings (pre-fix) | Standings (post-fix) |
|--------|----------|---------------------|----------------------|
| Matches played | 43 | 0 (fake) | ≥1 for all active groups |
| Goals scored | 123 | 0 (fake) | real |
| Mexico PTS | 6 | 0 | 6 |
| France PTS | 6 | 0 | 6 |
| Argentina PTS | 6 | 0 | 6 |
| Spain PTS | 4 | 0 | 4 |
| Brazil PTS | 4 | 0 | 4 |
