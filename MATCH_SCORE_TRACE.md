# MATCH_SCORE_TRACE.md
## DATA-18WC.MATCH.TRUTH — Phase 2: Score Field Trace

---

## The One Score Object

Every score value rendered on the match detail page comes from:

```
snapshot.match.score.fullTime.{ home | away }
```

There is no secondary score variable. There is no score derivation. There is no
computed score property. Every component that reads a score receives the same
`MatchDetail` object and reads the same two fields.

---

## Score Type Definition

```typescript
type Score = {
  winner:   'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
  duration: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT' | null;
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
};
```

---

## Score Read Locations — Complete List

| Location | File | Field Read | Context |
|----------|------|-----------|---------|
| ScoreHero (static) | `page.tsx:372` | `score.fullTime.home ?? 0` | Only rendered when `centerSlot` is undefined (FINISHED/PRE_MATCH) |
| ScoreHero (static) | `page.tsx:374` | `score.fullTime.away ?? 0` | Only rendered when `centerSlot` is undefined (FINISHED/PRE_MATCH) |
| MatchLiveZone | `MatchLiveZone.tsx:144` | `score.fullTime.home ?? 0` | Live polled score (own React state) |
| MatchLiveZone | `MatchLiveZone.tsx:146` | `score.fullTime.away ?? 0` | Live polled score (own React state) |
| MatchCard (H2H) | `MatchCard.tsx:191,216` | `score.fullTime.home/away` | H2H history matches |
| MatchCard (WC group) | `MatchCard.tsx:254` | `score.fullTime.home/away` | WC group section |
| KnockoutJourney | `KnockoutJourney.tsx:130` | `scoreFor(m, teamId)` | Perspective-aware swap |
| buildFaqs | `page.tsx:1915` | `match.score?.fullTime?.home ?? 0` | Only for FINISHED matches |
| JsonLd | `page.tsx:1807` | `match.score?.fullTime?.home` | Only embedded if `isFinished` (line 1809) |
| generateMetadata | `page.tsx:76` | `match.score?.fullTime?.home` | Only in title if `isLive || isFinished` |

---

## The centerSlot ?? Pattern — No Double Score

The single most important architectural guarantee for live matches is in `ScoreHero`:

```typescript
// page.tsx:364
{centerSlot ?? (
  // Static score block — lines 366-381
  <>
    {score.fullTime.home ?? 0}
    <span>–</span>
    {score.fullTime.away ?? 0}
  </>
)}
```

When `centerSlot` is provided (`pageState === 'LIVE'`), the static score block is
**not rendered**. React evaluates `centerSlot ?? (...)` as `centerSlot` (non-null).

The static score at lines 372-374 is **physically excluded** from the live match DOM.
Only MatchLiveZone renders the score numerically for live matches.

---

## MatchLiveZone Score Lifecycle

```
1. SSR:       match.score passed as initialScore prop
2. Hydration: useState(initialScore) — same value as SSR
3. First poll: /api/live-score/[id] at T+30s
4. On update: setScore(data.score) — React state update, score display refreshes
5. Terminal:  polling stops when status becomes FINISHED/CANCELLED/etc.
```

MatchLiveZone starts with the same score as the SSR snapshot. On first hydration,
the client and server are in sync. Divergence only occurs after the first successful
poll returns a newer score.

---

## JSON-LD Score — FINISHED Only

```typescript
// page.tsx:1809
const hasScore = isFinished && homeScore != null && awayScore != null;
```

Score is embedded in JSON-LD **only when** `match.status === 'FINISHED'`. For LIVE
matches, JSON-LD contains no numeric score — it contains only event metadata and
`eventStatus: EventInProgress`. This prevents stale score embedding.

---

## FAQ Score — FINISHED Only

```typescript
// page.tsx:1912-1914
const isFinished = match.status === 'FINISHED';
const isLive     = match.status === 'IN_PLAY' || match.status === 'PAUSED';

if (isLive) {
  // FAQs: "when?", "where?", "what competition?" — no score
}
if (isFinished) {
  // FAQs: "what was the result?", "who won?", "who scored?" — score used here
}
```

Score-based FAQ text is generated only for FINISHED matches. Live match FAQs are
temporal ("currently in progress") and contain no score claim.

---

## generateMetadata Score — Conditional

```typescript
// page.tsx:75-100 (approx)
const ftH = match.score?.fullTime?.home;
const ftA = match.score?.fullTime?.away;

if (isLive) {
  title = `LIVE ${home} ${ftH ?? 0}–${ftA ?? 0} ${away}`;   // score from snapshot
}
```

For live matches, the metadata title includes the snapshot score (may be up to 30s
stale). This is acceptable — metadata is regenerated on each ISR revalidation (30s).

---

## Acceptable Temporal Staleness

During a live match, MatchLiveZone can display a newer score than:
- The metadata title (stale until ISR revalidation, max 30s)
- The story/narrative below fold (stale until ISR revalidation, max 30s)

This is **not a divergence bug** — it is the expected ISR staleness window. The
narrative does not claim a definitive live score; it reflects match state at snapshot time.
The ISR revalidation at `revalidate = 30` ensures the whole page catches up quickly.

**The only live-truth source is MatchLiveZone.** Nothing else claims to be real-time.

---

## Score Consistency Verdict

| Surface | Score Source | Consistent with snapshot? |
|---------|-------------|--------------------------|
| ScoreHero (FINISHED/PRE) | `snapshot.match.score` | ✅ Always |
| MatchLiveZone (LIVE) | Polled `/api/live-score` | ✅ Owns live truth |
| ScoreHero static | Not rendered during LIVE | ✅ N/A |
| JsonLd | `snapshot.match.score` (FINISHED only) | ✅ Gated on isFinished |
| buildFaqs | `snapshot.match.score` (FINISHED only) | ✅ Gated on isFinished |
| generateMetadata | `snapshot.match.score` | ✅ Acceptable ISR staleness |
| MatchCard (H2H/WC) | Individual match.score | ✅ Own snapshot |
| KnockoutJourney | `scoreFor()` helper | ✅ From match.score |

**No double-score scenario can occur** for any match state.
