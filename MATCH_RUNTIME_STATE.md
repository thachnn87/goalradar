# MATCH_RUNTIME_STATE.md
## DATA-18WC.RUNTIME.TRUTH — Phase 2: ONE MATCHSTATE

---

## MatchRuntimeState

```typescript
// src/lib/match-runtime-state.ts

export interface MatchRuntimeState {
  match:          MatchDetail;      // THE canonical match object
  version:        number;           // Unix seconds from snapshot.generatedAt
  timestamp:      number;           // epoch-ms from snapshot.generatedAt
  pageState:      MatchPageState;   // pre-derived, never re-call deriveMatchPageState()
  storyContext:   StoryContext;     // pre-derived, never re-call buildStoryContext()
  headToHead:     HeadToHead | null;
  standings:      MatchSnapshot['standings'];
  wcGroupMatches: Match[] | null;
  wcAllMatches:   Match[] | null;
  generatedAt:    number;           // epoch-ms (same as timestamp, for debugging)
}
```

---

## Derivation

```typescript
// src/lib/match-runtime-state.ts
export function deriveRuntimeState(snapshot: MatchSnapshot): MatchRuntimeState
```

Called **exactly once** per request at the top of `MatchDetailPage`.

```typescript
// page.tsx (after snapshot fetch)
const runtimeState = deriveRuntimeState(snapshot);
const match        = runtimeState.match;       // ← use this everywhere
const pageState    = runtimeState.pageState;   // ← pre-derived, not re-called
const matchVersion = runtimeState.version;     // ← embedded in HTML
```

---

## Rule: Every Component Reads from MatchRuntimeState

No component may call `deriveMatchPageState()` directly.
No component may call `buildStoryContext()` directly.
Both are pre-computed in `deriveRuntimeState()` and available on the state object.

---

## The Four Pre-Computations

| Computation | Location Before | Location After |
|-------------|----------------|---------------|
| `deriveMatchPageState(match)` | Called 3× in page.tsx | Called once in `deriveRuntimeState()` |
| `buildStoryContext(match)` | Called inside `buildStoryReport()` each render | Called once in `deriveRuntimeState()` |
| version derivation | Did not exist | `Math.floor(snapshot.generatedAt / 1000)` |
| timestamp | `snapshot.generatedAt` (epoch-ms) | `runtimeState.timestamp` |

---

## Version Tracking

`runtimeState.version` is a Unix second timestamp derived from when the snapshot was built:

```typescript
version = Math.floor(snapshot.generatedAt / 1000)
```

This value:
- Is embedded in HTML as `data-match-version={matchVersion}` on the page container
- Is passed to `MatchLiveZone` as `initialVersion={matchVersion}`
- Advances only when ISR revalidates or orchestrator forces revalidation
- Can be compared to `data-live-version` (set by MatchLiveZone after polling) to detect staleness

---

## MatchLiveZone — Client Version Tracking

`MatchLiveZone` receives `initialVersion` and tracks live version updates:

```typescript
// MatchLiveZone.tsx
const [liveVersion, setLiveVersion] = useState<number>(initialVersion ?? 0);

// On each successful poll with lastUpdated:
const v = Math.floor(new Date(data.lastUpdated).getTime() / 1000);
if (v > 0) setLiveVersion(v);
```

The component renders:
```tsx
<div data-live-version={liveVersion || undefined}>
  ...score/status/minute...
</div>
```

---

## Version Comparison

```
data-match-version = 1750000000   (server render from snapshot at T+0)
data-live-version  = 1750000035   (after poll at T+35 returned new data)

Difference = 35s → client is 35s ahead of server render.
This is expected during LIVE play.
```

When `data-live-version > data-match-version`: client has newer data (normal for LIVE).
When `data-live-version < data-match-version`: impossible (polling returns fresh data).
When equal: client and server are on the same version (match not live, or just revalidated).

---

## Files Changed in Phase 2

| File | Change |
|------|--------|
| `src/lib/match-runtime-state.ts` | NEW — MatchRuntimeState type + deriveRuntimeState() |
| `src/lib/match-page-state.ts` | NEW — MatchPageState type + deriveMatchPageState() (moved from page.tsx) |
| `src/lib/match-story-engine.ts` | Exported `StoryContext` interface |
| `src/app/match/[id]/page.tsx` | Imports deriveRuntimeState; derives runtimeState once; embeds data-match-version; removed local MatchPageState + deriveMatchPageState |
| `src/components/MatchLiveZone.tsx` | Added initialVersion prop; tracks liveVersion state; renders data-live-version |
