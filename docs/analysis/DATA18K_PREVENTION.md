# DATA-18K Phase 1 — Prevent New Corruption

Date: 2026-06-18  Status: **implemented** (not yet deployed)

## Root cause being fixed
`seedMatch` (orchestrator prewarm) wrote `goalradar:match:{id}` via a **raw `kv.set`** that bypassed
`writeKVSnapshot()`'s downgrade guard, with **AF-only** enrichment. On AF lookup-miss it persisted
`goals=0`, overwriting/standing in for the enriched snapshot. (Proven in DATA-18J.2, 96–97%.)

---

## Change — route prewarm writes through the guarded writers

File: `src/lib/prewarm/worldcup.ts`

### 1. Export + import the guards
- `src/lib/match-snapshot.ts`: `writeKVSnapshot` and `writeDRSnapshot` are now `export`ed.
- `worldcup.ts`: `import { writeKVSnapshot, writeDRSnapshot } from '@/lib/match-snapshot';`

### 2. `seedMatch` (the proven culprit)
Before:
```ts
const kvWrites = [ kv.set(snapshotKey(match.id), snap, { ex: snapshotTtlSec }) ];   // RAW, bypasses guard
if (!isUnenriched) kvWrites.push(kv.set(snapshotDRKey(match.id), snap, …));
await Promise.all(kvWrites);
```
After:
```ts
if (isUnenriched) console.warn(`[Prewarm] FIRST_BUILD_UNENRICHED match:${match.id} …`);
await writeKVSnapshot(String(match.id), snap);   // downgrade guard: rescues from enriched DR
writeDRSnapshot(String(match.id), snap);         // poison guard: refuses goals=0 DR
```

### 3. Priority-refresh block (second raw write site)
The two raw snapshot `kv.set` calls (primary + DR) were likewise replaced by
`writeKVSnapshot(String(pm.id), psnap)` + `writeDRSnapshot(String(pm.id), psnap)`. Detail-key writes
stay raw (they are not the enrichment surface).

### 4. Cleanup
Removed now-unused `SNAPSHOT_STALE_SEC`, `SNAPSHOT_DR_TTL_SEC`, `snapshotDRKey`, and the local
`snapshotTtlSec` (TTL is now owned by `getSnapshotTtlSec` inside `writeKVSnapshot`).

---

## Why this prevents new corruption

`writeKVSnapshot`'s downgrade guard (match-snapshot.ts:275-289): when asked to write a FINISHED
scored snapshot with `goals=0`, it reads the DR copy; if DR has `goals>0` it **writes the enriched DR
copy instead**. So an AF-only/unenriched prewarm build can **no longer overwrite or stand in for** an
enriched primary. `writeDRSnapshot`'s poison guard prevents a `goals=0` DR from ever being stored.

Net: even with the AF lookup table absent, the prewarm path can no longer pin `goals=0` whenever an
enriched DR exists — the exact failure mode from DATA-18J.

---

## Blast radius
- Touched: `prewarm/worldcup.ts` (writer), `match-snapshot.ts` (export-only on 2 functions + Phase-2 reader change).
- **Not touched:** Authority Cache, CanonicalMatch, listing pages, WC hub, enrichment functions.
- Behavior change limited to *how* prewarm persists snapshots (guarded vs raw). No interface changes.

## Verification
- `tsc --noEmit`: clean.
- Match route compiles and renders in dev (no build/runtime error introduced).
- Runtime guard behavior requires production KV → see DATA18K_PRODUCTION_VALIDATION.md.
