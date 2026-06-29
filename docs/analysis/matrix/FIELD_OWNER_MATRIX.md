# FIELD_OWNER_MATRIX.md
## DATA-18WC.RUNTIME.TRUTH — Phase 3: ONE FIELD OWNER

---

## Rule

Every field must have exactly ONE owner. Never two.

---

## Field Ownership Matrix

| Field | Owner | Mutable? | Clock | Versioned? | Consumer Components |
|-------|-------|---------|-------|-----------|-------------------|
| **score** | `MatchLiveZone` (LIVE) / `snapshot.match.score` (other) | YES (LIVE) | Poll Clock 30s | YES — data-live-version | ScoreHero (static), MatchLiveZone (live display), MatchTimeline (events), buildFaqs (FINISHED), JsonLd (FINISHED) |
| **minute** | `MatchLiveZone` (LIVE) | YES (LIVE) | Poll Clock 30s | YES — data-live-version | MatchLiveZone StatusBadge |
| **status** | `MatchRuntimeState.pageState` (server); `MatchLiveZone.status` (client display) | YES (display) | ISR + Poll | YES — pageState is version-pinned | ScoreHero, MatchLiveZone, deriveMatchPageState, buildFaqs, JsonLd |
| **goals[]** | `snapshot.match.goals` | YES (ISR updates) | ISR Clock 60s | NO | MatchTimeline, buildFaqs (FINISHED), buildStoryContext |
| **bookings[]** | `snapshot.match.bookings` | YES (ISR updates) | ISR Clock 60s | NO | MatchTimeline |
| **substitutions[]** | `snapshot.match.substitutions` | YES (ISR updates) | ISR Clock 60s | NO | MatchTimeline |
| **lineups** | `snapshot.match.lineups` | YES (until kickoff) | ISR Clock 60s | NO | Lineup section |
| **statistics** | Computed from `snapshot.match` events | YES (ISR updates) | ISR Clock 60s | NO | Statistics section |
| **venue** | `snapshot.match.venue` | NO (static) | ISR Clock (static) | NO | ScoreHero meta, JsonLd Place, buildFaqs |
| **referee** | `snapshot.match.referees[]` | NO (static) | ISR Clock (static) | NO | ScoreHero meta |
| **attendance** | NOT PRESENT | N/A | N/A | N/A | N/A |
| **formations** | `snapshot.match.lineups.*.formation` | YES (until kickoff) | ISR Clock 60s | NO | Lineup section |
| **competition** | `snapshot.match.competition` | NO (static) | ISR Clock (static) | NO | ScoreHero, JsonLd, buildStoryContext, buildFaqs, generateMetadata |
| **stage** | `snapshot.match.stage` | NO (static) | ISR Clock (static) | NO | buildStoryContext, buildBreadcrumb, buildFaqs |
| **group** | `snapshot.match.group` | NO (static) | ISR Clock (static) | NO | buildStoryContext, ScoreHero |
| **storyContext** | `MatchRuntimeState.storyContext` (pre-derived) | YES (ISR updates) | ISR Clock 60s | NO | buildStoryReport, StoryCardStrip |
| **pageState** | `MatchRuntimeState.pageState` (pre-derived) | NO (per-render) | ISR Clock 60s | NO | All conditional rendering |
| **version** | `MatchRuntimeState.version` (server) / `MatchLiveZone.liveVersion` (client) | YES | ISR + Poll | SELF | data-match-version, data-live-version |
| **narrative sections** | `buildStoryReport(runtimeState.storyContext)` | YES (ISR updates) | ISR Clock 60s | NO | BelowTheFoldDeferred story sections |
| **JSON-LD** | `JsonLd(snapshot.match)` | YES (ISR updates) | ISR Clock 60s | NO | `<script ld+json>` |
| **metadata** | `generateMetadata(snapshot.match)` | YES (ISR updates) | ISR Clock 60s | NO | `<head>` |

---

## Single Owner Verification

### score — ONE owner per state

The key invariant is the `centerSlot ??` pattern in ScoreHero:

```typescript
// LIVE: centerSlot = MatchLiveZone → static score NOT rendered
// Other: centerSlot = undefined → static score IS rendered
{centerSlot ?? <StaticScore score={match.score} />}
```

There is never a situation where both MatchLiveZone AND static score are visible.
Score has exactly ONE display owner at all times.

### pageState — ONE derivation

Before Phase 2: `deriveMatchPageState()` was called 3 times (lines 2240, 2291, 2426 in page.tsx).
After Phase 2: `deriveRuntimeState()` calls it once. All callers use `runtimeState.pageState`.

The redirect check (line 2240) still calls `deriveMatchPageState(m)` for the slug redirect logic
where `runtimeState` is not yet available. This is acceptable — the redirect exits before any rendering.

### storyContext — ONE derivation

Before Phase 2: `buildStoryContext(match)` was called inside `buildStoryReport()` every call.
After Phase 2: `runtimeState.storyContext` is pre-computed once. `buildStoryReport` accepts a
pre-computed context directly — no redundant re-computation.

---

## Field Boundary: Server vs Client

```
SERVER OWNER (ISR Clock):
  goals[], bookings[], substitutions[], lineups, statistics
  venue, referee, competition, stage, group
  narrative, JSON-LD, metadata, FAQ text

CLIENT OWNER (Poll Clock):
  score (LIVE only — via MatchLiveZone)
  minute (LIVE only — via MatchLiveZone)
  status display (LIVE only — via MatchLiveZone)
  liveVersion (LIVE only — via MatchLiveZone)

SHARED (pre-computed once, immutable per render):
  pageState, storyContext, version (matchVersion)
```

---

## No Field Has Two Owners

After the Phase 2/8 fixes:
- Score for LIVE matches: owned by MatchLiveZone (via centerSlot ?? — static excluded)
- Score claims in story: removed (MATCH.TRUTH Phase 8 — "follow the live score above")
- JSON-LD score: gated on `isFinished` — absent for LIVE
- FAQ score: gated on `isFinished` — absent for LIVE

No field is simultaneously claimed by two components.
