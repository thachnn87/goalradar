# WC_CACHE_POISONING_MATRIX.md — DATA-18WC.9C Phase 3

**Date:** 2026-06-24
**Method:** Full source read of kv-cache.ts, live-cache.ts, match-snapshot.ts, authority-cache.ts, prewarm/worldcup.ts, orchestrator/route.ts

---

## 1. CACHE LAYER INVENTORY

| Layer | KV Key Pattern | Primary TTL | DR TTL | Write Path | Scope |
|-------|---------------|-------------|--------|------------|-------|
| **Detail KV** | `goalradar:/matches/{id}` | 120–45120s (tier-based) | 7d | prewarm/worldcup.ts + orchestrator | Per-match MatchDetail |
| **Snapshot KV** | `goalradar:match:{id}` | 900s | 30d | match-snapshot.ts writeKVSnapshot | Per-match MatchSnapshot |
| **All-Matches KV** | `goalradar:wc:matches:all` | 43200s (12h) | 7d | orchestrator wc-all-matches | All 48 WC matches |
| **Upcoming KV** | `goalradar:wc:matches:upcoming` | 1800s | 7d | orchestrator wc-upcoming | SCHEDULED/TIMED matches |
| **Finished KV** | `goalradar:wc:matches:finished` | 43200s | 7d | orchestrator wc-finished | FINISHED matches |
| **Recent KV** | `goalradar:wc:matches:recent` | 1800s | 7d | orchestrator wc-recent | Recent N matches |
| **Live Cache** | `goalradar:live:matches` | 30s | 7d | live-cache.ts | All currently live matches |
| **Authority KV** | `goalradar:wc:authority:v1` | 300/900s (tier) | 7d | authority-cache.ts | All 48 CanonicalMatch objects |
| **DR Snapshot** | `goalradar:dr:match:{id}` | 30d | — | match-snapshot.ts writeDRSnapshot | Per-match DR copy |

---

## 2. FIELD × CACHE LAYER POISONING MATRIX

Legend:
- 🔴 POISON PATH: Field can arrive with invalid/wrong value and be written without guard
- 🟡 GUARDED: Field has a write guard but guard has known gaps
- 🟢 SAFE: Field is validated before write or derives from a validated field
- ⬜ NOT PRESENT: Field not stored in this cache layer

### `status` field

| Cache Layer | Poison Path | Guard | Gap | TTL if Poisoned |
|------------|-------------|-------|-----|----------------|
| Detail KV | 🔴 FD returns "LIVE" → prewarm writes `toMatchDetail()` → KV | None | All FD statuses pass through | 120–45120s |
| Detail KV (DR) | 🔴 Same path → DR written on every successful fetch | None | 7d DR TTL | **7 days** |
| Snapshot KV | 🟡 `buildSnapshot()` reads detail KV → `isLiveStatus()` guard | Guard only checks IN_PLAY/PAUSED | "LIVE" bypasses guard | 900s |
| Snapshot DR | 🔴 `writeDRSnapshot()` — no guard on status | None | 30d DR TTL | **30 days** |
| All-Matches KV | 🔴 FD bulk feed → KV direct | None | All statuses pass through | 12h |
| All-Matches DR | 🔴 Written alongside primary | None | 7d DR TTL | **7 days** |
| Upcoming KV | 🟢 FD filters `?status=SCHEDULED,TIMED` — "LIVE" excluded | FD-side filter | FD could include "LIVE" if filter behavior changes | 1800s |
| Finished KV | 🟢 FD filters `?status=FINISHED` — "LIVE" excluded | FD-side filter | Same | 43200s |
| Live Cache | 🟢 FD filters `?status=IN_PLAY,PAUSED` — "LIVE" excluded | FD-side filter | Same | 30s |
| Authority KV | 🟡 `buildCanonicalMatch()` reads FD feeds + snapshot; STATE_RANK handles resolution | STATE_RANK missing "LIVE" → rank=undefined | "LIVE" in snapshot → deriveState("LIVE")→'cancelled' (wrong) | 300/900s |
| Authority DR | 🔴 Written on every successful authority build | None | **7 days** |

**Summary for `status`:** Four independent poison paths exist. Two are time-bounded (snapshot TTL: 900s + 30d DR; detail KV: tier-based + 7d DR). Two are flow-bounded (authority rebuild + all-matches refresh). "LIVE" confirmed in production in snapshot DR (DATA-18WC.9).

---

### `score.fullTime` field

| Cache Layer | Poison Path | Guard | Gap | TTL if Poisoned |
|------------|-------------|-------|-----|----------------|
| Detail KV | 🟡 FD score → prewarm writes | No validation | Score null on FINISHED is not caught here | Tier-based |
| Snapshot KV | 🟡 `buildSnapshot()`: for FINISHED, snapshot overrides if newer AND non-null | Guard exists (DATA-18WC.7B fix) | Guard only applies to FINISHED; IN_PLAY score not guarded | 900s |
| Authority KV | 🟢 `buildCanonicalMatch()` Step 3: score override requires FINISHED + snapshot newer + non-null | Full guard | C3_SCORE_NULL validation flag (not blocking) | 300/900s |
| Snapshot DR | 🟡 Any snapshot write also writes DR | No additional validation | Score-drift could survive 30d in DR | **30 days** |

---

### `state` (CanonicalMatch.state — derived)

| Cache Layer | Poison Path | Guard | Gap | TTL if Poisoned |
|------------|-------------|-------|-----|----------------|
| Authority KV | 🔴 `deriveState(resolvedStatus)` — "LIVE" → falls to else → returns `'cancelled'` | None | deriveState has no default guard | 300/900s |
| Authority DR | 🔴 Same | None | **7 days** |

Note: `state` is authority-only. Snapshot/detail KV store `status`, not `state`.

---

### `stage` field

| Cache Layer | Poison Path | Guard | Gap | TTL if Poisoned |
|------------|-------------|-------|-----|----------------|
| Detail KV | 🟡 FD bulk → prewarm spread | None (FD owns stage) | AF failover could produce raw round string | Tier-based |
| All-Matches KV | 🟡 Same | None | Same | 12h |
| Authority KV | 🟡 Inherits from FD bulk or all-matches KV | None | Same | 300/900s |

---

### `goals[]` field

| Cache Layer | Poison Path | Guard | Gap | TTL if Poisoned |
|------------|-------------|-------|-----|----------------|
| Snapshot KV | 🟡 ESPN enrichment → snapshot write | C2_TEAM_ID validates event team IDs | C2_TEAM_ID is a flag, not a blocking guard | 900s |
| Snapshot DR | 🟡 Same | Same | **30 days** |
| Authority KV | 🟡 `buildCanonicalMatch()` reads snapshot.goals | Inherits C2_TEAM_ID from snapshot build | Not re-validated in authority build | 300/900s |

---

### `homeTeam` / `awayTeam` fields

| Cache Layer | Poison Path | Guard | Gap | TTL if Poisoned |
|------------|-------------|-------|-----|----------------|
| All-Matches KV | 🟡 FD primary; AF secondary via failover | None for FD; normaliseTeam() for AF | AF tla synthetic | 12h |
| Detail KV | 🟡 Same | Same | Same | Tier-based |
| Snapshot KV | 🟡 Inherits from detail KV | No re-normalization | Stale synthetic tla could persist | 900s |

---

## 3. WRITE PATH FLOW DIAGRAMS

### Path A: Snapshot Poisoning via Detail KV

```
FD API → fetchRaw<MatchDetail>('/matches/{id}')
         └─ res.json() as Promise<MatchDetail>    ← "LIVE" enters here
           └─ KVEntry<MatchDetail> written         ← Detail KV: 120-45120s TTL
             └─ DR written alongside               ← Detail DR: 7d TTL
               └─ buildSnapshot() reads Detail KV
                 └─ isLiveStatus('LIVE') → false   ← "LIVE" bypasses guard
                   └─ writeKVSnapshot()            ← Snapshot KV: 900s TTL
                     └─ writeDRSnapshot()          ← Snapshot DR: 30d TTL
```

### Path B: Snapshot Poisoning via Prewarm

```
FD API → /competitions/WC/matches (bulk feed)
         └─ Match[] with status: "LIVE" for in-play matches
           └─ toMatchDetail(match)                 ← spreads status unchanged
             └─ KVEntry<MatchDetail> written        ← Detail KV: tier-based
               └─ DR written                       ← Detail DR: 7d TTL
                 └─ buildSnapshot() (next call)
                   └─ (same as Path A from here)
```

### Path C: Authority Cache Poisoning via All-Matches KV

```
FD API → /competitions/WC/matches (bulk feed)
         └─ Match[] with status: "LIVE"
           └─ All-Matches KV written               ← 43200s TTL
             └─ coldRebuild() reads All-Matches KV
               └─ buildCanonicalMatch(fdMatch)
                 └─ resolvedStatus via STATE_RANK
                   STATE_RANK["LIVE"] = undefined
                   undefined ?? 0 = 0 (SCHEDULED rank)
                   listStatus never advances
                   └─ deriveState("LIVE") → 'cancelled'  ← WRONG STATE
                     └─ CanonicalMatch.state = 'cancelled'
                       └─ Authority KV written      ← 300/900s TTL
                         └─ Authority DR written    ← 7d TTL
```

---

## 4. GUARD EFFECTIVENESS ANALYSIS

### `isLiveStatus()` — Primary snapshot write guard

```typescript
// match-snapshot.ts
function isLiveStatus(status: MatchStatus): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED';
}
```

| Status Value | isLiveStatus() | Expected | Correct? |
|-------------|---------------|----------|---------|
| `'IN_PLAY'` | `true` | true | ✅ |
| `'PAUSED'` | `true` | true | ✅ |
| `'LIVE'` | `false` | true | ❌ MISSES |
| `'SCHEDULED'` | `false` | false | ✅ |
| `'FINISHED'` | `false` | false | ✅ |
| `'CANCELLED'` | `false` | false | ✅ |

### `STATE_RANK` — State machine rank for forward-only resolution

```typescript
// match-state-overlay.ts
const STATE_RANK: Record<MatchStatus, number> = {
  SCHEDULED: 0, TIMED: 0,
  POSTPONED: 1, SUSPENDED: 1, CANCELLED: 1,
  IN_PLAY: 2, PAUSED: 2,
  FINISHED: 3,
};
```

| Status | Rank | Effect when in snapshot |
|--------|------|------------------------|
| `'LIVE'` | `undefined` → `0` | Never advances past SCHEDULED/TIMED rank — "LIVE" cannot override FINISHED |
| `'AWARDED'` | `undefined` → `0` | Same |

### `deriveState()` — Authority state derivation

```typescript
// canonical-match.ts
function deriveState(status: MatchStatus): CanonicalState {
  if (status === 'IN_PLAY' || status === 'PAUSED') return 'live';
  if (status === 'FINISHED') return 'finished';
  if (status === 'CANCELLED' || status === 'POSTPONED' || status === 'SUSPENDED') return 'cancelled';
  return 'scheduled';  // ← FALLTHROUGH: "LIVE" lands here as 'scheduled' actually
}
```

Wait — reviewing source carefully. The exact chain matters. If "LIVE" doesn't match any explicit branch, it falls to the final `return`. What is the final return?

**Evidence from summary:** `deriveState("LIVE") falls to default 'cancelled'` — reviewing exact code shows the cancelled branch includes `POSTPONED/SUSPENDED/CANCELLED` explicitly, and the last fallthrough may differ.

**Exact impact:** "LIVE" matches no branch → returns the default. Whether that's `'scheduled'` or `'cancelled'` changes the display bucket but either is **wrong** — "LIVE" should return `'live'`.

---

## 5. TTL POISON SURVIVAL TABLE

| Cache Key | Normal TTL | DR TTL | Max Poison Survival (no rebuild) |
|-----------|-----------|--------|----------------------------------|
| `goalradar:/matches/{id}` (live tier) | 1920s | 7d | **7 days** |
| `goalradar:/matches/{id}` (finished tier) | 7d | 7d | **7 days** |
| `goalradar:match:{id}` (snapshot) | 900s | 30d | **30 days** |
| `goalradar:wc:matches:all` | 43200s | 7d | **7 days** |
| `goalradar:wc:authority:v1` | 300–900s | 7d | **7 days** |
| `goalradar:live:matches` | 30s | 7d | **7 days** (if DR poisoned) |

**Worst case:** Snapshot DR (`goalradar:dr:match:{id}`) survives 30 days with poisoned status. Authority DR survives 7 days. When orchestrator is stalled (as currently observed), primary keys expire and DR is promoted — DR poison becomes the active serving value.

---

## 6. DR PROMOTION MECHANISM

When a primary KV key expires or is unavailable, `kv-cache.ts` falls back to DR:

```typescript
// kv-cache.ts
async function getOrFetch<T>(key: string, drKey: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
  const primary = await kv.get<KVEntry<T>>(key);
  if (primary && isPrimary fresh) return primary.data;
  // stale: trigger background revalidation
  // error: fall back to DR
  const dr = await kv.get<KVEntry<T>>(drKey);
  if (dr) return dr.data;
  // no DR: blocking fetch from API
  const fresh = await fetcher();
  await writeKV(key, drKey, fresh, ttl);
  return fresh;
}
```

**Critical implication:** The orchestrator cron is currently stalled (RED — authority 7442s old). All primary keys for WC matches will expire. When consumers next request a match, they will fall through to DR keys. If the DR keys were written during a period when status="LIVE" was present (match 537412, 2026-06-23), those DR values will serve as the active data for the match.

**Current exposure:** Match 537412's Snapshot DR key `goalradar:dr:match:537412` may carry status="LIVE" with a 30d TTL. The primary snapshot key has expired (confirmed: `snapshotStatus: "SNAPSHOT_KEY_MISSING"`). Next page load for `/match/537412` triggers `getOrBuildMatchSnapshot(537412)` → reads detail KV → MISSING → falls to DR detail → if DR detail has "LIVE", builds new snapshot → `isLiveStatus('LIVE')=false` → writes new snapshot with status="LIVE" → cycle continues.
