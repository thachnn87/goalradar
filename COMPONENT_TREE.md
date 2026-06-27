# COMPONENT_TREE.md
## DATA-18WC.RUNTIME.TRUTH — Phase 6: ONE COMPONENT TREE

---

## Rule

Every component receives runtime state.
No component fetches. No component derives. No component transforms.
Only renders.

---

## The Tree

```
MatchDetailPage  [SERVER]
│
│  Input:  numericId (from URL params)
│  Fetch:  getOrBuildMatchSnapshot(numericId)  [React.cache — one fetch]
│  Derive: runtimeState = deriveRuntimeState(snapshot)  [one derivation]
│
│  Props passed down: match, pageState, matchVersion, isWC, faqs, ...
│
├── <MatchNavTelemetry matchId={numericId} />  [CLIENT — no match data]
│
├── <JsonLd match={match} />  [SERVER]
│   Receives: MatchDetail
│   Renders:  SportsEvent JSON-LD
│   Derives:  nothing (reads match fields directly)
│   Fetches:  nothing
│
├── <MatchFaqJsonLd faqs={faqs} />  [SERVER]
│   Receives: Faq[] (pre-built from buildFaqs(match) — derived by page)
│   Renders:  FAQPage JSON-LD
│   Derives:  nothing
│   Fetches:  nothing
│
├── <AnalyticsTracker event={...} />  [CLIENT — discrete props, not full match]
│
└── <div data-match-version={matchVersion} data-match-id={match.id}>
    │
    ├── <Breadcrumb items={buildBreadcrumb(match)} />  [SERVER]
    │   Receives: BreadcrumbItem[] (pre-built by page)
    │   Renders:  breadcrumb nav
    │
    ├── <h1 className="sr-only">...</h1>  [SERVER — inline, no component]
    │
    ├── [pageState === 'PROJECTED']
    │   └── <ProjectedHero match={match} />  [SERVER]
    │       Receives: MatchDetail
    │       Renders:  TBD slot hero
    │
    ├── [pageState === 'CANCELLED']
    │   └── <CancelledHero match={match} />  [SERVER]
    │       Receives: MatchDetail
    │       Renders:  cancelled match notice
    │
    ├── [pageState ∈ LIVE|PRE_MATCH|FINISHED|QUALIFIED]
    │   └── <ScoreHero match={match} centerSlot={...}>  [SERVER]
    │       Receives: MatchDetail + optional centerSlot
    │       Renders:  team crests, competition, score or centerSlot
    │
    │       centerSlot [pageState === 'LIVE']:
    │       └── <MatchLiveZone  [CLIENT]
    │               matchId={String(match.id)}
    │               initialStatus={match.status}
    │               initialScore={match.score}
    │               initialMinute={match.minute ?? null}
    │               initialVersion={matchVersion}
    │           />
    │           Receives: discrete props (not MatchDetail — minimal surface)
    │           Renders:  StatusBadge, score, countdown
    │           Fetches:  /api/live-score/{matchId} every 30s (ONE endpoint)
    │           Derives:  nothing (reads from own React state only)
    │           Emits:    data-live-version attribute
    │
    ├── <WCAboveFoldCTA matchId={match.id} />  [SERVER/CLIENT — id only]
    │
    ├── <AdSlot slotId="match-top" />  [CLIENT — no match data]
    │
    └── <Suspense fallback={<BelowFoldSkeleton />}>
        └── <BelowTheFoldDeferred matchId={numericId}>  [SERVER, streams]
            │
            │  Re-calls getOrBuildMatchSnapshot(numericId)  [React.cache — instant]
            │  Does NOT call deriveRuntimeState() again (acceptable — snapshot is same object)
            │
            ├── <StoryCardStrip cards={buildStoryCards(match)} />  [SERVER]
            │   Receives: StoryCard[] (pre-built)
            │   Renders:  horizontal story chips
            │
            ├── Story report sections  [SERVER — inline render]
            │   Source: buildStoryReport(buildStoryContext(match))
            │   Note: Phase 2 pre-computes storyContext in runtimeState, but
            │         BelowTheFoldDeferred currently re-calls buildStoryContext.
            │         Future: pass runtimeState.storyContext via prop or context.
            │
            ├── <MatchTimeline match={match} />  [SERVER]
            │   Receives: MatchDetail
            │   Renders:  chronological events
            │
            ├── <MatchSummary match={match} />  [SERVER]
            │   Receives: MatchDetail
            │   Renders:  score summary
            │
            ├── <Suspense> → <WCGroupSectionDeferred>  [SERVER, streams]
            │   Receives: wcGroupMatches, match teams
            │
            ├── <Suspense> → <HeadToHeadDeferred>  [SERVER, streams]
            │   Receives: headToHead data
            │
            ├── Lineup section (conditional)  [SERVER]
            │   Source: match.lineups
            │
            ├── <RoadToFinal match={match} />  [SERVER — WC only]
            │
            ├── FAQ section  [SERVER — visible accordion]
            │   Source: buildFaqs(match, h2h)
            │
            └── <MatchFaqJsonLd faqs={...} />  [SERVER]
                Note: Second MatchFaqJsonLd instance (see known issues)
```

---

## Component Compliance Matrix

| Component | Fetches? | Derives? | Transforms? | Only Renders? |
|-----------|---------|---------|------------|--------------|
| JsonLd | NO | NO | NO | ✅ |
| MatchFaqJsonLd | NO | NO | NO | ✅ |
| ProjectedHero | NO | NO | NO | ✅ |
| CancelledHero | NO | NO | NO | ✅ |
| ScoreHero | NO | NO | NO | ✅ |
| MatchLiveZone | YES (/api/live-score) | NO* | NO | OWNER† |
| StoryCardStrip | NO | NO | NO | ✅ |
| MatchTimeline | NO | NO | NO | ✅ |
| MatchSummary | NO | NO | NO | ✅ |
| WCGroupSectionDeferred | NO | NO | NO | ✅ |
| HeadToHeadDeferred | NO | NO | NO | ✅ |
| RoadToFinal | NO | NO | NO | ✅ |
| BelowTheFoldDeferred | RE-USES cache | CALLS buildStoryContext | NO | ✅‡ |

*MatchLiveZone reads from its own React state (initialized from props). Not independent derivation.
†MatchLiveZone is the designated owner of live score/status/minute. Its fetch is intentional.
‡BelowTheFoldDeferred calls buildStoryContext(match) — see known issues below.

---

## Known Issues

### BelowTheFoldDeferred re-calls buildStoryContext

`BelowTheFoldDeferred` calls `buildStoryReport(buildStoryContext(match))` on every render.
Since `runtimeState.storyContext` is pre-computed in the page, this is redundant work.

**Future fix**: Pass `storyContext` as a prop to `BelowTheFoldDeferred`:
```typescript
<BelowTheFoldDeferred matchId={numericId} storyContext={runtimeState.storyContext} />
```
This is a minor optimization — the duplication is harmless (pure function, same input).

### Duplicate MatchFaqJsonLd

There are two `<MatchFaqJsonLd>` renders per page:
1. In the page `<head>` area (above fold)
2. Inside `BelowTheFoldDeferred` (below fold)

Both build from the same `buildFaqs(match, null)` call. The output is identical.
Google only reads the first occurrence. The second is redundant.

**Future fix**: Remove the second instance from `BelowTheFoldDeferred`.
