# ROOT_CAUSE.md
## DATA-18WC.LIVE.TRUTH — Phase 7: Root Cause

---

## The Divergence

```
Home      → 2 LIVE
/live     → 0 LIVE

Same real-world state. Different pages. Different answer.
```

---

## Exact Line of Code

**`src/app/page.tsx:604–612`**

```typescript
// Line 604: filter authority for IN_PLAY/PAUSED matches
const liveStrays = wcAuthorityRaw.filter((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');

// Line 612: merge live cache + authority strays
const wcLive: Match[] = dedupById([...wcLiveBase, ...liveStrays]);
```

---

## Why This Diverges

### Two Sources, Two TTLs

| Source | Variable | TTL | After match ends |
|--------|----------|-----|-----------------|
| `getCurrentLiveMatches()` | `wcLiveBase` | 30s | Match removed within 30s ✅ |
| Authority filter `IN_PLAY\|PAUSED` | `liveStrays` | 5 min | Match can stay up to 5 min ❌ |

### Timeline of the Bug

```
T+0:    Brazil vs Croatia ends 90'. Provider removes from /matches?status=IN_PLAY,PAUSED.

T+30s:  live-cache.ts: L1 expires → KV miss → API fetch → Brazil/Croatia REMOVED.
        wcLiveBase = []   ← live-cache is correct

T+30s:  authority:v1: still cached (written 2 minutes ago, 5-min TTL).
        wcAuthorityRaw still contains Brazil/Croatia with status='IN_PLAY'.
        liveStrays = [Brazil_v_Croatia]   ← authority is STALE

T+30s:  wcLive = dedupById([...[], ...[Brazil_v_Croatia]])
             = [Brazil_v_Croatia]

Home:   "2 LIVE" (Brazil/Croatia + another match from liveStrays)
/live:  "0 LIVE" (reads live-cache KV directly — correctly shows 0)
```

---

## Why The Comment Is Wrong

The comment on line 611 says:
```
// Live: merge live cache with live strays (authority knows IN_PLAY; live cache may lag).
```

This is **backwards**. Authority does NOT "know" IN_PLAY more recently than the live cache:

| Cache | What it reads | How often |
|-------|--------------|-----------|
| Live cache | `/matches?status=IN_PLAY,PAUSED` | Every 30s |
| Authority | Orchestrator writes (based on fixtures+results+live merge) | Dynamic (30s–5min) |

The live cache is **always at least as fresh as authority** for live match status. When authority shows a match as IN_PLAY that the live cache doesn't have, the match has **ended** and authority is stale — not the other way around.

---

## Why The Hub Does Not Have This Bug

**`src/app/world-cup-2026/page.tsx:342–346`**
```typescript
const liveMatchIds = new Set(allLive.map((m) => m.id));
// Demotes authority-live matches absent from SSOT to 'finished':
const overrideState = (m: CanonicalMatch) =>
  liveMatchIds.has(m.id) ? 'live' : classify(m) === 'live' ? 'finished' : classify(m);
```

The hub uses authority for schedule/results data, but gates all live classification through `liveMatchIds`. A match authority still marks live is demoted to `finished` if absent from the live cache. This is the correct pattern.

The home page was an earlier implementation that predates the SSOT pattern. The `liveStrays` merge was added as a "belt-and-suspenders" measure before `wc-live-ssot.ts` was established as the authoritative source.

---

## The Fix (One Line Deleted, One Line Changed)

**Remove `liveStrays` entirely. Use SSOT only.**

```typescript
// BEFORE (lines 604, 612):
const liveStrays = wcAuthorityRaw.filter((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');
const wcLive: Match[] = dedupById([...wcLiveBase, ...liveStrays]);

// AFTER:
const wcLive: Match[] = wcLiveBase;
```

`wcLiveBase` already comes from `getCurrentLiveMatches()` → KV 30s → same key as `/live`. After this fix, `wcLive.length` on the home page equals `liveMatches.length` on `/live`.

---

## Secondary Observations (Not Breaking)

1. **`/schedule`, `/world-cup-2026-results`, `/world-cup-2026-schedule`** have `revalidate = 300s`. Their LIVE logic is correct (uses SSOT), but the ISR page shell can be 5 minutes old. A `LiveRefresher` client component mitigates this by calling `router.refresh()` every 30s when matches are live. Not a bug — by design.

2. **`/world-cup-2026/[group]`** does not show live match counts or live badges (group pages show standings only). No issue.

3. **`WCCountdownBanner`** receives `liveCount` as a prop. After the fix, the home page passes `wcLive.length` (SSOT only). Correct.
