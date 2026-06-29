# LIVE_VIEWMODEL.md
## DATA-18WC.LIVE.TRUTH — Phase 5: One Live ViewModel

---

## 1. The Existing SSOT (Single Source of Truth)

The codebase already has a correct SSOT module: **`src/lib/wc-live-ssot.ts`**

```typescript
// Two exports — both read KV goalradar:live:matches (30s TTL)
getCurrentLiveMatches(): Promise<Match[]>   // WC live list
getLiveMatchIdSet(): Promise<Set<number>>   // WC live IDs for gating
```

All pages MUST derive live state from one of these two functions.

---

## 2. Current Compliance by Surface

| Surface | Function Used | Live Count Source | Compliant? |
|---------|--------------|-------------------|-----------|
| Home (`/`) | `getCurrentLiveMatches()` + `liveStrays` | SSOT + authority filter | ❌ |
| Hub (`/world-cup-2026`) | `getCurrentLiveMatches()` | SSOT only | ✅ |
| `/live` | `getLiveMatches()` | SSOT (same KV key) | ✅ |
| Schedule (`/schedule`) | `getLiveMatchIdSet()` + `getCurrentLiveMatches()` | SSOT | ✅ |
| WC Results | `getLiveMatchIdSet()` | SSOT | ✅ |
| WC Schedule | `getCurrentLiveMatches()` | SSOT | ✅ |
| Group pages | None (no live badge shown) | N/A | ✅ |
| WCCountdownBanner | Receives `liveCount` prop from parent | Inherits parent | Depends on parent |
| WCCountdown | Receives `liveMatches` prop from parent | Inherits parent | Depends on parent |
| Story Engine | No live data | N/A | ✅ |
| Simulator | No live data | N/A | ✅ |

---

## 3. Required LiveViewModel Contract

Every surface that shows a live match count or live match list MUST read:

```typescript
// Option A: full list (for rendering match cards)
const liveMatches: Match[] = await getCurrentLiveMatches();
// → src/lib/wc-live-ssot.ts

// Option B: ID set (for gating authority matches)
const liveMatchIds: Set<number> = await getLiveMatchIdSet();
// → src/lib/wc-live-ssot.ts

// Option C: All-competition live (for /live page)
const { matches } = await getLiveMatches();
// → src/lib/api.ts (routes through same KV key)
```

**Never allowed:**
```typescript
// ❌ Filter authority by status
wcAuthorityRaw.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED')

// ❌ Filter authority by state
wcAuthorityRaw.filter(m => m.state === 'live')

// ❌ classifyMatchState() as live source (use as display bucket only)
wcAuthorityRaw.filter(m => classifyMatchState(m, today) === 'live')
```

---

## 4. The Hub's Correct Pattern (Model for All Pages)

**`src/app/world-cup-2026/page.tsx:339–346`**
```typescript
// WC-LIVE-SSOT: live comes from the live-cache KV (allLive), not authority filtering.
const allLive: Match[] = liveResult.status === 'fulfilled' ? liveResult.value : [];
const liveMatchIds = new Set(allLive.map((m) => m.id));
// DATA-18B.3E: a match the authority cache still marks live but that the live
// SSOT doesn't know about has already ended — demote to finished.
const overrideState = (m: CanonicalMatch) =>
  liveMatchIds.has(m.id) ? 'live' : classify(m) === 'live' ? 'finished' : classify(m);
```

This pattern:
1. Gets live IDs from SSOT (30s KV)
2. Uses authority matches for schedule/results data only
3. Demotes authority-live → finished when not in SSOT
4. Never adds authority matches to the live set

---

## 5. Post-Fix State

After the Phase 8 repair (removing `liveStrays` from home page):

| Surface | Live Source | Agreement with /live |
|---------|------------|---------------------|
| `/live` | `getLiveMatches()` → KV | ← baseline |
| Home (`/`) | `getCurrentLiveMatches()` → same KV | ✅ identical |
| Hub | `getCurrentLiveMatches()` → same KV | ✅ identical |
| Schedule | `getLiveMatchIdSet()` → same KV | ✅ identical |
| WC Results | `getLiveMatchIdSet()` → same KV | ✅ identical |
| WC Schedule | `getCurrentLiveMatches()` → same KV | ✅ identical |

All six surfaces read from the single KV key `goalradar:live:matches`. Divergence is impossible.
