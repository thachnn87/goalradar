# MATCH_EVENT_TRACE.md
## DATA-18WC.MATCH.TRUTH — Phase 3: Event Data Trace

---

## Event Types

The match detail page renders four categories of match events:

| Event Type | Field | Source |
|-----------|-------|--------|
| Goals | `match.goals[]` | Provider FD + ESPN/AF enrichment (Source 8) |
| Bookings | `match.bookings[]` | Provider FD |
| Substitutions | `match.substitutions[]` | Provider FD |
| Lineups | `match.lineups` | Provider FD |
| Penalties | `match.score.duration` + penaltyShootout data | Provider FD |

All fields belong to `snapshot.match` — the single MatchDetail object. No component
fetches events independently.

---

## MatchDetail Event Fields

```typescript
type MatchDetail extends Match {
  goals:          GoalEvent[];
  bookings:       BookingEvent[];
  substitutions:  SubstitutionEvent[];
  lineups?:       Lineup;
  venue:          string | null;
  referees:       Referee[];
  // ...plus all Match fields (id, status, score, homeTeam, awayTeam, etc.)
}
```

---

## Goals

### Source
- **Primary**: `match.goals[]` from football-data.org `/v4/matches/{id}` response
- **Enrichment**: ESPN / API-Football enrichment (Source 8) applied for FINISHED WC matches with `goals.length === 0`

### What Enrichment Does
ESPN and API-Football provide full goal event lists (scorer, minute, team) for completed WC matches. The enrichment fills `match.goals[]` when FD returns an empty array. It never modifies an already-populated goals array.

### Rendering Locations

| Component | Purpose | File |
|-----------|---------|------|
| MatchTimeline (events) | Renders goal icons on timeline | `page.tsx` (inline) |
| buildStoryContext | Generates "scorer narrative" | `match-story-engine.ts` |
| buildFaqs (FINISHED) | "Who scored?" FAQ | `page.tsx:1966` |
| KnockoutJourney | Goal events per stage | `KnockoutJourney.tsx` |

### Empty Goals Safeguard (DATA-15C.1)
If a FINISHED match has `goals.length > 0` (score > 0), the FAQ says:
"Goals: [scorer details]."

If FINISHED but `goals.length === 0` AND `ftH + ftA > 0`, the FAQ says:
"[Home] beat [Away] [score] in [comp]. Goal scorer details are not available."

This prevents false "goalless" claims when enrichment hasn't populated events.

---

## Bookings

### Source
- `match.bookings[]` from football-data.org only (no enrichment)
- Each booking: `{ player: { name, id }, team, type: 'YELLOW_CARD'|'RED_CARD'|'YELLOW_RED_CARD', minute }`

### Rendering
- MatchTimeline renders booking icons chronologically
- `buildStoryContext()` counts bookings for narrative context ("physical battle" if high count)

---

## Substitutions

### Source
- `match.substitutions[]` from football-data.org only
- Each substitution: `{ playerIn: { name }, playerOut: { name }, team, minute }`

### Rendering
- MatchTimeline renders substitution events
- Not used in `buildFaqs` or JSON-LD

---

## Lineups

### Source
- `match.lineups` from football-data.org only (optional — may be null)
- Contains formations, starting XI, substitutes for home and away

### Rendering
- Lineup section in BelowTheFoldDeferred (conditional on `match.lineups != null`)

---

## Penalties

### Source
- `match.score.duration === 'PENALTY_SHOOTOUT'` indicates a penalty shootout
- Penalty scores: embedded in `match.score.fullTime` (includes extra time goals)
- Penalty shootout detail: separate field if available from provider

### Rendering
- ScoreHero / MatchLiveZone: displays "(P)" suffix or penalty score indicator
- buildStoryContext: generates penalty drama narrative

---

## Live Event Updates

During a live match, `MatchLiveZone` polls `/api/live-score/[matchId]` every 30s.
The poll endpoint returns:

```typescript
{
  status:  MatchStatus;
  score:   Score;
  minute:  number | null;
  goals?:  GoalEvent[];    // optional — depends on endpoint implementation
}
```

The `goals[]` from polling are NOT applied to the server-rendered timeline.
The timeline is server-rendered from `snapshot.match.goals[]` and does not update
client-side. New goals appear in the timeline only after the page ISR revalidates
(max 30s) and the user receives the new page shell.

This is **by design** — the timeline is not a real-time DOM, it is a server-rendered
narrative. MatchLiveZone owns only the score and minute display. The full event
timeline updates via ISR.

---

## Event Consistency Verdict

| Event | Sourced From | Can Diverge? |
|-------|-------------|-------------|
| Goals array | `snapshot.match.goals` | No — server-rendered from ONE snapshot |
| Bookings array | `snapshot.match.bookings` | No — server-rendered from ONE snapshot |
| Substitutions | `snapshot.match.substitutions` | No — server-rendered from ONE snapshot |
| Lineups | `snapshot.match.lineups` | No — server-rendered from ONE snapshot |
| Live score | MatchLiveZone state (polled) | Acceptable ISR lag (max 30s) |
| Live minute | MatchLiveZone state (polled) | Acceptable ISR lag (max 30s) |

No component reads events from a secondary source. There is no event divergence.
