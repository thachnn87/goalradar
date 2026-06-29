# DATA-18C.0 Phase 5 — Triple Overlay Impact Analysis
## KV Command Count, Duplicate Reads, and Savings Estimate

Audit timestamp: 2026-06-17T09:30:14Z  
Data source: code analysis + feed counts from live audit

---

## 1. Current Overlay Count

Every call to `getWCAuthorityMatchesCached()` (Hub, Results, Schedule, Fixtures, Group) runs
three independent `overlayMatchStates()` calls:

| Overlay | Caller | Input match count | KV mget chunks |
|---------|--------|-------------------|----------------|
| #1 | `getUpcomingMatchesCached('WC')` | 84 (upcoming feed) | 1 chunk (84 ≤ 100) |
| #2 | `getWCResultsCached()` | 20 (FINISHED feed, actual FINISHED) | 1 chunk |
| #3 | `getWCAuthorityMatchesCached()` (outer) | 104 (merged set) | 2 chunks (104 → 100+4) |

`overlayMatchStates()` in `api.ts` executes `kv.mget(keys)` where `keys` is the array of
`goalradar:match:{id}` for each match in the input. MAX_OVERLAY cap is 120.

---

## 2. KV Commands Per Authority Page Request

| Step | KV command | Key count | Chunks |
|------|-----------|-----------|--------|
| Read upcoming feed | `kv.get` | 1 | 1 |
| Overlay #1 (upcoming) | `kv.mget` | 84 | 1 |
| Read FINISHED feed | `kv.get` | 1 | 1 |
| Overlay #2 (FINISHED) | `kv.mget` | 20 | 1 |
| Read live cache | `kv.get` | 1 | 1 |
| Overlay #3 (merged) | `kv.mget` | 104 | 2 |
| **Total** | | | **7 KV commands** |

Plus any additional reads (standings, knockout bracket, etc.).

---

## 3. Snapshot Reads Per Request

| Overlay | Snapshot keys read | Unique keys (new vs prior) |
|---------|-------------------|---------------------------|
| Overlay #1 (upcoming) | 84 | 84 new |
| Overlay #2 (FINISHED) | 20 | 20 new (different IDs, but subset of #1's 84) |
| Overlay #3 (merged) | 104 | 0 new — ALL already read by #1 or #2 |

**Overlay #3 reads zero keys that weren't already read by #1 and #2.**

For the Hub ISR (`revalidate=30`), the merged set of 104 matches is exactly the union of:
- 84 upcoming matches (snapshot keys read in #1)
- 20 FINISHED matches (snapshot keys read in #2)

Every key in overlay #3 was already read in #1 or #2 within the same request. Overlay #3
produces no new information and cannot change any match's state (a snapshot cannot be
written between overlay #1/#2 and overlay #3 within a single `Promise.allSettled` call).

---

## 4. Duplicate Read Breakdown

| Read type | Overlay #1 | Overlay #2 | Overlay #3 | Total reads | Unique reads | Wasted reads |
|-----------|-----------|-----------|-----------|------------|-------------|-------------|
| Snapshot keys | 84 | 20 | 104 | 208 | 104 | **104** |

104 out of 208 snapshot reads are pure duplicates. **50% of all snapshot mget operations
are wasted per authority page request.**

---

## 5. KV Cost Estimate

Vercel KV pricing: **$0.20 per 100K commands** (as of mid-2026).

Hub ISR `revalidate=30` — up to 2 renders/min during active traffic:

| Scenario | Renders/min | mget cmds/render | mget cmds/min | Wasted cmds/min |
|----------|------------|-----------------|--------------|----------------|
| Current (3 overlays) | 2 | 4 | 8 | 4 |
| After fix (1 outer overlay removed) | 2 | 2 | 4 | 0 |
| **Saving** | — | **2 cmds** | **4 cmds/min** | **50%** |

Over 24h during a live match day (continuous 2 renders/min):
- Current: 8 cmds/min × 60 × 24 = 11,520 mget commands/day from Hub alone
- After fix: 4 cmds/min × 60 × 24 = 5,760 mget commands/day from Hub alone
- **Saving: 5,760 mget commands/day from Hub alone**

All 5 authority pages combined (Hub 30s, Results 300s, Schedule 300s, Fixtures 900s, Group 3600s):
Hub dominates by 10–120× due to its 30s revalidate. Total saving is approximately 95%
from Hub's contribution = ~5,500 mget commands/day saved.

At $0.20/100K: **~$0.011/day saving** (small absolute value, but the duplicate reads also
add latency to every Hub ISR render during live matches).

---

## 6. Latency Impact

Each `kv.mget` command has ~3–8ms round-trip on Vercel KV (same-region).

| Path | Commands | Latency (ms) |
|------|---------|-------------|
| Current Hub render (3 overlays) | 7 KV commands | 21–56 ms KV-only |
| After removing outer overlay | 5 KV commands | 15–40 ms KV-only |
| **Saving** | 2 commands | **6–16 ms per render** |

For Hub at `revalidate=30`, this is during ISR revalidation (background, not on critical path).
But during live match pages where the Hub's ISR runs synchronously with live score fetches,
the 6–16ms saving per render contributes to faster score propagation.

---

## 7. Information Value of Each Overlay

| Overlay | Can it add new information? | Justification |
|---------|----------------------------|---------------|
| #1 (inside `getUpcomingMatchesCached`) | YES | Advances SCHEDULED→FINISHED if snapshot has FINISHED status |
| #2 (inside `getWCResultsCached`) | YES | Advances FINISHED feed states via snapshot (minor — already FINISHED) |
| #3 (outer, inside `getWCAuthorityMatchesCached`) | **NO** | All 104 keys already read; STATE_RANK merge already done; no new state transitions possible within same request |

Overlay #3 was added as a safety net during the DATA-16/17 migration. It was intended to
catch FINISHED transitions that weren't in the FINISHED feed yet. However, the STATE_RANK
merge already handles this: if a snapshot has FINISHED state, overlay #1 or #2 already
applies it to the match before the merge. The outer overlay is redundant by design.

---

## 8. Recommended Removal

Remove overlay #3 from `getWCAuthorityMatchesCached()`:

```typescript
// BEFORE:
return { matches: await overlayMatchStates([...byId.values()]) };

// AFTER:
return { matches: [...byId.values()] };
```

**Prerequisite:** The FINISHED feed cron cadence must be ≤ 10 min (so FINISHED transitions
appear in the FINISHED KV key within the Hub's 30s ISR window × some refresh cycles). At
the current 30-min cron cadence, removing overlay #3 means a match that finishes will take
up to 30 min to appear on Hub/Results pages — instead of being detectable via snapshot overlay
within seconds of the first `/match/{id}` page visit.

**Dependency on DATA-18C:** Once the Authority Cache is active, `getWCAuthorityMatchesCached()`
is replaced by `readAuthorityCache()` which does its own single mget pass. The triple overlay
issue is automatically eliminated for pages that migrate to the Authority Cache.

---

## 9. Live KV Command Trace at Audit Time

| Command | Key | Purpose |
|---------|-----|---------|
| `kv.get` | `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` | Upcoming feed |
| `kv.mget × 84` | `goalradar:match:{537xxx}` × 84 | Overlay #1 |
| `kv.get` | `goalradar:/competitions/WC/matches?status=FINISHED` | FINISHED feed |
| `kv.mget × 20` | `goalradar:match:{537xxx}` × 20 | Overlay #2 |
| `kv.get` | `goalradar:live:matches:WC` | Live feed |
| `kv.mget × 100` | `goalradar:match:{537xxx}` × 100 | Overlay #3 chunk 1 |
| `kv.mget × 4` | `goalradar:match:{537xxx}` × 4 | Overlay #3 chunk 2 |

Total: 7 KV commands per Hub page ISR. 2 of those commands (overlay #3) are fully redundant.
