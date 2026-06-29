# DATA-17.1 Phase 1 — Source Trace
## Every World Cup Page: Function → Data Source → KV Keys → Authority Path

Date: 2026-06-17  
Status: Audit complete — design only, no code changes.

---

## 1. Authority Pages (all call `getWCAuthorityMatchesCached` or its alias)

### 1.1 Hub `/world-cup-2026`
**File:** `src/app/world-cup-2026/page.tsx`  
**ISR revalidate:** 30 s  

| Call | Function | KV Key | TTL |
|------|----------|--------|-----|
| Authority feed | `getWCAuthorityMatchesCached()` | (composite — see below) | — |
| ↳ Upcoming | `getUpcomingMatchesCached('WC')` | `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` | 15 min fresh / 30 min stale |
| ↳ Results | `getWCResultsCached()` | `goalradar:/competitions/WC/matches?status=FINISHED` | 15 min fresh / **12 h stale** |
| ↳ Live | `getWCLiveMatches()` | `goalradar:live:matches:WC` | 30 s |
| ↳ Snapshot overlay | `overlayMatchStates()` inside authority merge | `goalradar:match:{id}` × up to 104 | 7 d (FINISHED) |
| Knockout bracket | `getWCKnockoutMatchesCached()` | `goalradar:/competitions/WC/matches` | 6 h fresh / 12 h stale |
| Standings | `getStandingsCached('WC')` | `goalradar:/competitions/WC/standings` | 1 h fresh / 2 h stale |

**Authority path:** YES — uses `getWCAuthorityMatchesCached()`  
**Display buckets:** `classifyMatchState(m, today)` → `'today'` / `'finished'` / `'upcoming'` / `'live'`  
**Overlay count:** 3× (see Section 3 — Triple Overlay)

---

### 1.2 Results `/world-cup-2026-results`
**File:** `src/app/world-cup-2026-results/page.tsx`  
**ISR revalidate:** 300 s  

| Call | Function | KV Key | TTL |
|------|----------|--------|-----|
| Authority feed | `getWCAuthorityMatches()` → alias of `getWCAuthorityMatchesCached()` | (same composite as Hub) | — |

**Authority path:** YES  
**Display:** `finishedResults = allAuthority.filter(m => classify(m) === 'finished')`  
**Stats source:** `played = finishedResults.length + live.length` — depends on FINISHED feed completeness  
**Overlay count:** 3×

---

### 1.3 Schedule `/world-cup-2026-schedule`
**File:** `src/app/world-cup-2026-schedule/page.tsx`  
**ISR revalidate:** 300 s  

| Call | Function | KV Key | TTL |
|------|----------|--------|-----|
| Authority feed | `getWCAuthorityMatchesCached()` | (same composite as Hub) | — |

**Authority path:** YES  
**Display:** filters to `'today'` and `'upcoming'` buckets only — FINISHED matches not shown  
**Overlay count:** 3×

---

### 1.4 Fixtures `/world-cup-2026/fixtures`
**File:** `src/app/world-cup-2026/fixtures/page.tsx`  
**ISR revalidate:** 900 s  

| Call | Function | KV Key | TTL |
|------|----------|--------|-----|
| Authority feed | `getWCAuthorityMatches()` | (same composite as Hub) | — |

**Authority path:** YES  
**Overlay count:** 3×

---

### 1.5 Group `/world-cup-2026/[group]`
**File:** `src/app/world-cup-2026/[group]/page.tsx`  
**ISR revalidate:** 3600 s  

| Call | Function | KV Key | TTL |
|------|----------|--------|-----|
| Authority feed | `getWCAuthorityMatches()` | (same composite as Hub) | — |
| Standings | `getStandingsCached('WC')` | `goalradar:/competitions/WC/standings` | 1 h fresh / 2 h stale |

**Authority path:** YES  
**Filter:** `m.group === apiGroup`  
**Overlay count:** 3×

---

### 1.6 Match Detail `/match/[id]`
**File:** `src/app/match/[id]/page.tsx`  
**ISR revalidate:** 60 s  

| Call | Function | KV Key | TTL |
|------|----------|--------|-----|
| Snapshot | `getOrBuildMatchSnapshot(id)` | `goalradar:match:{id}` | 7 d (FINISHED) / 6 h (UPCOMING) / never written (LIVE) |
| ↳ DR key | (internal) | `goalradar:dr:match:{id}` | 30 d |
| ↳ Match detail (build path) | `getMatchDetail(id)` | `goalradar:/matches/{id}` | 15 min fresh / 30 min stale |
| ↳ Group matches (build path) | `getRecentMatchesCached('WC')` | `goalradar:/competitions/WC/matches?dateFrom=…&dateTo=…` | 15 min fresh / 30 min stale |
| ↳ Standings (build path) | `getStandingsCached('WC')` | `goalradar:/competitions/WC/standings` | 1 h fresh / 2 h stale |
| ↳ ESPN enrichment (build path) | `enrichMatchWithEspnEvents()` | `goalradar:espn:event:{espnId}` | 12 h |
| ↳ ESPN ID lookup (build path) | `getOrLookupEspnId()` | `goalradar:espn:lookup:{fdId}` | persistent |

**Authority path:** DIFFERENT — uses per-match snapshot, NOT `getWCAuthorityMatchesCached()`  
**Key difference:** Score is sourced from ESPN event data when enrichment succeeds. The snapshot DOES NOT read from the bulk FINISHED feed (`getWCResultsCached()`). It reads `getRecentMatchesCached('WC')` (date-scoped, rotating key) for group context only.

---

## 2. Legacy Pages (bypass authority path entirely)

### 2.1 Matches Today `/world-cup-2026/matches-today`
**File:** `src/app/world-cup-2026/matches-today/page.tsx`  

| Call | Function | KV Key |
|------|----------|--------|
| Finished | `getWCResultsCached()` | `goalradar:/competitions/WC/matches?status=FINISHED` |
| Live | `getWCLiveMatchesCached()` | `goalradar:live:matches:WC` |
| Upcoming | `getUpcomingMatchesCached('WC')` | `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` |

**Authority path:** NO — reads three feeds independently, no STATE_RANK merge  
**Risk:** No duplicate-prevention — same match ID could appear in multiple feeds

---

### 2.2 Predictions `/world-cup-2026-predictions`
**File:** `src/app/world-cup-2026-predictions/page.tsx`  

| Call | Function | KV Key |
|------|----------|--------|
| Upcoming | `getUpcomingMatchesCached('WC')` | `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` |
| Recent | `getRecentMatchesCached('WC')` | `goalradar:/competitions/WC/matches?dateFrom=…&dateTo=…` |

**Authority path:** NO — misses FINISHED feed entirely  
**Risk:** Predictions for already-finished matches may still show as upcoming

---

### 2.3 Matches Tomorrow `/world-cup-2026/matches-tomorrow`
**File:** `src/app/world-cup-2026/matches-tomorrow/page.tsx`  

| Call | Function | KV Key |
|------|----------|--------|
| Upcoming | `getUpcomingMatchesCached('WC')` | `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` |

**Authority path:** NO — SCHEDULED/TIMED only, no FINISHED merge

---

### 2.4 Teams `/world-cup-2026/teams/[slug]`
**File:** `src/app/world-cup-2026/teams/[slug]/page.tsx`  

| Call | Function | KV Key |
|------|----------|--------|
| Upcoming | `getUpcomingMatchesCached('WC')` | `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` |
| Recent | `getRecentMatchesCached('WC')` | date-scoped |

**Authority path:** NO

---

### 2.5 Watch Live `/world-cup-2026/watch-live`
**File:** `src/app/world-cup-2026/watch-live/page.tsx`  

| Call | Function | KV Key |
|------|----------|--------|
| Upcoming | `getUpcomingMatchesCached('WC')` | `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` |

**Authority path:** NO

---

## 3. Triple Overlay Problem (all authority pages)

Every authority-path page request triggers THREE separate calls to `overlayMatchStates()`, each doing a `kv.mget` of up to 104 snapshot keys:

```
getUpcomingMatchesCached('WC')
  └─ overlayMatchStates()            ← overlay #1 (up to 104 mget keys)

getWCResultsCached()
  └─ overlayMatchStates()            ← overlay #2 (up to 104 mget keys)

getWCAuthorityMatchesCached()
  └─ overlayMatchStates()            ← overlay #3 (up to 104 mget keys)
                           ↑
                    REDUNDANT — the input was already overlaid twice
```

The in-memory L1 cache (`withCache`) deduplicates `getUpcomingMatchesCached` and `getWCResultsCached` calls within the same process, but does NOT deduplicate the `kv.mget` inside `overlayMatchStates()`. Each overlay does its own independent batch read from Vercel KV.

**Net effect per Hub ISR render:**
- Up to 312 KV snapshot read operations (3 × 104)
- The third overlay is fully redundant — it re-reads keys the first two overlays already read

---

## 4. Cron / Data Writer Summary

| KV Key | Written by | Interval | TTL |
|--------|-----------|----------|-----|
| `goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED` | `wc-upcoming` cron task | 30 min | 15 min fresh / 30 min stale |
| `goalradar:/competitions/WC/matches?status=FINISHED` | `wc-finished` cron task | 30 min | 15 min fresh / **12 h stale** |
| `goalradar:/competitions/WC/matches` | `wc-all-matches` cron task | 30 min | 6 h fresh / 12 h stale |
| `goalradar:live:matches:WC` | `refreshLiveMatches()` in orchestrator | 30 min (not real-time during non-live) | 30 s |
| `goalradar:match:{id}` | `writeKVSnapshot()` on demand | On page load (KV miss) | 7 d (FINISHED) |
| `goalradar:espn:event:{espnId}` | `enrichMatchWithEspnEvents()` | On page load (KV miss) | 12 h |

---

## 5. Key Divergence

| Page family | Gets live scores? | Gets FINISHED feed? | Gets per-match enrichment? |
|-------------|------------------|--------------------|-----------------------------|
| Hub / Results / Schedule / Fixtures / Group | ✓ via live cache | ✓ via `getWCResultsCached()` | ✓ via snapshot overlay |
| Match Detail | ✓ (separate live-cache read) | ✗ (uses `getRecentMatchesCached`) | ✓ via ESPN enrichment direct |
| matches-today | ✓ | ✓ (but no merge guard) | ✗ no snapshot overlay |
| predictions / tomorrow / teams / watch-live | ✗ | ✗ | ✗ |
