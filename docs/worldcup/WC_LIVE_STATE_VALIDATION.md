# WC Live State Validation

**Task:** WC-LIVE-STATE-CONSISTENCY-AUDIT Phase 5
**Date:** 2026-06-22
**Status:** COMPLETE

---

## Validation Method

Code-level verification of the three diverging surfaces after fix. Production state at time of fix: 0 live matches (between match windows).

---

## Fix Verification by Component

### 1. `WCCountdown.tsx` — schedule page and hub

**State: 0 live matches (liveMatches = [])**

```
hasLive = live.length > 0  →  false
```

| Element | Before fix | After fix |
|---------|-----------|-----------|
| Pulsing red dot | Always shown | `{hasLive && <span ...>}` — hidden |
| Heading text | "FIFA World Cup 2026 is LIVE" | "FIFA World Cup 2026" |
| Subtitle | "USA · Canada · Mexico" | "No matches live right now" |
| CTA label | "View Live Scores →" | "Fixtures & Results →" |
| CTA href | `/live` | `/world-cup-2026` |

**State: 1+ live matches (liveMatches = [match1, ...])**

| Element | Before fix | After fix |
|---------|-----------|-----------|
| Pulsing red dot | Shown | Shown (unchanged) |
| Heading text | "FIFA World Cup 2026 is LIVE" | "FIFA World Cup 2026 is LIVE" (unchanged) |
| Subtitle | Team names or match count | Team names or match count (unchanged) |
| CTA label | "Match Center →" / "View Live Scores →" | Unchanged |

**Verdict: PASS** — red dot and "is LIVE" now gated on actual match data.

---

### 2. `WCCountdownBanner.tsx` — home page top banner

**State: liveCount = 0 (passed from wcLive.length)**

| Element | Before fix | After fix |
|---------|-----------|-----------|
| Pulsing red dot | Always shown | Hidden |
| Banner text | "FIFA World Cup 2026 — LIVE NOW" | "FIFA World Cup 2026 — In Progress" |
| Mobile text | "WC26 LIVE NOW" | "WC26 In Progress" |
| CTA label | "Live scores →" | "Fixtures & Results →" |
| CTA href | `/live` | `/world-cup-2026` |

**State: liveCount > 0**

| Element | Before fix | After fix |
|---------|-----------|-----------|
| Pulsing red dot | Shown | Shown (unchanged) |
| Banner text | "LIVE NOW" | "LIVE NOW" (unchanged) |
| CTA | "Live scores →" → /live | Unchanged |

**Verdict: PASS** — "LIVE NOW" state now correctly gated.

---

### 3. Schedule page — live data wiring

**Before fix:**
```typescript
// No live fetch, no prop passed
{competition === 'WC' && <WCCountdown compact currentPath="/schedule" />}
```

**After fix:**
```typescript
const wcLiveResult = competition === 'WC'
  ? await getWCLiveMatchesCached()
  : { matches: [] as Match[] };

{competition === 'WC' && (
  <WCCountdown compact currentPath="/schedule" liveMatches={wcLiveResult.matches} />
)}
```

`getWCLiveMatchesCached()` reads KV `goalradar:live:matches` — same source as the Live page. Schedule revalidates every 300 s (5 min ISR), so live state lags at most 5 min — acceptable for a non-real-time fixture view.

**Verdict: PASS** — schedule page now passes actual live data to WCCountdown.

---

### 4. Home page — liveCount prop passed to WCCountdownBanner

**Before fix:**
```tsx
<WCCountdownBanner />
```

**After fix:**
```tsx
<WCCountdownBanner liveCount={wcLive.length} />
```

`wcLive` is populated from `getWCLiveMatchesCached()` earlier in the same page render. Home revalidates every 30 s.

**Verdict: PASS** — WCCountdownBanner now receives authoritative live count.

---

## Consistency Check: All Pages After Fix

When `liveCount = 0`:

| Page | Signal | Result |
|------|--------|--------|
| Home — WCCountdownBanner | "WC26 In Progress" (no red dot) | Consistent |
| Home — WCHero | No live section | Consistent |
| Schedule — WCCountdown | "FIFA World Cup 2026" (no red dot) | Consistent |
| Hub — WCCountdown | "FIFA World Cup 2026" (no red dot) | Consistent |
| Live page | "No live matches right now" | Consistent |

When `liveCount > 0`:

| Page | Signal | Result |
|------|--------|--------|
| Home — WCCountdownBanner | "LIVE NOW" pulsing | Consistent |
| Home — WCHero | Live count + match grid | Consistent |
| Schedule — WCCountdown | "is LIVE" pulsing + team names | Consistent |
| Hub — WCCountdown | "is LIVE" pulsing + team names | Consistent |
| Live page | Match list | Consistent |

**All pages now agree on LIVE state for both the live and non-live cases.**

---

## Type Safety Verification

`WCCountdown.liveMatches` type changed from `CanonicalMatch[]` to `Array<Pick<CanonicalMatch, 'id' | 'homeTeam' | 'awayTeam'>>`.

- `CanonicalTeam ≡ Team` (identical structure: `id, name, shortName, tla, crest`)
- `Match` satisfies `Pick<CanonicalMatch, 'id' | 'homeTeam' | 'awayTeam'>` via TypeScript structural typing
- Schedule page passes `Match[]` without cast — accepted by TypeScript
- Hub page passes `CanonicalMatch[]` — still accepted (supertype)
- Home page does not pass `liveMatches` to WCCountdown (uses WCCountdownBanner instead)

**Verdict: PASS** — no type errors introduced.

---

**Phase 5: COMPLETE. All pages consistent. PASS.**
