# DATA-18D.2 Phase 4 — DR Protection Upgrade
## Prevent Writing Poisoned DR (score > 0, goals = 0)

Files modified:
- `src/lib/match-snapshot.ts` — `writeDRSnapshot()`
- `src/lib/prewarm/worldcup.ts` — `seedMatch()` snapshot write block

---

## The DR Poisoning Scenario

**Before Phase 4:**

When a FINISHED match has score > 0 but AF enrichment is unavailable:

1. Page-load path: `writeKVSnapshot()` downgrade guard fires → no DR rescue (DR also missing or unenriched) → writes unenriched primary → **`writeDRSnapshot()` then writes unenriched DR (30d TTL)**
2. Prewarm path: `buildPartialSnapshot()` → unenriched → **both primary AND DR written unenriched**

The poisoned DR locks goals=0 for up to 30 days. Even after the primary is repaired, the downgrade guard will promote the poisoned DR if the primary is ever evicted again.

---

## Fix Applied

### 1. `writeDRSnapshot()` in `match-snapshot.ts`

Added guard before the KV write:

```typescript
// DATA-18D.2 Phase 4: never write a poisoned DR
const ftH = snapshot.match.score?.fullTime?.home ?? 0;
const ftA = snapshot.match.score?.fullTime?.away ?? 0;
if (
  snapshot.match.status === 'FINISHED' &&
  ftH + ftA > 0 &&
  (snapshot.match.goals?.length ?? 0) === 0
) {
  console.warn(`[DR] SKIP-POISON match:${matchId} | score=${ftH}-${ftA} goals=0 — refusing to write unenriched DR`);
  return;
}
```

### 2. `seedMatch()` in `prewarm/worldcup.ts`

The prewarm bypasses `writeDRSnapshot()` (writes KV directly), so the same guard is applied inline:

```typescript
const isUnenriched =
  tier === 'finished' &&
  snapFtH + snapFtA > 0 &&
  (snap.match.goals?.length ?? 0) === 0;
if (!isUnenriched) {
  kvWrites.push(kv.set(snapshotDRKey(match.id), snap, { ex: SNAPSHOT_DR_TTL_SEC }));
} else {
  console.warn(`[Prewarm] SKIP-DR match:${match.id} | score=${snapFtH}-${snapFtA} goals=0 — refusing to write unenriched DR`);
}
```

---

## Behavior After Fix

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| AF unavailable, page-load rebuild | Primary unenriched + DR poisoned (30d) | Primary unenriched, **DR not written** |
| AF unavailable, prewarm first build | Both primary + DR poisoned (30d) | Primary unenriched (7d), **DR not written** |
| AF available, prewarm first build | Both enriched ✓ | Both enriched ✓ |
| Repair cron / integrity-repair run | Both enriched ✓ | Both enriched ✓ |

**The downgrade guard is now safe:** When the guard checks DR and finds null/missing, it logs a warn and writes the unenriched primary. This is acceptable — the primary has a 7d TTL and will be caught by the repair cron. The DR remains absent rather than poisoned.

---

## DR Rescue Chain After Fix

When a match is unenriched and `writeDRSnapshot` is skipped:

1. Primary written unenriched (7d TTL)
2. DR not written (no poisoning)
3. Next page load: downgrade guard fires, DR is null → logs "no DR rescue" → primary remains unenriched
4. Repair cron (next morning): deletes primary + DR (both empty/null) → rebuilds with AF enrichment → writes enriched primary + DR

The maximum unenriched window remains ≤24h (same as before DATA-18D.2), but DR is now protected from long-term poisoning.

---

## Phase 4 Verdict

Implementation complete. DR is now protected from unenriched writes in both the page-load path and the prewarm path. The 30-day DR poisoning scenario is eliminated.
