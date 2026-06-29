# LIVE_CACHE_TRACE.md
## DATA-18WC.LIVE.TRUTH — Phase 4: Cache Trace

---

## 1. Cache Tiers for Live Data

```
Tier    Name             Location                    TTL       Latency
────────────────────────────────────────────────────────────────────────
L1      In-process       cache.ts Map                30s       <1ms
L2      Vercel KV        live-cache.ts KV_KEY        30s       ~10ms
L2-DR   Disaster-Rec.    live-cache.ts DR_KEY        7 days    ~10ms
L3      Provider API     football-data.org            N/A       100-5000ms
ISR     CDN/Vercel       Next.js page cache           varies    <1ms
```

---

## 2. KV Keys

| Key | Content | Fresh TTL | Stale Window | DR TTL |
|-----|---------|-----------|--------------|--------|
| `goalradar:live:matches` | All IN_PLAY/PAUSED matches | 30s | 60s | — |
| `goalradar:dr:live:matches` | Live DR backup | — | — | 7 days |
| `goalradar:authority:v1` | All WC matches (CanonicalMatch[]) | 30s/300s/900s | — | 7 days |
| `goalradar:match:{id}` | Match snapshot (detail+H2H+events) | 7 days | — | 7 days |

---

## 3. Per-Page Cache Stack

### `/live` — Live Scores page
```
ISR:        revalidate = 30s
Page data:  getLiveMatches()
  → L1 (30s) → KV goalradar:live:matches (30s) → API
Max stale:  60s (L2 stale window)
Source:     SSOT ✅
```

### `/` — Home page  
```
ISR:        revalidate = 30s
WC live:    getCurrentLiveMatches()
  → L1 (30s) → KV goalradar:live:matches (30s) → API   [wcLiveBase — correct]
  + wcAuthorityRaw.filter(IN_PLAY|PAUSED)
  → KV goalradar:authority:v1 (up to 5 min)            [liveStrays — VIOLATION ❌]
Max stale:  60s for wcLiveBase, 300s for liveStrays
Source:     MIXED — diverges from SSOT when authority stale
```

### `/world-cup-2026` — Hub page
```
ISR:        revalidate = 30s
WC live:    getCurrentLiveMatches()
  → L1 (30s) → KV goalradar:live:matches (30s) → API
Authority:  getWCAuthorityMatchesV2() — used for schedule/results ONLY
Live gate:  liveMatchIds.has(id) — demotes authority-live to finished correctly
Max stale:  60s
Source:     SSOT ✅
```

### `/schedule` — Schedule page
```
ISR:        revalidate = 300s
WC live:    getCurrentLiveMatches() + getLiveMatchIdSet()
  → L1 (30s) → KV goalradar:live:matches (30s) → API
Live gate:  liveMatchIds.has(id) — SSOT-gated
Max stale:  60s for live data (logic is correct)
Note:       ISR revalidate = 300s means page shell can be 5min old, but live
            list logic inside uses SSOT. LiveRefresher client component handles
            refresh for live matches.
Source:     SSOT ✅ (logic), ISR stale ⚠️ (page shell)
```

### `/world-cup-2026-results` — WC Results page
```
ISR:        revalidate = 300s
WC live:    getLiveMatchIdSet()
  → L1 (30s) → KV goalradar:live:matches (30s) → API
Live gate:  liveMatchIds.has(id) — SSOT-gated
Source:     SSOT ✅ (logic), ISR stale ⚠️ (page shell)
```

### `/world-cup-2026-schedule` — WC Schedule page
```
ISR:        revalidate = 300s
WC live:    getCurrentLiveMatches()
  → L1 (30s) → KV goalradar:live:matches (30s) → API
Source:     SSOT ✅ (logic), ISR stale ⚠️ (page shell)
```

---

## 4. Where Stale Data Appears

### Scenario 1: Match ends — Home shows LIVE, /live shows 0
```
T+0:    Match ends. Provider updates /matches?status=IN_PLAY,PAUSED → removes match.
T+30:   live-cache.ts L1 expires → KV miss → API fetch → match removed from KV.
T+0–5m: authority:v1 still has match with state='live' (authority hasn't been refreshed).
        Home page liveStrays = [match] ← STALE
        /live getLiveMatches() = [] ← FRESH
        Home wcLive = [match] (1 LIVE displayed)
        /live page = 0 LIVE
```
**Root cause**: `liveStrays` adds a match the live-cache has already removed.

### Scenario 2: Match starts — /live shows 1 LIVE, Home shows 0 LIVE  
```
T+0:    Match starts. Provider → IN_PLAY.
T+30:   live-cache.ts hits provider → match added → KV updated.
        /live = [match] (1 LIVE)
T+0–30s: Home ISR cache served from CDN — previous render (no live match).
T+30:   Home ISR revalidates → fresh render → getCurrentLiveMatches() → [match].
        Home = 1 LIVE (now consistent)
```
This is expected ISR behavior — not a bug. 30s ISR revalidate is correct.

### Scenario 3: Authority lags behind live-cache (normal operation)
```
Authority TTL = 30s when live matches exist.
Live cache TTL = 30s.
Both refresh on same cycle — no divergence expected in normal operation.
EXCEPT: authority does NOT update its TTL based on live-cache state.
It uses its own 30s live-tier TTL, written by orchestrator.
If orchestrator hasn't run recently, authority can be stale up to 5min.
```

---

## 5. ISR vs. Live Cache Gap

Pages with `revalidate = 300s` (schedule, results, WC-schedule) serve ISR-cached pages for up to 5 minutes. The live data logic inside those pages uses the SSOT correctly, but the page itself is static until ISR revalidates.

**Mitigation already in place**: `LiveRefresher` client component triggers `router.refresh()` every 30s on these pages when matches are live. This causes Next.js to re-render the server component with fresh data, bypassing ISR stale.

**Status**: These pages are acceptable. The ISR stale is the known trade-off for reduced provider calls on non-live pages.
