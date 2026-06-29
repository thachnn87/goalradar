# MATCH_STORY_PIPELINE — DATA-18WC.MATCH-STORY

**Date:** 2026-06-26
**Status:** IMPLEMENTED ✅

---

## Pipeline Flow

```
/match/[id] page request
  │
  ├─ generateMetadata()          src/app/match/[id]/page.tsx : 46–154
  │    branches: isCancelled | hasScore | isLive | upcoming
  │    output:   title, description, og:*, twitter:*, robots
  │
  ├─ getOrBuildMatchSnapshot()   src/lib/match-snapshot.ts : 717–908
  │    L1: React.cache() (per-render dedup)
  │    L2: KV snapshot read (goalradar:match:{id})
  │    L3: buildSnapshot() → provider + H2H + standings + fixtures
  │    L4: disaster-recovery key (30 d TTL)
  │    output: { match, headToHead, standings, wcGroupMatches, wcAllMatches }
  │
  ├─ deriveMatchPageState()      src/app/match/[id]/page.tsx : ~1682
  │    PROJECTED | QUALIFIED | PRE_MATCH | LIVE | FINISHED | CANCELLED
  │
  ├─ Hero render
  │    PROJECTED → ProjectedHero  (slot labels, "?" placeholders)
  │    CANCELLED → CancelledHero  (greyed out)
  │    default   → ScoreHero      (score + MatchLiveZone if LIVE)
  │
  └─ BelowTheFoldDeferred (Suspense)
       │
       ├─ MatchReport
       │    buildStoryContext(match)  src/lib/match-story-engine.ts
       │    buildStoryReport(ctx)     src/lib/match-story-engine.ts
       │    → ReportSection[]         rendered as prose <article>
       │    → Article JSON-LD
       │
       ├─ GoalsSection / BookingsSection / SubstitutionsSection / LineupsSection
       ├─ HeadToHeadDeferred (Suspense)
       ├─ MatchFaqSection             buildFaqs() → FAQPage JSON-LD
       └─ WCGroupSectionDeferred (Suspense)

JSON-LD blocks
  SportsEvent                    src/app/match/[id]/page.tsx : ~1971
  BreadcrumbList                 src/app/match/[id]/page.tsx : ~2059
  Article                        inside MatchReport component
  FAQPage                        MatchFaqJsonLd component
```

---

## Files

| File | Role | Lines |
|---|---|---|
| `src/app/match/[id]/page.tsx` | Match page, metadata, hero, all components | ~2,550 |
| **`src/lib/match-story-engine.ts`** | **Story Engine — ONE source for all narrative** | ~430 |
| `src/lib/match-snapshot.ts` | Snapshot builder (KV/provider/fallback chain) | ~945 |
| `src/lib/canonical-match.ts` | Authority:v1 adapter | ~502 |
| `src/lib/match-classify.ts` | Match state classifier | ~55 |
| `src/lib/knockout-vm.ts` | Knockout stage view model | ~211 |
| `src/lib/types.ts` | MatchDetail, HeadToHead, Match, etc. | — |

---

## Narrative Generation

**Entry point:** `MatchReport` component calls:
```typescript
const sections = buildStoryReport(buildStoryContext(match));
```

No other code generates match narrative. `buildReportSections()` has been deleted.

---

## SEO Surfaces

| Surface | File | What it generates |
|---|---|---|
| `<title>` / `<meta description>` | page.tsx : 46–154 | 4-branch title + description |
| Article JSON-LD | MatchReport component | headline, datePublished, author |
| SportsEvent JSON-LD | JsonLd component | eventStatus, teams, venue, organizer |
| BreadcrumbList JSON-LD | JsonLd component | WC → Group → Match or Competition → Match |
| FAQPage JSON-LD | MatchFaqJsonLd | 5–8 Q&A per match |

---

## Metadata Branching

```
generateMetadata()
  if isCancelled   → "… – Cancelled | … | GoalRadar"
  if hasScore      → "… X–Y … – Match Result | … | GoalRadar"
  if isLive        → "… LIVE Score | …"
  else (upcoming)  → "… Preview | …"
```

---

## Snapshot Pipeline

```
getOrBuildMatchSnapshot(matchId)
  React.cache() hit → return immediately
  KV hit           → return snapshot
  KV miss          →
    buildSnapshot()
      getMatchDetail()    KV → provider → authority:v1 fallback
      Parallel:
        getHeadToHead()   KV-only
        getStandings()    KV-only
        getWCFixtures()   KV + static fallback
      Enrichment (FINISHED WC with goals=0):
        af-id-map → espn-id-map fallback
    writeKVSnapshot()     TTL: LIVE=skip / UPCOMING=6h / FINISHED=7d
    writeDRSnapshot()     TTL: 30d
  DR hit           → disaster-recovery
  all miss         → throw → 404
```

---

## Self-Healing Guards

| Guard | Trigger | Action |
|---|---|---|
| Pinned unenriched | FINISHED, goals=0, FT score > 0 | Rebuild once under 30-min lock |
| TBD team resolve | WC knockout, homeTeam.id=0, snap >5 min | Rebuild to propagate group resolution |
| Score drift | FINISHED WC, FD score ≠ snapshot score | Rebuild once under 30-min lock |
| Downgrade guard | Writing FINISHED+goals=0 over enriched DR | Skip write, restore DR version |
