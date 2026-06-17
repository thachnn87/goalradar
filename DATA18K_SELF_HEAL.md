# DATA-18K Phase 2 — Self-Heal Existing Pinned Snapshots

Date: 2026-06-18  Status: **implemented** (not yet deployed)

## Problem
Phase 1 prevents *new* pins but does not fix the 5 snapshots already pinned `goals=0`. Because
`getOrBuildMatchSnapshot` returns a KV hit verbatim, a pinned unenriched FINISHED snapshot is served
for its full 7-day TTL and never rebuilt.

---

## Change — guarded rebuild in the KV-hit branch

File: `src/lib/match-snapshot.ts`, `getOrBuildMatchSnapshot` (KV-hit branch).

```ts
const kvHit = await readKVSnapshot(matchId);
if (kvHit) {
  const hm  = kvHit.match;
  const hFt = (hm.score?.fullTime?.home ?? 0) + (hm.score?.fullTime?.away ?? 0);
  const pinnedUnenriched =
    hm.status === 'FINISHED' && hFt > 0 && (hm.goals?.length ?? 0) === 0;

  if (pinnedUnenriched && KV_ENABLED) {
    const repairLock = `goalradar:repair-lock:${matchId}`;
    const acquired   = await kv.set(repairLock, '1', { nx: true, ex: 1_800 }).catch(() => null);
    if (acquired) {
      console.warn(`[Snapshot] SELF-HEAL match:${matchId} — pinned unenriched (score-total=${hFt} goals=0) — rebuilding under repair-lock`);
      try {
        const rebuilt = await buildSnapshot(matchId);      // runs AF + ESPN enrichment
        await writeKVSnapshot(matchId, rebuilt).catch(() => undefined);
        writeDRSnapshot(matchId, rebuilt);
        recordSnapshotFetch(Date.now() - t0, 'build-provider');
        return rebuilt;                                    // serve enriched immediately
      } catch (healErr) {
        console.error(`[Snapshot] SELF-HEAL failed match:${matchId}: … — serving cached`);
        // fall through → serve cached
      }
    }
    // lock not acquired → another request is healing → serve cached
  }
  …
  return kvHit;
}
```

---

## Trigger condition (exactly as specified)
`status === 'FINISHED' && scoreTotal > 0 && goals.length === 0` → attempt rebuild.

## Cooldown lock — `goalradar:repair-lock:{id}`, TTL 30 min
- Acquired with `SET … NX EX 1800`. Only the **first** request per match per 30 min rebuilds.
- All other concurrent/subsequent requests (lock not acquired) **serve the cached snapshot
  immediately** — no rebuild, no extra provider load. This bounds rebuilds to **≤1 per match / 30 min**.
- 30-min TTL also rate-limits the case where a rebuild genuinely cannot enrich (e.g. ESPN cache gone
  and ESPN lookup failing): at most one expensive attempt every 30 min, not on every page view.

## Why it heals
`buildSnapshot` runs the full enrichment block (AF then ESPN). For the 5 target matches the ESPN
event cache is already populated (goals 3–8), so the rebuild merges events → `goals>0`, then writes
the enriched snapshot via the guarded writer (which now also persists an enriched DR). Subsequent
visits get a clean KV hit (goals>0) and the self-heal branch is skipped.

## Failure safety
Any rebuild error is caught and the cached snapshot is served — the page never errors or blocks on
the heal attempt. Worst case the user sees the (score-correct) unenriched card for up to 30 more min.

## Blast radius
- Only the **snapshot reader** (`getOrBuildMatchSnapshot`) changed; one self-contained branch.
- No change to enrichment logic, Authority Cache, CanonicalMatch, listing pages, or WC hub.
