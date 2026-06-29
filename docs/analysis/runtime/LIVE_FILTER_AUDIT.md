# LIVE_FILTER_AUDIT.md
## DATA-18WC.LIVE.TRUTH — Phase 3: Live Filter Audit

---

## 1. All Live Filter Implementations Found

### A. `classifyMatchState()` — CANONICAL (use this)
**`src/lib/match-classify.ts:27`**
```typescript
if (match.state === 'live')                    return 'live'; // CanonicalMatch path
if (s === 'IN_PLAY' || s === 'PAUSED')        return 'live'; // Match.status path
```
Callers: Hub page, schedule classification.

### B. `isLiveStatus()` — match-snapshot only
**`src/lib/match-snapshot.ts`**
```typescript
function isLiveStatus(status: MatchDetail['status']): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED';
}
```
Callers: Snapshot cache bypass logic — **not exposed to pages**. Correct scope.

### C. `getMatchTier()` — rate-safe refresh priority
**`src/lib/rate-safe.ts:112`**
```typescript
if (match.status === 'IN_PLAY' || match.status === 'PAUSED') return 'live';
```
Callers: Refresh scheduler — **not exposed to pages**. Correct scope.

### D. `MatchCard.isLive` — UI display only
**`src/components/MatchCard.tsx:156`**
```typescript
const isLive = status === 'IN_PLAY' || status === 'PAUSED';
```
Only affects CSS styling (pulsing dot). Does not influence which matches appear in lists. Correct scope.

### E. `MatchLiveZone.LIVE_STATUSES` — polling trigger
**`src/components/MatchLiveZone.tsx:11`**
```typescript
const LIVE_STATUSES: MatchStatus[] = ['IN_PLAY', 'PAUSED'];
```
Determines whether client-side polling starts. **Not a live match filter for listing purposes.** Correct scope.

### F. `KnockoutJourney.isLive` — UI node state
**`src/components/KnockoutJourney.tsx:88`**
```typescript
const isLive = match?.status === 'IN_PLAY' || match?.status === 'PAUSED';
```
Renders pulsing dot on current match node. Not a listing filter. Correct scope.

### G. `liveStrays` — HOME PAGE VIOLATION ❌
**`src/app/page.tsx:604`**
```typescript
const liveStrays = wcAuthorityRaw.filter((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');
const wcLive: Match[] = dedupById([...wcLiveBase, ...liveStrays]); // line 612
```
**This is the only live filter violation.** The home page derives live matches from two sources:
1. `wcLiveBase` from live-cache (30s TTL) ← correct
2. `liveStrays` from authority (5-min TTL) ← incorrect

This causes home page `liveCount` to diverge from the SSOT.

### H. `authority coldRebuild liveFilter` — authority cache internal
**`src/lib/authority-cache.ts`** (inside `coldRebuild`)
```typescript
const hasLive = matches.some(m => m.state === 'live');
```
Determines TTL tier for the authority payload. Internal only — never returns to pages.

### I. `wc-live-ssot.ts` — SSOT gate (the correct approach)
**`src/lib/wc-live-ssot.ts`** + WC Hub `src/app/world-cup-2026/page.tsx:346`
```typescript
// Hub correctly gates authority-live through SSOT:
const overrideState = (m: CanonicalMatch) =>
  liveMatchIds.has(m.id) ? 'live' : classify(m) === 'live' ? 'finished' : classify(m);
```
Authority matches marked `live` but absent from `liveMatchIds` are demoted to `finished`. This is the pattern all pages should follow.

---

## 2. Filter Summary

| Location | Filter | Purpose | Correct? |
|----------|--------|---------|---------|
| `match-classify.ts:44` | `IN_PLAY\|PAUSED` | Display bucket | ✅ Canonical |
| `match-snapshot.ts` | `IN_PLAY\|PAUSED` | Snapshot cache skip | ✅ Internal only |
| `rate-safe.ts:112` | `IN_PLAY\|PAUSED` | Refresh tier | ✅ Internal only |
| `MatchCard.tsx:156` | `IN_PLAY\|PAUSED` | CSS styling | ✅ UI display only |
| `MatchLiveZone.tsx:11` | `IN_PLAY\|PAUSED` | Polling trigger | ✅ UI component only |
| `KnockoutJourney.tsx:88` | `IN_PLAY\|PAUSED` | Node dot color | ✅ UI display only |
| **`page.tsx:604`** | **`IN_PLAY\|PAUSED` on authority** | **Live count & list** | **❌ VIOLATION** |
| `wc-live-ssot.ts` | `liveMatchIds.has(id)` | Authoritative live set | ✅ SSOT |

---

## 3. Required Action

**Collapse to ONE implementation for live match listing.**

The SSOT pattern in `wc-live-ssot.ts` is correct. Every page that shows a live match count or list must derive it exclusively from `getCurrentLiveMatches()` or `getLiveMatchIdSet()`.

The `liveStrays` filter in `src/app/page.tsx:604` must be removed. See ROOT_CAUSE.md and Phase 8 repair.
