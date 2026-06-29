# DATA-18J.2 Phase 2 — Writer Attribution

Date: 2026-06-17  **AUDIT ONLY.**

## Attribution: **`seedMatch` (orchestrator prewarm, src/lib/prewarm/worldcup.ts)** — all 5 matches.

Method: structural + temporal fingerprinting against the writer matrix (DATA18J1). Per-execution
server logs are not exposed via available tooling, so attribution rests on KV metadata that each
writer leaves behind — which is decisive here.

---

## Discriminating signals

| Signal | buildSnapshot | prewarmMatchSnapshotKVOnly | seedMatch | repair |
|--------|--------------|----------------------------|-----------|--------|
| Writes **detail key** `goalradar:/matches/{id}` | no (reads) | no (reads) | **YES (337)** | no (deletes snap) |
| Writes **snapshot key** | yes (676) | yes (561) | **YES (380)** | deletes |
| detail age == snapshot age? | no | no | **YES (same op)** | n/a |
| Batch (many matches one pass)? | no (per visit) | no (per hover) | **YES (loop)** | yes (but deletes) |
| Enriches via ESPN? | yes | no | **no (AF only)** | n/a |
| Goes through downgrade guard? | yes | yes | **no (raw kv.set)** | n/a |
| Can leave primary goals=0 when DR has goals>0? | no (rescued) | no (rescued) | **YES (guard bypassed)** | n/a |

---

## Observed in production (all 5 matches)

- `detailAge == snapshotAge` (both **37.9 min**) → **same writer wrote both keys** → only `seedMatch` does this.
- All 5 share the **same 37.9-min age** → **single batch pass** → only `seedMatch`/`prewarmWorldCup` loops the WC list.
- `snapGoals = 0` while ESPN cache (≈14 h old) holds goals → writer **did not use ESPN** → excludes `buildSnapshot`.
- Snapshot goals=0 persists despite an enriched DR almost certainly present (written by the 14h-ago buildSnapshot; DR is never deleted by any path) → the writer **bypassed the DR-rescue guard** → only `seedMatch`'s raw `kv.set` qualifies.

Each signal independently points away from the other writers; together they converge on `seedMatch`.

---

## Per-match attribution

| Match | Writer | Basis |
|-------|--------|-------|
| 537328 | **seedMatch** | detail==snap age 37.9m; batch-aligned; goals=0 vs ESPN=3; guard-bypass required |
| 537351 | **seedMatch** | detail==snap age 37.9m; batch-aligned; goals=0 vs ESPN=8 |
| 537391 | **seedMatch** | detail==snap age 37.9m; batch-aligned; goals=0 vs ESPN=4 |
| 537392 | **seedMatch** | detail==snap age 37.9–38.0m; batch-aligned; goals=0 vs ESPN=5 |
| 537397 | **seedMatch** | detail==snap age 37.9–38.0m; batch-aligned; goals=0 vs ESPN=3 |

No match is attributable to `buildSnapshot`, `prewarmMatchSnapshotKVOnly`, or `repair`.
