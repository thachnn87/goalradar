# MATCH_DATASET_AUDIT.md
## DATA-18WC.RUNTIME.TRUTH — Phase 1: ONE DATASET

---

## Audit Result: ONE DATASET — CONFIRMED

There is exactly one function that produces a match dataset for the match detail page:

```typescript
getOrBuildMatchSnapshot(id: string | number): Promise<MatchSnapshot>
// src/lib/match-snapshot.ts — wrapped with React.cache()
```

Every data consumer in the page traces back to this single call.

---

## Field Origin Trace

For each field the sprint specifies, the origin is verified:

### score

```
snapshot.match.score.fullTime.{ home | away }
snapshot.match.score.halfTime.{ home | away }
snapshot.match.score.winner
snapshot.match.score.duration
```

No component derives score independently. MatchLiveZone initializes from
`initialScore={match.score}` (same object) and later updates via polling — but
its rendered score is the ONLY score visible on screen during LIVE matches
(centerSlot ?? pattern prevents double-render).

**Origin: ONE** ✅

### minute

```
snapshot.match.minute
```

Only MatchLiveZone renders the match minute (as `{minute}'` in StatusBadge).
Initialized from `initialMinute={match.minute ?? null}`.

**Origin: ONE** ✅

### status

```
snapshot.match.status
```

Used by `deriveMatchPageState()` for page rendering decisions.
Used by MatchLiveZone to control polling lifecycle.
Both initialize from the same snapshot field.

**Origin: ONE** ✅

### goals

```
snapshot.match.goals[]
```

Sourced from football-data.org provider, enriched by ESPN/API-Football for FINISHED
WC matches with empty events (Source 8 in priority chain). No second source.

Rendered by: MatchTimeline, buildFaqs (FINISHED only), buildStoryContext.
All receive the same `match` object.

**Origin: ONE** ✅

### cards (bookings)

```
snapshot.match.bookings[]
```

Sourced from football-data.org only. No enrichment. No client update.

**Origin: ONE** ✅

### substitutions

```
snapshot.match.substitutions[]
```

Sourced from football-data.org only.

**Origin: ONE** ✅

### lineups

```
snapshot.match.lineups    (optional — may be null/undefined)
```

Sourced from football-data.org. Available ~1hr before kick-off.
Rendered conditionally in BelowTheFoldDeferred.

**Origin: ONE** ✅

### statistics

```
Computed in page.tsx:667 from snapshot.match events
```

The page has a statistics section that computes totals from goals/bookings/subs arrays.
All inputs come from `snapshot.match`. No separate statistics API call.
Comment: "API free tier only" — some fields may be absent depending on provider tier.

**Origin: ONE** ✅

### venue

```
snapshot.match.venue    (string | null)
```

Set by football-data.org provider. Rendered in ScoreHero meta line, JsonLd Place schema,
buildFaqs "where is the match being played?" answer.

**Origin: ONE** ✅

### referee

```
snapshot.match.referees[]    (Referee[])
```

Set by football-data.org provider. Rendered in ScoreHero meta line.
The main referee: `match.referees?.find(r => r.type === 'REFEREE') ?? match.referees?.[0]`

**Origin: ONE** ✅

### attendance

```
NOT PRESENT in MatchDetail type
```

`attendance` is not a field in the current MatchDetail or Match types. It is not
rendered anywhere on the match page. This field does not exist in the system.

**Origin: N/A — field absent** ⚠️ (future: add to MatchDetail if provider exposes it)

### formations

```
snapshot.match.lineups.homeTeam.formation    (string | null)
snapshot.match.lineups.awayTeam.formation    (string | null)
```

Derived from `snapshot.match.lineups`. Rendered in lineup section.

**Origin: ONE** ✅

---

## No Component Creates a Match Object

Search results for functions that could create a second match object:

| Pattern | Result |
|---------|--------|
| `new MatchDetail` | 0 results |
| `MatchViewModel` | 0 results |
| `const match = {` (constructing) | 0 in server components |
| `getMatchById(` | 0 results |
| `fetchMatch(` | 0 results (only `getOrBuildMatchSnapshot` exists) |
| `assembleSnapshot(` | Only inside `match-snapshot.ts` — not called from page |

**No component constructs a parallel match object** ✅

---

## No Adapter / Mapper / Duplicate Fetch

| Pattern | Result |
|---------|--------|
| Adapter functions | None found |
| Mapper functions | None found |
| `toMatchDetail(` | 0 results |
| `mapMatch(` | 0 results |
| Second call to provider inside page | 0 results |

The only transformation functions are:
- `deriveMatchPageState(match)` — derives a state enum, does not create a new match object
- `buildStoryContext(match)` — builds a StoryContext, does not create a new match object
- `buildFaqs(match, h2h)` — generates FAQ text, does not create a new match object

None of these create a second MatchDetail.

---

## ONE DATASET Invariants

1. ✅ `getOrBuildMatchSnapshot(id)` is the single dataset entry point
2. ✅ `React.cache()` ensures one fetch per request — no duplicate provider calls
3. ✅ No component constructs or fetches a MatchDetail independently
4. ✅ All fields trace to `snapshot.match.*`
5. ✅ Score, status, minute: owned by MatchLiveZone for LIVE display, but initialized from snapshot
6. ⚠️ `attendance` field is absent from the data model (not a bug — provider doesn't expose it)

---

## Gap: MatchSnapshot → MatchRuntimeState

Currently, components receive `snapshot.match: MatchDetail` directly as props.
There is no `MatchRuntimeState` wrapper that adds runtime context (version, pageState, storyContext).

This means:
- `pageState` is derived independently in two places (lines 2257, 2308 in page.tsx — same function, same result)
- `storyContext` is built inside `buildStoryReport` every call (not pre-computed and cached)
- No version is attached to the snapshot

**Resolution**: Phase 2 introduces `MatchRuntimeState` to formalize this.
