# COMPONENT_RUNTIME_GRAPH.md
## DATA-18WC.RUNTIME.TRUTH — Phase 0: Component Runtime Graph

---

## Component Tree with Data Sources

```
MatchDetailPage  [SERVER]
│   Source: getOrBuildMatchSnapshot(id) → snapshot
│   Derives: pageState = deriveMatchPageState(snapshot.match)
│   Derives: isWC = snapshot.match.competition?.code === 'WC'
│
├── <head> — generateMetadata()  [SERVER]
│   │   Source: snapshot.match
│   │   Fields: status, score, homeTeam, awayTeam, utcDate, venue, competition
│   │   Update: ISR Clock (60s)
│   │   Version: snapshot.generatedAt (not embedded in <head>)
│   └── <title>, OG meta, Twitter cards
│
├── <JsonLd match={match}>  [SERVER]
│   │   Source: snapshot.match
│   │   Fields: status, score (FINISHED only), teams, venue, competition, utcDate
│   │   Update: ISR Clock (60s)
│   └── <script type="application/ld+json">
│
├── <MatchFaqJsonLd faqs={buildFaqs(match, null)}>  [SERVER]
│   │   Source: snapshot.match (via buildFaqs)
│   │   Fields: status, score (FINISHED only), goals, venue, competition, teams
│   │   Update: ISR Clock (60s)
│   └── <script type="application/ld+json">
│
├── [pageState === 'PROJECTED'] <ProjectedHero match={match}>  [SERVER]
│   │   Source: snapshot.match
│   └── Renders TBD slot hero
│
├── [pageState === 'CANCELLED'] <CancelledHero match={match}>  [SERVER]
│   │   Source: snapshot.match
│   └── Renders cancelled match notice
│
├── [pageState ∈ LIVE|PRE_MATCH|FINISHED] <ScoreHero match={match} centerSlot={...}>  [SERVER]
│   │   Source: snapshot.match
│   │   Fields: score (non-LIVE), status, teams, competition, utcDate, referees
│   │
│   └── centerSlot:
│       ├── [pageState ≠ LIVE]: undefined → ScoreHero renders static score
│       │   Source: match.score.fullTime.home/away
│       │   Update: ISR Clock (60s)
│       │
│       └── [pageState = LIVE]: <MatchLiveZone ...>  [CLIENT ← hydrated]
│               │   Props: matchId, initialScore, initialStatus, initialMinute
│               │   Initial source: snapshot.match (same as SSR)
│               │   Runtime source: /api/live-score/{matchId} every 30s
│               │
│               ├── state: score  (useState, initialized from snapshot.match.score)
│               ├── state: status (useState, initialized from snapshot.match.status)
│               ├── state: minute (useState, initialized from snapshot.match.minute)
│               │
│               ├── setInterval(1s) countdown → poll() every 30s
│               │   → GET /api/live-score/{matchId}
│               │   → setScore, setStatus, setMinute on response
│               │
│               ├── <StatusBadge status={status} minute={minute}>  renders live badge
│               └── score.fullTime.home/away                        renders live score
│
├── <WCAboveFoldCTA matchId={match.id}>  [SERVER/CLIENT]
│   │   Source: matchId only (match.id)
│   └── CTA widget — no match data dependency
│
├── <AdSlot slotId="match-top">  [CLIENT]
│   └── No match data
│
└── <Suspense fallback={<BelowFoldSkeleton />}>
    └── <BelowTheFoldDeferred matchId={numericId}>  [SERVER, streams]
        │   Source: getOrBuildMatchSnapshot(id) → React.cache() SAME promise
        │   Derives: pageState, storyCards, sections, faqs
        │
        ├── <StoryCardStrip cards={buildStoryCards(match)}>  [SERVER]
        │   Source: snapshot.match
        │
        ├── Story sections (buildStoryReport)  [SERVER]
        │   │   Source: snapshot.match via buildStoryContext
        │   └── <section> elements: Introduction, First Half, etc.
        │
        ├── <MatchTimeline match={match}>  [SERVER]
        │   │   Source: snapshot.match
        │   │   Fields: goals[], bookings[], substitutions[], score
        │   └── Chronological event list
        │
        ├── <MatchSummary match={match}>  [SERVER]
        │   │   Source: snapshot.match
        │   └── Score summary, match info
        │
        ├── <Suspense> → <WCGroupSectionDeferred>  [SERVER, streams]
        │   │   Source: snapshot.wcGroupMatches, snapshot.match.homeTeam/awayTeam
        │   └── Group standings + fixtures
        │
        ├── <Suspense> → <HeadToHeadDeferred>  [SERVER, streams]
        │   │   Source: snapshot.headToHead
        │   └── H2H history matches
        │
        ├── Lineup section (conditional)  [SERVER]
        │   │   Source: snapshot.match.lineups
        │   └── Starting XI + substitutes
        │
        ├── <RoadToFinal match={match}>  [SERVER]
        │   │   Source: snapshot.match (WC only)
        │   └── Knockout bracket path
        │
        ├── FAQ section  [SERVER]
        │   │   Source: buildFaqs(match, h2h) — same as MatchFaqJsonLd above
        │   └── Visible FAQ accordion
        │
        └── <MatchFaqJsonLd faqs={...}>  [SERVER]
            │   Source: snapshot.match (re-built here for below-fold position)
            └── Duplicate? See note below.
```

---

## Data Source per Component

| Component | Type | Data Source | Fields Consumed |
|-----------|------|------------|----------------|
| generateMetadata | Server | snapshot.match | status, score, teams, utcDate, competition, venue |
| JsonLd | Server | snapshot.match | status, score*, teams, competition, venue, utcDate |
| MatchFaqJsonLd (above fold) | Server | buildFaqs(match) | status, score*, goals, venue, competition |
| ProjectedHero | Server | snapshot.match | teams, utcDate |
| CancelledHero | Server | snapshot.match | teams, status |
| ScoreHero | Server | snapshot.match | score†, status, teams, competition, utcDate, referees |
| MatchLiveZone | Client | /api/live-score + React state | score, status, minute |
| WCAboveFoldCTA | Server/Client | match.id only | id |
| BelowTheFoldDeferred | Server | snapshot.match (React.cache) | all fields |
| StoryCardStrip | Server | snapshot.match | goals, status, teams |
| Story sections | Server | snapshot.match via buildStoryContext | all narrative fields |
| MatchTimeline | Server | snapshot.match | goals[], bookings[], substitutions[], score |
| MatchSummary | Server | snapshot.match | score, teams, status |
| WCGroupSectionDeferred | Server | snapshot.wcGroupMatches | match list |
| HeadToHeadDeferred | Server | snapshot.headToHead | H2H matches |
| Lineup section | Server | snapshot.match.lineups | lineups |
| RoadToFinal | Server | snapshot.match | stage, teams (WC only) |

*score field: only consumed if `isFinished`
†score field: only rendered if `centerSlot` is undefined (pageState ≠ LIVE)

---

## Client vs Server Boundary

```
SERVER BOUNDARY:
  Everything above ScoreHero, everything in BelowTheFoldDeferred
  All read from snapshot.match (React.cache, single instance)

CLIENT HYDRATION BOUNDARY:
  MatchLiveZone — hydrates from props (initialScore, initialStatus, initialMinute)
  then polls independently via fetch()

  LocalTime — client-side time display (uses utcDate from props)
  AddToCalendar — uses individual match fields from props
  WCAboveFoldCTA — uses matchId from props
```

---

## Key Observations

1. **One server render, one client island**: Every server component shares the
   same `snapshot.match` object. The only client-side stateful island is `MatchLiveZone`.

2. **`BelowTheFoldDeferred` is server-rendered**: It calls `getOrBuildMatchSnapshot(id)` again
   but React.cache() deduplicates — no second fetch, same object.

3. **No LiveRefresher on match page**: `LiveRefresher` (router.refresh every 30s) is only
   used on the `/live` page. The match page relies on MatchLiveZone polling for live updates,
   NOT on full page ISR refresh.

4. **Two MatchFaqJsonLd instances**: One in the `<head>` area (above fold), one inside
   `BelowTheFoldDeferred`. Both call `buildFaqs(match, null)` from the same match object.
   These are consistent but redundant — Phase 8 should audit for deduplication.
