# DATA-18D.1 Phase 1 — Remove Remaining Hardcoded Match Lists
## Audit and Migration Status

Audited: 2026-06-17

---

## All Hardcoded Match ID Arrays Found

| File | Variable | Count | Type | Action |
|------|----------|-------|------|--------|
| `src/app/api/debug/authority-compare/route.ts` | `BENCHMARK_IDS` | 4 | Benchmark gate IDs | **Updated** — added `?scope=all` dynamic mode |
| `src/app/api/debug/data18d-stability/route.ts` | `BENCHMARK_IDS` | 4 | Monitoring checkpoints | **Kept** — intentional (see below) |
| `src/app/api/debug/data18c2-bulk-repair/route.ts` | `POISONED_IDS` | 18 | Historical one-time repair | **Kept** — historical artifact |
| `src/app/api/debug/data18c1-repair-test/route.ts` | `ALLOWED_IDS` | 3 | Safety allowlist | **Kept** — historical artifact |

---

## Changes Made

### authority-compare — `?scope=all` mode added

**Before:** Fixed to `BENCHMARK_IDS = [537397, 537392, 537391, 537351]`

**After:** Supports two modes:
- **Default** (`/api/debug/authority-compare`): 4 hardcoded benchmarks — backward compatible with DATA-18C.2 gate
- **`?scope=all`** (`/api/debug/authority-compare?scope=all`): reads `goalradar:/competitions/WC/matches?status=FINISHED` KV feed dynamically, checks ALL FINISHED matches

The `?scope=all` mode auto-grows as new WC matches finish. No code change needed after each match day. Returns per-match GREEN/RED plus `feedAgeHours` for feed freshness.

---

## Kept Hardcoded Lists (Justified)

### `BENCHMARK_IDS` in data18d-stability (4 IDs)

These 4 matches (Germany 7–1, France 3–1, Norway 3–2, Argentina 3–0) are the highest-goal-count benchmark matches validated during DATA-18C.2. Their selection is deliberate: they exercise the widest range of enrichment data (goals 3–8 each). Swapping them for random feed entries would reduce the monitoring signal.

The stability endpoint is a fast 24h monitoring check, not a full audit. The full dynamic check is handled by `/api/debug/data18d1-integrity-audit` (Phase 3).

### `POISONED_IDS` in data18c2-bulk-repair (18 IDs)

This is a historical one-time repair endpoint for the DATA-18C.2 incident. The 18 IDs ARE the poisoned matches — the list is definitionally correct and should not change. This endpoint serves as the incident repair record, not an ongoing tool.

### `ALLOWED_IDS` in data18c1-repair-test (3 IDs)

Safety allowlist for the DATA-18C.1 single-match rebuild test endpoint. This was a controlled experiment during validation, not an ongoing tool. The 3 IDs are the benchmark matches that were tested first. No change required.

---

## Dynamic Feed Inventory (All Current Uses)

| Endpoint / Cron | KV Key | Status |
|-----------------|--------|--------|
| `enrichment-health` | `goalradar:/competitions/WC/matches?status=FINISHED` | Dynamic ✓ |
| `repair-enrichment` | `goalradar:/competitions/WC/matches?status=FINISHED` | Dynamic ✓ (DATA-18D) |
| `authority-compare?scope=all` | `goalradar:/competitions/WC/matches?status=FINISHED` | Dynamic ✓ (DATA-18D.1) |
| `data18d1-integrity-audit` | `goalradar:/competitions/WC/matches?status=FINISHED` | Dynamic ✓ (DATA-18D.1) |
| `integrity-repair` | `goalradar:/competitions/WC/matches?status=FINISHED` | Dynamic ✓ (DATA-18D.1) |
| `data18d-stability` | Hardcoded 4 IDs | Kept (intentional) |

---

## Verdict

**Phase 1 complete.** The only remaining hardcoded lists are justified:
- 4 benchmark IDs in stability endpoint (intentional, highest-value monitoring matches)
- 18 IDs in historical bulk-repair endpoint (incident record, not ongoing tool)
- 3 IDs in historical repair-test endpoint (controlled experiment, not ongoing tool)

All operational endpoints that scan FINISHED matches now use the dynamic FINISHED KV feed.
