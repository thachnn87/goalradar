# DATA-18J.1 Phase 4 — Exact Failing Branch

Date: 2026-06-17  **AUDIT ONLY.**

## Verdict: **E — another writer overwrites/persists the snapshot afterwards**

The writer is the **orchestrator prewarm `seedMatch`** in `src/lib/prewarm/worldcup.ts`, which
re-creates the FINISHED snapshot using **AF-only enrichment** and a **raw `kv.set` that bypasses the
downgrade guard**, persisting `goals=0` — while the ESPN-capable `buildSnapshot` writer never runs
again because of the KV-hit short-circuit.

Options A–D are disproven by code below.

---

## Code evidence

### Why NOT A (needsEnrichment never entered) — on the render path it IS entered
`buildSnapshot` (match-snapshot.ts:404-407): for 537328 `FINISHED && code==='WC' && goals===0` ⇒ `needsEnrichment = true`. **Proof it entered and succeeded:** `enrichMatchWithEspnEvents` is called only from `buildSnapshot:415` under `needsEnrichment`, and the ESPN event cache for 537328 **is populated** (goals=3) — which only happens via that call's fresh-fetch. So the guard was entered and ESPN ran. (The prewarm writer has *no* `needsEnrichment` block at all — but it is a different writer, which is option E.)

### Why NOT B (enrichMatchWithEspnEvents returns unchanged)
espn-id-map.ts cache-hit path → `applyEspnEvents` returns goals=3 (Phase 2). Production `espn-enrichment/537328` shows `eventCacheHit:true, goals:3`. It enriches; it does not return unchanged.

### Why NOT C (enriched match produced but writeKVSnapshot gets original object)
`buildSnapshot` reassigns `match = await enrichMatchWithEspnEvents(match)` (415) and passes that same `match` to `assembleSnapshot` (446) → `snapshot.match` (500-501) → `writeKVSnapshot(matchId, snapshot)` (676). Same object reference; no original leaks through.

### Why NOT D (writeKVSnapshot persists wrong object)
`writeKVSnapshot` writes exactly `snapshot` it is given (`kv.set(kvKey(matchId), snapshot, …)`, 293). No mutation/substitution. (And in production the failing writer never calls `writeKVSnapshot` at all.)

### Why E is correct (proven)
`src/lib/prewarm/worldcup.ts`, `seedMatch`:

```ts
349   if (tier === 'finished' && process.env.ENABLE_AF_ENRICHMENT === 'true') {
350     const ftH = matchDetail.score?.fullTime?.home ?? 0;
351     const ftA = matchDetail.score?.fullTime?.away ?? 0;
352     if (ftH + ftA > 0) {
353       try {
354         matchDetailForSnap = await enrichMatchWithAFEvents(matchDetail);   // ← AF ONLY. No ESPN.
355       } catch { /* best-effort */ }
356     }
357   }
...
361   const snap = buildPartialSnapshot(matchDetailForSnap, allMatches, standings);  // goals=0 (AF lookup-miss)
...
379   const kvWrites = [
380     kv.set(snapshotKey(match.id), snap, { ex: snapshotTtlSec }),   // ← RAW write to goalradar:match:{id}
381   ];                                                              //   bypasses writeKVSnapshot() + downgrade guard
```

- AF enrichment is the **only** enrichment attempted; production AF lookup table is **absent** ⇒ `enrichMatchWithAFEvents` returns the match unchanged ⇒ `snap.match.goals = 0`.
- `isUnenriched` (366-369) is **true**; the code logs `FIRST_BUILD_UNENRICHED` (372) and `SKIP-DR` (386) — correctly refusing the DR write — **but still writes the unenriched primary** at line 380.
- Line 380 is a **direct `kv.set`**, so the DATA-16 downgrade guard in `writeKVSnapshot` (match-snapshot.ts:275-289) — which would have read DR (goals=3) and rescued — **never executes**.
- Reseed guard (293): once written, every later prewarm sees an existing FINISHED snapshot and **skips**, so goals=0 is never revisited by this writer.
- Read short-circuit: `getOrBuildMatchSnapshot` returns the KV hit verbatim (match-snapshot.ts:607-612) — the ESPN-capable `buildSnapshot` writer **never runs again**, so the goals=0 is pinned for the 7-day FINISHED TTL.

This is invoked in production: `prewarmWorldCup()` ← `/api/cron/orchestrator:219` and `/api/cron/prewarm-worldcup`.

---

## One-sentence root cause

The scheduled orchestrator prewarm (`seedMatch`, worldcup.ts:354+380) re-creates evicted FINISHED
snapshots with **AF-only** enrichment and writes them via a **raw `kv.set` that bypasses the downgrade
guard**; with AF's lookup table absent it persists `goals=0`, and because `getOrBuildMatchSnapshot`
never re-enriches on a KV hit, the already-cached ESPN events (goals=3) are never merged in.
