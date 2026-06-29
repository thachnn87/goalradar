# DATA-18J.1 Phase 5 — Minimal Fix Proposal (DO NOT IMPLEMENT)

Date: 2026-06-17  **AUDIT ONLY — proposal only, no code changed.**

The failing branch is **E**: orchestrator prewarm `seedMatch` writes an AF-only, guard-bypassing
goals=0 snapshot that gets pinned. A minimal fix has three independent levers; **(1) is the smallest
and highest-leverage.** Any one of them stops the user-visible regression; doing (1)+(3) is the
recommended minimal set.

---

## Option 1 — Route prewarm writes through the downgrade guard (RECOMMENDED, smallest)

Stop the raw `kv.set` from bypassing the DR rescue. Reuse the existing guard.

| | |
|--|--|
| File | `src/lib/prewarm/worldcup.ts` |
| Function | `seedMatch` |
| Line range | 379-390 (primary snapshot write) |
| Change | Replace the raw `kv.set(snapshotKey(...), snap, …)` for the **primary** key with a call to the existing guarded writer (`writeKVSnapshot`, exported from match-snapshot.ts), or inline a pre-write DR check mirroring match-snapshot.ts:275-289. Keep the existing DR-skip logic. |
| Est. LOC | **~8-12** (1-line write swap + import; or ~10 lines inlined guard) |
| Effect | When AF-only build yields goals=0 and DR has goals>0, the enriched DR copy is written to primary instead of the goals=0 one — the pin can no longer form. |

> Note: `writeKVSnapshot` is currently module-private. Minimal exposure = add `export`, or add a tiny
> `writeGuardedSnapshot(id, snap)` wrapper. ~2 extra LOC in match-snapshot.ts.

---

## Option 2 — Add ESPN enrichment to prewarm (parity with buildSnapshot)

| | |
|--|--|
| File | `src/lib/prewarm/worldcup.ts` |
| Function | `seedMatch` |
| Line range | 349-359 |
| Change | After the AF attempt, if still `goals===0` and `ESPN_ENRICHMENT_ENABLED`, call `enrichMatchWithEspnEvents(matchDetailForSnap)` (mirrors match-snapshot.ts:414-416). |
| Est. LOC | **~6-8** (import + 4-line guarded call) |
| Effect | Prewarm produces goals=3 directly (ESPN cache hit), so the written snapshot is enriched at source. |

---

## Option 3 — Re-enrich on read when a pinned snapshot is unenriched

| | |
|--|--|
| File | `src/lib/match-snapshot.ts` |
| Function | `getOrBuildMatchSnapshot` (KV-hit branch) |
| Line range | 607-612 |
| Change | Before returning `kvHit`, if `match.status==='FINISHED' && score>0 && goals.length===0`, fall through to a (rate-limited) rebuild instead of returning as-is. Guard with a short cooldown KV key to avoid rebuild storms. |
| Est. LOC | **~10-15** |
| Effect | Self-heals any already-pinned goals=0 snapshot on the next page view (defense-in-depth; also fixes the existing 5 pinned matches without a manual purge). |

---

## Recommended minimal set

**Option 1 + Option 3** (~20-27 LOC total):
- Option 1 prevents new pins (prewarm can no longer bypass the DR rescue).
- Option 3 heals the snapshots already pinned today (537328, 537351, 537391, 537392, 537397).

Option 2 is a good longer-term parity fix but is not required if 1+3 land.

---

## Out of scope / not proposed here
- Repairing the **absent AF lookup table** (separate AF-subsystem issue; ESPN fallback already covers events).
- Any change to `enrichMatchWithEspnEvents` / `enrichMatchWithAFEvents` (they work correctly).
- Cache purge / manual repair (Option 3 supersedes it).

**No deploy. No repair. No code written. Proposal only.**
