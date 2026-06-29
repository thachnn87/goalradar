# DATA-18J.1 Phase 1 — buildSnapshot() Line-by-Line Trace (537328)

Date: 2026-06-17  **AUDIT ONLY.**

Simulated input: FD detail (FINISHED, 2–1, `competition.code='WC'`, `goals=[]`) + ESPN event cache present (`goalradar:espn:event:537328` = 3 goals/1 card/9 subs).

---

## A. The `getOrBuildMatchSnapshot` → `buildSnapshot` path (page-render path)

`src/lib/match-snapshot.ts`

| Step | Line | Code | State of `match.goals` |
|------|------|------|------------------------|
| read detail | 390 | `readMatchDetailFromKV` → FD detail | **0** |
| guard | 404-407 | `needsEnrichment = FINISHED && code==='WC' && goals===0` | → **true** |
| AF enrich | 409-411 | `enrichMatchWithAFEvents(match)` → AF lookup-miss → unchanged | **0** |
| **ESPN enrich** | 414-416 | `needsEnrichment && ESPN_ENABLED && goals===0` → `enrichMatchWithEspnEvents(match)` → ESPN cache HIT | **3** ✅ |
| assemble | 446 | `assembleSnapshot` → `snapshot.match.goals = 3` | **3** |
| write | 676 | `writeKVSnapshot(id, snapshot)` (goals=3) | persists **3** |
| DR | 677 | `writeDRSnapshot` (goals=3, not poison) | DR **3** |

**Conclusion:** *If the page-render path (`buildSnapshot`) runs, it correctly enriches to goals=3.* This path is **NOT** the failure. (Proof: the ESPN event cache is populated — and `enrichMatchWithEspnEvents`'s fresh-fetch is reachable **only** from `buildSnapshot:415` under `needsEnrichment`. So this path demonstrably ran successfully at least once ~14 h ago, writing goals=3 to both primary and DR.)

---

## B. The orchestrator prewarm path — `seedMatch` (the failing writer)

`src/lib/prewarm/worldcup.ts` (invoked by `prewarmWorldCup()` → `/api/cron/orchestrator:219` and `/api/cron/prewarm-worldcup`)

| Step | Line | Code | State |
|------|------|------|-------|
| FINISHED reseed guard | 293-295 | `if (tier==='finished' && existingSnapshot) return skip` | only proceeds when **snapshot MISSING** |
| build detail | 320 | `toMatchDetail(match)` (from bulk WC list) | goals=0 |
| **AF-only enrich** | 349-359 | `if (tier==='finished' && ENABLE_AF_ENRICHMENT==='true' && score>0) enrichMatchWithAFEvents(...)` — **no ESPN call** | AF lookup-miss → **0** |
| partial snapshot | 361 | `buildPartialSnapshot(matchDetailForSnap, …)` | goals **0** |
| detect | 366-369 | `isUnenriched = finished && score>0 && goals===0` | → **true** |
| **write primary (raw)** | 379-381 | `kv.set(snapshotKey(id), snap, { ex })` — **direct kv.set, bypasses `writeKVSnapshot()` and its downgrade guard** | primary ← **0** |
| skip DR | 382-389 | `isUnenriched` → push DR write skipped (`SKIP-DR`) | DR untouched |

**before write:** prior enriched primary already evicted/invalidated (slot empty) → guard at 293 lets it through.
**after write:** `goalradar:match:537328` = goals **0**, FINISHED, 7-day-tier TTL.

---

## Side-by-side: the two writers

| | buildSnapshot (render path) | seedMatch (orchestrator prewarm) |
|--|----------------------------|----------------------------------|
| AF enrichment | yes (409) | yes (354) |
| **ESPN enrichment** | **yes (415)** | **NO** |
| writes via | `writeKVSnapshot()` (downgrade guard) | **raw `kv.set` (380) — guard bypassed** |
| result for 537328 | goals **3** | goals **0** |
| runs on | sporadic page visits | **orchestrator cron, scheduled** |

The scheduled, AF-only, guard-bypassing writer wins the race to re-create an evicted FINISHED snapshot, and writes goals=0. See Phase 3 (writer matrix) and Phase 4 (root cause).
