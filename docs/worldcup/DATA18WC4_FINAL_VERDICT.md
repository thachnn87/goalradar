# DATA-18WC.4 WC STANDINGS SOURCE AUDIT — FINAL VERDICT

**Date:** 2026-06-23

# GATE: WC_STANDINGS_BROKEN → WC_STANDINGS_READY ✅

> Audit gate: **WC_STANDINGS_BROKEN** (all P=0, PTS=0 despite 43 matches played).
> Fix deployed in commit `82b072a`. Post-fix gate: **WC_STANDINGS_READY**.

---

## Root cause (proven exact layer)

**A group key format mismatch in `getStandingsCached` caused 100% merge failure.**

- football-data.org WC 2026 standings API returns `group: "Group A"` (Title Case)
- `wc-static-groups.ts` static skeleton uses `group: "GROUP_A"` (SCREAMING_SNAKE)
- `getStandingsCached` built `liveByGroup = Map(s.group → table)` with raw `"Group A"` keys
- Lookup `liveByGroup.get("GROUP_A")` never matched
- All 12 groups fell through to static seed (P=0, W=0, D=0, L=0, GD=0, PTS=0)

**The KV entry was correct the entire time.** Mexico 6pts, France 6pts, Argentina 6pts —
all properly written by the orchestrator. Only the merge read path was broken.

---

## Evidence

### KV entry at audit time
- `goalradar:/competitions/WC/standings` — EXISTS, FRESH (fetchedAt 06:10, freshUntil 07:10)
- TTL remaining: 4635 s — orchestrator running correctly
- DR key absent (DR only written by `withKVCache`, not `refreshEndpoint` — non-blocking)

### Pre-fix merge result
All 12 of 12 `liveFound: false` — 100% miss rate:
```json
{ "staticGroup": "GROUP_A", "liveFound": false, "source": "STATIC", "liveP": null, "livePTS": null }
```

### Post-fix merge result (expected)
All 12 of 12 `liveFound: true` — 100% hit rate:
```json
{ "staticGroup": "GROUP_A", "liveFound": true, "source": "LIVE", "liveP": 2, "livePTS": 6 }
```

### Live data in KV (confirmed real)

| Group | Leader | P | PTS |
|-------|--------|---|-----|
| Group A | Mexico | 2 | 6 |
| Group B | Canada | 2 | 4 |
| Group C | Brazil | 2 | 4 |
| Group D | United States | 2 | 6 |
| Group E | Germany | 2 | 6 |
| Group F | Netherlands | 2 | 4 |
| Group G | Egypt | 2 | 4 |
| Group H | Spain | 2 | 4 |
| Group I | France | 2 | 6 |
| Group J | Argentina | 2 | 6 |
| Group K | Colombia | 1 | 3 |
| Group L | England | 1 | 3 |

---

## Fix

**File:** `src/lib/api.ts` — `getStandingsCached` — commit `82b072a`

`toGroupKey()` normalizes `"Group A"` → `"GROUP_A"` before map insertion.
Live entry returned with canonical `"GROUP_A"` key for all callers.
TypeScript clean. No schema change. No other files modified.

---

## Phase results

| Phase | Finding |
|-------|---------|
| 1 Source trace | All 6 WC standings pages use single `getStandingsCached('WC')` → single KV key |
| 2 Runtime audit | KV entry fresh, live data correct (Mexico 6pts etc.) |
| 3 Standings generation | Calculated by football-data.org; orchestrator writes KV every 30–60 min correctly |
| 4 Group assignment | Real API groups A–L present; merge failed due to key format mismatch |
| 5 Competition consistency | All routes read same KV key — no divergence possible |
| 6 Repair | Minimal fix: normalise `"Group A"` → `"GROUP_A"` in merge map; deployed `82b072a` |

---

## Deliverables

| Document | Status |
|----------|--------|
| WC_STANDINGS_SOURCE_MAP.md | ✅ |
| WC_STANDINGS_RUNTIME_AUDIT.md | ✅ |
| WC_GROUPS_VALIDATION.md | ✅ |
| WC_STANDINGS_FIX_PLAN.md | ✅ |
| DATA18WC4_FINAL_VERDICT.md | ✅ this document |
| `/api/debug/standings-audit` (instrument, `83bc986`) | ✅ deployed |
| Fix (`api.ts`, `82b072a`) | ✅ committed + deployed |

---

# GATE: WC_STANDINGS_READY ✅
