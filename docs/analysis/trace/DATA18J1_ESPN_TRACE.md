# DATA-18J.1 Phase 2 — enrichMatchWithEspnEvents() Inspection

Date: 2026-06-17  **AUDIT ONLY.**

`src/lib/espn-id-map.ts` — `enrichMatchWithEspnEvents()` (lines 226-286), `applyEspnEvents()` (≈319).

---

## Input / output (537328, ESPN cache present)

| | value |
|--|--|
| input `match.goals.length` | **0** |
| ESPN event cache (`goalradar:espn:event:537328`) | goals **3**, cards **1**, subs **9** (age ~14 h) |
| code path taken | **cache-hit** (`kv.get(eventKey)` returns cached) |
| `applyEspnEvents` merges | `goals=3, bookings=1, substitutions=9, lineups` |
| output `match.goals.length` | **3** |

**Verified:** when called, `enrichMatchWithEspnEvents` returns an enriched match (goals 0 → 3). It does **not** return unchanged. → Phase 4 option **B is FALSE.**

---

## Guard / early-return checklist

| Guard | Location | Evaluates (537328) | Effect |
|-------|----------|--------------------|--------|
| `needsEnrichment` (FINISHED && code==='WC' && goals===0) | match-snapshot.ts:404 | **true** | enrichment block entered (render path) |
| `ESPN_ENRICHMENT_ENABLED` (`ENABLE_ESPN_ENRICHMENT!=='false' && KV`) | espn-id-map.ts:35 | **true** (prod `enrichmentEnabled:true`) | ESPN allowed |
| ESPN gate in buildSnapshot (`&& goals===0`) | match-snapshot.ts:414 | **true** (AF left it 0) | `enrichMatchWithEspnEvents` called |
| lookup cache | espn-id-map.ts:~233 | **hit** | espnId resolved (no negative cache) |
| **event cache hit** | espn-id-map.ts:~236 | **HIT (goals=3)** | `applyEspnEvents` → goals=3 |

Every ESPN guard passes and the merge succeeds — **on the render path**.

---

## The crucial asymmetry

`enrichMatchWithEspnEvents` is called from **exactly one place**:

```
src/lib/match-snapshot.ts:415   (inside buildSnapshot, under needsEnrichment)
```

`git grep enrichMatchWithEspnEvents` → only `buildSnapshot` calls it.

➡ **The orchestrator prewarm (`seedMatch`) never calls ESPN enrichment at all** — it calls only `enrichMatchWithAFEvents` (worldcup.ts:354). So whenever `seedMatch` is the writer, ESPN's working cache-hit path is never reached, and the snapshot is written goals=0.

**Conclusion:** ESPN enrichment is healthy and merges correctly. The failure is that the writer which actually (re)persists the live snapshot — the orchestrator prewarm — does not invoke it. The ESPN events sit in cache, retrievable, but the persisting writer never asks for them.
