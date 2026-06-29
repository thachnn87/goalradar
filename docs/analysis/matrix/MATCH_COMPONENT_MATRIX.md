# MATCH_COMPONENT_MATRIX.md
## DATA-18WC.MATCH.TRUTH — Phase 4: Component-to-ViewModel Matrix

---

## The ViewModel

There is no explicit MatchViewModel type. `MatchDetail` (the `match` field of
`MatchSnapshot`) is the ViewModel. Every component receives the same instance.

```
getOrBuildMatchSnapshot(id)
  └─ snapshot.match: MatchDetail   ← THE VIEW MODEL
       ├─ passed to ScoreHero
       ├─ passed to MatchLiveZone (initialScore, initialStatus, initialMinute)
       ├─ passed to JsonLd
       ├─ passed to buildFaqs
       ├─ passed to buildStoryReport
       ├─ passed to generateMetadata
       └─ passed to BelowTheFoldDeferred (which re-calls same React.cache promise)
```

---

## Component Matrix

| Component | Prop Received | Fields Read | Renders |
|-----------|-------------|-------------|---------|
| `ScoreHero` | `match: MatchDetail` | score.fullTime, score.halfTime, status, homeTeam, awayTeam, competition, utcDate, matchday, venue, referees | Score hero card, team names/crests |
| `MatchLiveZone` | `initialScore, initialStatus, initialMinute, matchId` | score (own React state, initialized from match.score) | Live score, minute, LIVE badge, polling countdown |
| `JsonLd` | `match: MatchDetail` | status, score (FINISHED only), homeTeam, awayTeam, competition, utcDate, venue | `<script type="application/ld+json">` SportsEvent |
| `MatchFaqJsonLd` | `faqs: Faq[]` | (pre-built from match) | `<script>` FAQPage JSON-LD |
| `generateMetadata()` | `snapshot.match` | status, score, homeTeam, awayTeam, competition, utcDate | `<title>`, OG tags, Twitter cards |
| `buildFaqs()` | `match: MatchDetail` | status, score (FINISHED only), goals, homeTeam, awayTeam, competition, matchday, venue | FAQ schema text |
| `buildStoryReport()` | `buildStoryContext(match)` | status, score, goals, homeTeam, awayTeam, competition | Narrative sections array |
| `MatchTimeline` | `match: MatchDetail` | goals, bookings, substitutions, score, status | Chronological event timeline |
| `MatchSummary` | `match: MatchDetail` | score, goals, status, homeTeam, awayTeam | Score summary card |
| `HeadToHeadDeferred` | `snapshot.headToHead` | (H2H data, not match score) | H2H history section |
| `WCGroupSectionDeferred` | `snapshot.wcGroupMatches` + `match.homeTeam/awayTeam` | Group fixtures | Group standings/fixtures section |
| `WCAboveFoldCTA` | `matchId: number` | (match ID only) | CTA widget |
| `KnockoutJourney` | `matches, teamId, teamName` | score, goals, stage (per-match objects, not MatchDetail) | Stage-by-stage bracket |
| `ProjectedHero` | `match: MatchDetail` | homeTeam, awayTeam, utcDate | TBD slot hero (PROJECTED state) |
| `CancelledHero` | `match: MatchDetail` | homeTeam, awayTeam, status | Cancelled match hero |
| `StoryCardStrip` | `cards: StoryCard[]` | (pre-built from match) | Horizontal scrollable story chips |

---

## Data Flow Diagram

```
                    getOrBuildMatchSnapshot(id)
                    [wrapped with React.cache()]
                           │
                    ┌──────┴──────┐
                    │             │
              generateMetadata  MatchDetailPage (server component)
                (same promise,   │
                 deduped)         ├─ <JsonLd match={match} />
                                  ├─ <MatchFaqJsonLd faqs={buildFaqs(match, null)} />
                                  ├─ <ScoreHero match={match}
                                  │    centerSlot={
                                  │      pageState==='LIVE'
                                  │        ? <MatchLiveZone
                                  │            initialScore={match.score}
                                  │            initialStatus={match.status}
                                  │          />
                                  │        : undefined
                                  │    }
                                  │  />
                                  └─ <BelowTheFoldDeferred matchId={id} />
                                       └─ getOrBuildMatchSnapshot(id)  [deduped]
                                            ├─ buildStoryReport(buildStoryContext(match))
                                            ├─ <MatchTimeline match={match} />
                                            ├─ <MatchSummary match={match} />
                                            ├─ <WCGroupSectionDeferred ... />
                                            └─ <HeadToHeadDeferred ... />
```

---

## The centerSlot ?? Rule

This is the key invariant for live score consistency:

```typescript
// ScoreHero, page.tsx:364
{centerSlot ?? (
  // STATIC score block — rendered ONLY when centerSlot is undefined
  // (FINISHED, PRE_MATCH, PROJECTED states)
)}
```

**When `pageState === 'LIVE'`:**
- `centerSlot` = `<MatchLiveZone ...>` → non-null
- `??` short-circuits: static score block is NOT rendered
- MatchLiveZone is the ONLY score display on the page
- No double-score scenario is possible

**When `pageState !== 'LIVE'`:**
- `centerSlot` = `undefined`
- `??` falls through: static score block IS rendered
- MatchLiveZone is NOT rendered
- Score comes from `snapshot.match.score` (single source)

---

## Components That Do NOT Read From match

| Component | What It Reads | Notes |
|-----------|-------------|-------|
| `WCAboveFoldCTA` | `matchId: number` | Only needs the ID |
| `AdSlot` | `slotId, variant` | No match data |
| `LocalTime` | `utcDate: string` | Only the date string |
| `AddToCalendar` | Individual match fields | Passed as discrete props, not full MatchDetail |
| `LiveRefresher` | None | Client-side router.refresh() only |

---

## No Component Divergence

No component fetches match data independently from the network. No component holds
a separate match data object. Every component rendering match state reads from
the same `snapshot.match` reference (or props derived directly from it).

The only component with its own state is `MatchLiveZone`, which:
1. Initializes from `snapshot.match.score` (same snapshot)
2. Updates only score + minute + status from polling
3. Is the sole owner of live score rendering (centerSlot ?? pattern)
