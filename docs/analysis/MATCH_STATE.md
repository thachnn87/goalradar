# MATCH_STATE.md
## DATA-18WC.MATCH.TRUTH — Phase 6: Single MatchState Definition

---

## The One State Function

```typescript
// src/app/match/[id]/page.tsx:1496
function deriveMatchPageState(match: MatchDetail): MatchPageState
```

This is the **only** place where match state is derived. It is called twice per page:
1. `page.tsx:2257` — inside `MatchDetailPage` (above-fold)
2. `page.tsx:2308` — alias: `const pageState = deriveMatchPageState(match)`

Both calls receive the same `match` object (from `React.cache()`). Both return the
same state. There is no state divergence possible.

---

## MatchPageState Enum

```typescript
type MatchPageState =
  | 'PROJECTED'   // TBD slot — team not yet determined
  | 'PRE_MATCH'   // SCHEDULED or TIMED — upcoming
  | 'LIVE'        // IN_PLAY or PAUSED — in progress
  | 'QUALIFIED'   // WC match where team has already qualified through (unused currently)
  | 'FINISHED'    // FINISHED — match complete
  | 'CANCELLED';  // CANCELLED, SUSPENDED, POSTPONED
```

---

## derivation Logic (src/app/match/[id]/page.tsx:1496-1530)

```typescript
function deriveMatchPageState(match: MatchDetail): MatchPageState {
  const status = match.status;

  // PROJECTED: one or both teams are TBD
  if (match.homeTeam.id === 0 || match.awayTeam.id === 0)  return 'PROJECTED';

  // CANCELLED: terminal non-result states
  if (status === 'CANCELLED' || status === 'SUSPENDED' || status === 'POSTPONED')
                                                             return 'CANCELLED';

  // LIVE: active match
  if (status === 'IN_PLAY' || status === 'PAUSED')           return 'LIVE';

  // FINISHED: match completed
  if (status === 'FINISHED')                                 return 'FINISHED';

  // PRE_MATCH: scheduled or timed
  return 'PRE_MATCH';
}
```

---

## State-Driven Rendering

Every conditional branch in the match page routes through `pageState`:

| Condition | Component Shown | Page Location |
|-----------|----------------|--------------|
| `pageState === 'PROJECTED'` | `ProjectedHero` | `page.tsx:2356` |
| `pageState === 'CANCELLED'` | `CancelledHero` | `page.tsx:2358` |
| `pageState === 'LIVE'` | `ScoreHero` + `MatchLiveZone` (centerSlot) | `page.tsx:2361` |
| `pageState === 'FINISHED'` | `ScoreHero` (static score) | `page.tsx:2361` |
| `pageState === 'PRE_MATCH'` | `ScoreHero` (status pill, no score) | `page.tsx:2361` |

FAQs, narrative, and JSON-LD also branch on `pageState` / `match.status`.

---

## MatchLiveZone Internal State

`MatchLiveZone` maintains its own `status` state (React `useState`). This is NOT
a separate page state — it is an internal live-update mechanism:

```typescript
const [status, setStatus] = useState<MatchStatus>(initialStatus);
```

When polling detects `status === 'FINISHED'`, MatchLiveZone:
1. Sets its internal status to FINISHED
2. Stops polling (`setPolling(false)`)
3. Displays final score

The component does NOT update `pageState` — the page state is derived server-side
from `snapshot.match.status`. When the match finishes, the next ISR revalidation
will set `pageState = 'FINISHED'` and the page will render `ScoreHero` without
MatchLiveZone on the next load.

This is correct — MatchLiveZone handles the transition from live→finished
**within a single session** without requiring a full page reload.

---

## classifyMatchState vs. deriveMatchPageState

These are two different functions for two different purposes:

| Function | Location | Purpose |
|----------|----------|---------|
| `classifyMatchState(match, today)` | `match-classify.ts` | Returns display bucket for match lists/cards: 'live', 'finished', 'upcoming', etc. |
| `deriveMatchPageState(match)` | `page.tsx:1496` | Returns page render state for the match DETAIL page |

`classifyMatchState` is used by schedule/results/hub pages to categorize matches in lists.
`deriveMatchPageState` is used only by the match detail page to control rendering.

They have different return types and different purposes. Neither overrides the other.

---

## State Consistency Verdict

| Check | Status |
|-------|--------|
| One state derivation function | ✅ `deriveMatchPageState()` |
| Same state across above-fold and below-fold | ✅ Same `match` object → same result |
| No page component derives its own state | ✅ All branch on `pageState` variable |
| MatchLiveZone internal state is isolated | ✅ Does not affect pageState |
| State drives rendering (not rendering drives state) | ✅ Derived before render tree |
