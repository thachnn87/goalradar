# WC Live State Root Cause Analysis

**Task:** WC-LIVE-STATE-CONSISTENCY-AUDIT Phase 3
**Date:** 2026-06-22
**Status:** COMPLETE

---

## Root Cause

### Primary cause: WCCountdown uses date-range for "is LIVE" state

**Location:** `src/components/WCCountdown.tsx:92`

```typescript
const isLive = now >= openingMs && now <= tournamentEndMs;
```

This evaluates to `true` for the entire period 2026-06-11 → 2026-07-19 (38 days), regardless of whether any match is currently in play.

When `isLive === true`, the component renders:
- A pulsing red dot
- "FIFA World Cup 2026 is LIVE" heading text
- Subtitle: "USA · Canada · Mexico" (static fallback when `live.length === 0`)

The `liveMatches` prop on `WCCountdown` only affects the **CTA routing** (single match → Match Center, multiple → /live) and the subtitle text when matches are present. The pulsing red dot and "is LIVE" label were unconditionally shown whenever `isLive` was true.

### Contributing cause 1: Schedule page passes no `liveMatches` to WCCountdown

**Location:** `src/app/schedule/page.tsx:244` (pre-fix)

```tsx
{competition === 'WC' && <WCCountdown compact currentPath="/schedule" />}
```

The `liveMatches` prop was omitted. This meant `live = liveMatches ?? []` always returned `[]`. Even if the component had been fixed to gate on `live.length > 0`, it still would have shown the wrong state because no data was passed.

Comment on that line read:
```
{/* LIVE-2: no live data fetched on this page — CTA defaults to /live */}
```

This was a known gap — live data fetching was deferred and never added.

### Contributing cause 2: WCCountdownBanner has no live data wiring

**Location:** `src/components/WCCountdownBanner.tsx:60` (pre-fix)

```tsx
export default function WCCountdownBanner() {
```

No props. Shows "LIVE NOW" purely from date check. The Home page (`page.tsx`) already fetches `getWCLiveMatchesCached()` and stores the result in `wcLive`, but this data was never passed to `WCCountdownBanner`.

---

## Symptom Trace

```
User visits Home page
  → WCCountdownBanner: now >= openingMs → "🔴 FIFA World Cup 2026 — LIVE NOW"
  → WCHero: wcLive.length === 0 → no live section shown

User visits /schedule?competition=WC
  → WCCountdown: isLive = true, live = [] → "🔴 FIFA World Cup 2026 is LIVE"
                                           → subtitle: "USA · Canada · Mexico"
                                           → CTA: "View Live Scores →" → /live

User visits /live
  → getLiveMatches() → KV goalradar:live:matches → 0 matches
  → "No live matches right now"
```

Result: Home and Schedule showed LIVE indicators while Live page showed none. All three can be correct simultaneously only when matches are in play — between matches (the majority of the day), they were contradictory.

---

## Why This Is Misleading

During WC 2026, each match day has 4–6 matches averaging ~2h each. Live windows total roughly 8–12 hours per day. The remaining 12–16 hours, the date-based `isLive` check returns `true` while zero matches are in play. The pulsing red dot and "is LIVE" label create a false urgency that drives users to `/live` only to find "No live matches right now."

---

## Fix Summary

| Component | Fix |
|-----------|-----|
| `WCCountdown.tsx` | Gate pulsing red dot and "is LIVE" text on `liveMatches.length > 0`. When no live matches: show "FIFA World Cup 2026" (no red dot), subtitle "No matches live right now", CTA "Fixtures & Results →" |
| `WCCountdownBanner.tsx` | Accept `liveCount?: number` prop. Show pulsing "LIVE NOW" only when `liveCount > 0`. When `liveCount === 0`: show "⚽ WC26 In Progress", CTA "Fixtures & Results →" |
| `src/app/page.tsx` | Pass `liveCount={wcLive.length}` to `<WCCountdownBanner>` |
| `src/app/schedule/page.tsx` | Add `getWCLiveMatchesCached()` fetch, pass `liveMatches={wcLiveResult.matches}` to `<WCCountdown>` |

**Single source of truth after fix:** `getWCLiveMatchesCached()` (KV `goalradar:live:matches`) for all live-state signals on Home and Schedule. Hub continues to use authority cache filtered live matches (functionally equivalent — same data written by same orchestrator run).

---

**Phase 3: COMPLETE. Root cause confirmed. Fix implemented.**
