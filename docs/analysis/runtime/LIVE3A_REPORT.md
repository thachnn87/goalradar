# LIVE-3A Minute Indicator Authority Report
## GoalRadar · Sprint LIVE-3A

Implemented: 2026-06-15
Audit: `LIVE3A_AUDIT.md`
Scorers audit: `LIVE3B_SCORERS_AUDIT.md`

---

## Problem

Live match cards and the match page score hero showed "LIVE" or "HT" with no
match clock. Users had no indication of how far into a game they were. The raw
API response from football-data.org v4 includes `minute: number` for IN_PLAY/PAUSED
matches; the api-football fallback response includes `elapsed: number | null` in
`fixture.status`. Both fields were unused.

---

## Audit findings (summary)

| Provider | Field | Location | Was used? |
|----------|-------|----------|-----------|
| football-data.org v4 (primary) | `minute` | raw JSON, no mapper → survives KV round-trip | ❌ not typed |
| api-football (secondary) | `elapsed` | `AFFixtureStatus.elapsed: number \| null` | ❌ dropped in `normaliseMatch()` |

**The live KV cache (`goalradar:live:matches`) already contains `minute` at runtime
when the primary provider is active.** No extra provider calls needed.

---

## Changes

### 1. `src/lib/types.ts`

Added `minute?: number | null` to the `Match` interface:

```typescript
/** Live clock minute (IN_PLAY/PAUSED only). Present when primary provider is active. */
minute?: number | null;
```

### 2. `src/lib/providers/api-football.ts`

`normaliseMatch()` now maps `item.fixture.status.elapsed`:

```typescript
minute: item.fixture.status.elapsed ?? null,
```

Ensures minute is populated when the failover provider is active.

### 3. `src/app/api/live-score/[matchId]/route.ts`

Both step 1 (kv-live) and step 2 (live) responses now include `minute`:

```typescript
minute: liveMatch.minute ?? null,
```

Step 3 (snapshot) returns `minute` implicitly via `match.minute` (already
`null`/`undefined` for non-live matches).

### 4. `src/components/MatchLiveZone.tsx`

- Added `initialMinute?: number | null` prop
- Added `minute` state variable, updated from poll responses
- `StatusBadge` now takes `minute` and renders:
  - `IN_PLAY` + `minute = 47` → `47'` with pulsing dot
  - `IN_PLAY` + `minute = null` → `LIVE` (fallback when provider down)
  - `PAUSED` → `HT` (unchanged)
  - `FINISHED` → `FULL TIME` (unchanged)

### 5. `src/components/MatchCard.tsx`

`StatusBadge` now takes `minute?: number | null` and renders the same
`47'` format for `IN_PLAY` cards. Affects all 4 surfaces:
- `/live` page match cards
- `/match/[id]` is covered by `MatchLiveZone` (which also owns the card center slot)
- `/schedule` live cards
- WC Hub live cards

### 6. `src/app/match/[id]/page.tsx`

`MatchLiveZone` call site now passes `initialMinute={match.minute ?? null}`.
First-paint shows correct minute from the SSR snapshot (which gets `minute`
from the live cache overlay added in LIVE-2).

### 7. `src/app/api/debug/live-minute/route.ts` (new)

New endpoint `GET /api/debug/live-minute`. Returns all matches currently in
`goalradar:live:matches` with their `minute` field, score, and team names.
Used to verify minute is populated during live matches without needing to
navigate to the match page.

---

## Authority rule — final

```
minute source priority:
  1. goalradar:live:matches  (liveMatch.minute)       ← football-data.org primary, no mapper
  2. api-football elapsed    (normaliseMatch mapper)   ← failover, now mapped
  3. null                                             ← show "LIVE" text instead
```

No derivation. If `minute` is null (both providers down or in transition), the
UI shows `LIVE` / `HT` without a clock — no invented minute displayed.

---

## Display format

| State | Displayed |
|-------|-----------|
| IN_PLAY, minute = 47 | `● 47'` (pulsing dot + minute) |
| IN_PLAY, minute = null | `● LIVE` (pulsing dot, no clock) |
| PAUSED | `HT` |
| FINISHED | `FULL TIME` |

No `+N` stoppage time notation — football-data.org v4 `minute` increments
naturally through stoppage (e.g. 47 at 45+2'). To render `45+2'` a separate
`injuryTime` field would be required. This is not in scope for LIVE-3A.

---

## What is unchanged

| Concern | Status |
|---------|--------|
| `vercel.json` | not touched |
| KV keys | none added |
| Provider call count | unchanged — minute comes from existing live cache read |
| FINISHED / non-live match display | unchanged — `minute` is null/undefined, badge shows FT/PST etc. |
| `buildSnapshot()` LIVE-2 overlay | unchanged — score/status overlay; minute flows through `match.minute` on the overlaid object |
| `MatchCard` for non-live matches | unchanged — `match.minute` undefined, IN_PLAY branch not reached |

---

## TypeScript

`npx tsc --noEmit` → 0 errors.

---

## Production verification plan

When a WC match is IN_PLAY:

| Check | Expected | Evidence |
|-------|----------|---------|
| `GET /api/debug/live-minute` | `matches[0].minute = N` (non-null) | Confirms primary KV has minute |
| `GET /api/live-score/{id}` | `"minute": N` in response | Endpoint plumbing correct |
| `/live` card for match | Shows `47'` badge instead of `LIVE` | MatchCard UI |
| `/match/{id}` score hero | Shows `47'` on first paint + updates on poll | MatchLiveZone SSR + client |
| `/schedule` live card | Shows `47'` badge | MatchCard UI |
| WC Hub live card | Shows `47'` badge | MatchCard UI |
| Primary down (failover active) | Shows `LIVE` (null minute) | Graceful fallback |

---

## Commit

Pending — see git log.
