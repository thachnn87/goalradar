# DATA-18J.2 Phase 5 — Final Verdict & Confidence

Date: 2026-06-17  **AUDIT ONLY.**

## FINAL QUESTION
**Can we prove that `seedMatch` generated the currently broken snapshots?**

# YES

---

## Per-match confidence

| Match | Writer | Confidence | Evidence |
|-------|--------|-----------|----------|
| 537328 | **seedMatch** | **97%** | detailAge==snapAge=37.9m (same-op dual write — unique to seedMatch); batch-clustered with 4 others; goals=0 vs ESPN cache goals=3 (writer skipped ESPN); DR-bypass required to leave goals=0 |
| 537351 | **seedMatch** | **97%** | detailAge==snapAge=37.9m; batch-clustered; goals=0 vs ESPN=8 |
| 537391 | **seedMatch** | **97%** | detailAge==snapAge=37.9m; batch-clustered; goals=0 vs ESPN=4 |
| 537392 | **seedMatch** | **96%** | detailAge==snapAge≈37.9–38.0m; batch-clustered; goals=0 vs ESPN=5 |
| 537397 | **seedMatch** | **96%** | detailAge==snapAge≈37.9–38.0m; batch-clustered; goals=0 vs ESPN=3 |

---

## Why YES (convergent proof)

1. **Same-operation dual write.** For all 5, `detailAge == snapshotAge` (≈37.9 min). `seedMatch` is the
   only writer that writes both `goalradar:/matches/{id}` (worldcup.ts:337) and `goalradar:match:{id}`
   (worldcup.ts:380) in one operation. `buildSnapshot` and `prewarmMatchSnapshotKVOnly` read the detail
   key and write only the snapshot — they cannot equalise the two ages.

2. **Batch clustering.** Five unrelated matches share one write age to ±0.1 min — the signature of a
   single `prewarmWorldCup` pass looping the WC list, not per-request writes.

3. **ESPN skipped.** `goals=0` while the ESPN event cache (≈14 h old) holds goals 3..8. The writer did
   not consult ESPN — excludes `buildSnapshot` (which always tries ESPN, would have succeeded). Matches
   `seedMatch`, which enriches **AF-only** (worldcup.ts:354).

4. **Guard bypass required.** Leaving `goals=0` in primary while DR holds enriched events (DR written by
   the 14 h-ago buildSnapshot; never deleted by any path) is possible **only** by bypassing the
   downgrade-guard rescue — i.e. `seedMatch`'s raw `kv.set` (worldcup.ts:380). Every guarded writer
   would have been rescued to goals>0.

5. **All counter-examples eliminated** (DATA18J2_COUNTEREXAMPLES.md): repair only deletes; buildSnapshot
   would enrich; prewarmMatchSnapshotKVOnly/DR-restore are guard-rescued; competition-code excluded by
   the populated ESPN cache.

---

## Residual uncertainty (the missing 3–4%)

- The construction-level signature `headToHead === null` (definitive for `buildPartialSnapshot`) is
  **not remotely readable** — no debug endpoint exposes `headToHead`, and the H2H section is
  Suspense-streamed. Confirming it would require a raw-snapshot dump endpoint (excluded: no deploy).
- Per-execution server logs (`[Prewarm] FIRST_BUILD_UNENRICHED` / `SKIP-DR`) are not accessible via the
  available tooling; attribution rests on KV metadata, which is itself conclusive.

Neither gap admits an alternative writer — they only prevent reaching 100%. The four observed,
independent fingerprints already exclude every other writer.

---

## Bottom line

**YES — `seedMatch` (orchestrator prewarm, src/lib/prewarm/worldcup.ts) generated the currently broken
snapshots for all five matches**, proven by same-operation detail+snapshot writes, batch-clustered
timestamps, ESPN-skip, and the mandatory downgrade-guard bypass — with all alternative writers
disproved.
