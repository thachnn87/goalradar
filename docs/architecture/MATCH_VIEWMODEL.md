# MATCH_VIEWMODEL.md
## DATA-18WC.MATCH.TRUTH — Phase 5: Single ViewModel Audit

---

## Finding: No Separate MatchViewModel Exists

A search across the entire codebase for `MatchViewModel` returns zero results.
There is no ViewModel layer between the data model and the UI components.

`MatchDetail` — the `match` field of `MatchSnapshot` — is the ViewModel.

---

## MatchDetail Is the ViewModel

```typescript
type MatchDetail extends Match {
  goals:          GoalEvent[];
  bookings:       BookingEvent[];
  substitutions:  SubstitutionEvent[];
  lineups?:       Lineup;
  venue:          string | null;
  referees:       Referee[];
}

type Match = {
  id:          number;
  utcDate:     string;
  status:      MatchStatus;  // 'SCHEDULED'|'TIMED'|'IN_PLAY'|'PAUSED'|'FINISHED'|'CANCELLED'|...
  matchday:    number | null;
  stage:       string | null;
  minute:      number | null;
  score:       Score;
  homeTeam:    Team;
  awayTeam:    Team;
  competition: Competition | null;
  // ...
};
```

Every field a component needs to render the match page is present in this object.
No transformation, mapping, or adapter step exists between the raw API response
and the component render.

---

## The Snapshot as Container

`MatchSnapshot` holds the ViewModel plus its related datasets:

```typescript
type MatchSnapshot = {
  match:          MatchDetail;        // THE VIEW MODEL
  headToHead:     HeadToHead | null;  // related — H2H section
  standings:      StandingEntry[] | null;  // related — standings section
  wcGroupMatches: Match[] | null;     // related — WC group section
  wcAllMatches:   Match[] | null;     // related — bracket context
  generatedAt:    string;
};
```

The related datasets (`headToHead`, `standings`, `wcGroupMatches`) are fetched
concurrently with the match data and bundled for one-shot delivery to all
Suspense boundaries. They do not duplicate `match` — they are separate data
domains that happen to render on the same page.

---

## Why No ViewModel Layer?

The match detail page is a Server Component. Data arrives from `getOrBuildMatchSnapshot`
as a fully formed `MatchDetail` object. The transformation that would normally be a
ViewModel step (status mapping, score formatting, event filtering) is done inline
in the render functions — each component computes only what it needs.

This is idiomatic for Next.js App Router Server Components. A ViewModel class
would add a mapping step with no benefit in this architecture.

---

## Adapter Functions — Not ViewModels

Three helper functions transform data but are NOT ViewModels:

| Function | Location | What It Does |
|----------|----------|-------------|
| `deriveMatchPageState(match)` | `page.tsx:1496` | Derives page state enum from status |
| `buildStoryContext(match)` | `match-story-engine.ts` | Builds story context for narrative |
| `buildFaqs(match, h2h)` | `page.tsx:1898` | Generates FAQ schema |

These are pure functions that read from `MatchDetail` and return derived values.
They do not mutate the match object. They are called once per page render.

---

## MatchLiveZone — Client State, Not a ViewModel

`MatchLiveZone` holds React state for:
- `status`: current match status (initialized from `match.status`)
- `score`: current score (initialized from `match.score`)
- `minute`: current minute (initialized from `match.minute`)

This state exists because the component polls a live endpoint every 30s.
It is NOT a ViewModel — it is a client-side live update mechanism.

It does not hold goals, events, or any other match data. It owns only the
three live-updating fields: status, score, minute.

---

## The One Rule

> There MUST be exactly one live MatchDetail object per page render.
> That object is `snapshot.match`.
> No component may construct, copy, or independently fetch a MatchDetail.

Enforcement: `React.cache()` on `getOrBuildMatchSnapshot` guarantees a single
object reference per request. Components do not call any data-fetching function
that returns a MatchDetail — they receive it as a prop.

---

## Compliance Check

| Check | Status | Evidence |
|-------|--------|---------|
| No MatchViewModel type | ✅ | Zero results for `MatchViewModel` in codebase |
| One MatchDetail per render | ✅ | React.cache() on getOrBuildMatchSnapshot |
| No component fetches MatchDetail | ✅ | All components receive match as prop |
| No score transformation layer | ✅ | Components read score.fullTime.home directly |
| No duplicate match objects | ✅ | Same reference passed through all Suspense boundaries |
