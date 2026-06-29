# LIVE SOURCE MIGRATION — DATA-18B.3E Phases 2–3

**Task:** DATA-18B.3E LIVE-SOURCE-UNIFICATION
**Date:** 2026-06-23
**Commit:** `37267d0`

---

## New primitive

`src/lib/wc-live-ssot.ts` — added `getLiveMatchIdSet()`:

```ts
export async function getLiveMatchIdSet(): Promise<Set<number>> {
  const matches = await getCurrentLiveMatches();
  return new Set(matches.map((m) => m.id));
}
```

The canonical live-id Set. Every page's "is this match live" decision is now
`liveMatchIds.has(match.id)`.

---

## Migration principle

Authority cache still provides the **fixture list** and **finished/scheduled**
buckets. Only the **live decision** moves to the SSOT. A match the authority
cache still marks live but that the SSOT no longer lists **has ended** → it is
normalised to finished (both `state` and `status`) so it leaves the live grid
and renders as a result — never disappears, never shows live.

---

## Per-page changes

| Page | Current live source | Target live source | Change |
|------|---------------------|--------------------|--------|
| Hub | `getCurrentLiveMatches()` (grid) | same + `liveMatchIds` gates buckets | `effectiveBucket()` downgrades stale-authority-live → finished |
| Schedule | MatchCard reads `status` | `getLiveMatchIdSet()` normalises status pre-render | SSOT-normalise WC matches before MatchCard |
| Today | `filter(m.state==='live')` | `filter(liveMatchIds.has(id))` | `resolveLive()` normalises `m.state`; live bucket = Set |
| Tomorrow | n/a | n/a | unchanged (no live badge) |
| Results (`/world-cup-2026/results`) | `entry.state==='live'` | SSOT-resolved `entry.state` | resolve entries via Set (file is redirect-shadowed but kept consistent) |
| WC Results (`/world-cup-2026-results`) | `classifyMatchState()==='live'` | `filter(liveMatchIds.has(id))` | status normalised; live = Set; **fixes the France-vs-Iraq bug** |

### Representative diff (WC Results — the bug page)

```diff
- const authorityData = await getWCAuthorityMatches().catch(...);
- const live = authorityData.matches.filter((m) => classify(m) === 'live');
+ const [authorityData, liveMatchIds] = await Promise.all([
+   getWCAuthorityMatches().catch(...),
+   getLiveMatchIdSet().catch(() => new Set<number>()),
+ ]);
+ const resolved = authorityData.matches.map((m) => {
+   const authLive = m.status === 'IN_PLAY' || m.status === 'PAUSED';
+   if (liveMatchIds.has(m.id)) return authLive ? m : { ...m, status: 'IN_PLAY' };
+   return authLive ? { ...m, status: 'FINISHED' } : m;   // ended → finished
+ });
+ const live = resolved.filter((m) => liveMatchIds.has(m.id));   // SSOT only
```

### Hub diff

```diff
  const allLive = liveResult.status === 'fulfilled' ? liveResult.value : [];
+ const liveMatchIds = new Set(allLive.map((m) => m.id));
+ const effectiveBucket = (m) =>
+   liveMatchIds.has(m.id) ? 'live' : classify(m) === 'live' ? 'finished' : classify(m);
- const recentResults = allAuthority.filter((m) => classify(m) === 'finished')…
+ const recentResults = allAuthority.filter((m) => effectiveBucket(m) === 'finished')…
```

---

## Result

- Every live-rendering page derives live **only** from `liveMatchIds.has(id)`.
- No page reads `m.state === 'live'`, `classifyMatchState() === 'live'`, or raw
  `IN_PLAY/PAUSED` for the live decision on a *list*.
- TypeScript: `tsc --noEmit` clean.

**Phases 2–3 complete.** See LIVE_SOURCE_VALIDATION.md for production proof.
