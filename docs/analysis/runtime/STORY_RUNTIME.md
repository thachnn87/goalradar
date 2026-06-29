# STORY_RUNTIME.md
## DATA-18WC.RUNTIME.TRUTH — Phase 7: ONE STORY (Read-Only Engine)

---

## Rule

Story Engine is read-only. It formats. It does not calculate, derive, guess, infer, fetch, or poll.
Story Engine owns ZERO data. It receives MatchRuntimeState and formats it into narrative.

---

## Current State: COMPLIANT

After DATA-18WC.MATCH.TRUTH Phase 8, the story engine satisfies the ONE STORY rule.

---

## Story Engine API

```typescript
// src/lib/match-story-engine.ts

// Step 1: Build context from MatchDetail (called ONCE in deriveRuntimeState)
export function buildStoryContext(match: MatchDetail): StoryContext

// Step 2: Format context into narrative sections
export function buildStoryReport(ctx: StoryContext): ReportSection[]

// Step 3: Build story cards for the strip
export function buildStoryCards(match: MatchDetail): StoryCard[]

// Additional: group/round card builders
export function buildGroupStoryCards(entries, qualMap): StoryCard[]
export function buildRoundStoryCards(matches, stage): StoryCard[]
```

---

## What the Engine Does

The engine transforms `StoryContext` into `ReportSection[]`. It reads:
- Team names (`home`, `away`, `homeS`, `awayS`)
- Match type (`WC_GROUP` | `WC_KNOCKOUT` | `STANDARD`)
- Match state (`FINISHED` | `LIVE` | `UPCOMING` | `CANCELLED`)
- Score (`ftH`, `ftA`, `htH`, `htA`)
- Competition context (`comp`, `compFull`, `stageLabel`)

It returns structured text paragraphs. It does not:
- Fetch any data
- Call any API
- Read from any KV cache
- Hold any mutable state
- Poll any endpoint
- Access `process.env`

---

## LIVE Match Narrative — Score-Agnostic

Per MATCH.TRUTH Phase 8 fix, all LIVE intro blocks are score-agnostic:

| Template | LIVE Intro |
|----------|-----------|
| STANDARD | `"{home} are currently locked in a {comp} encounter against {away}. The match is live — follow the score above for real-time updates."` |
| WC_GROUP | `"{home} and {away} are currently locked in a {grp} encounter at the FIFA World Cup 2026. Follow the live score above — the outcome will have major implications for the {grpS} standings."` |
| WC_KNOCKOUT (Final) | `"{home} and {away} are facing off in the FIFA World Cup 2026 Final, with the world watching. Follow the live score above — one team is playing for the right to be called World Champion."` |
| WC_KNOCKOUT (other) | `"{home} and {away} are locked in a FIFA World Cup 2026 {stageLabel}, with everything on the line. Follow the live score above — the winner advances to the {nextRound}, the loser is eliminated."` |

No LIVE narrative embeds `${ftH}–${ftA}`. MatchLiveZone is the sole score owner.

---

## StoryContext Ownership

After Phase 2, `StoryContext` is pre-computed in `deriveRuntimeState()` and available
as `runtimeState.storyContext`. This means:

- `buildStoryContext(match)` is called ONCE per request (in `deriveRuntimeState`)
- `buildStoryReport(ctx)` receives the pre-computed context
- No component calls `buildStoryContext` independently

**Compliance**: Story Engine receives data (StoryContext). It does not own data.
All data originates from `snapshot.match` → `deriveRuntimeState()` → `StoryContext`.

---

## Template Selection Logic (Pure)

```typescript
matchType:
  isWC && isGroupStage → 'WC_GROUP'    → buildWCGroupReport(ctx)
  isWC && isKnockout   → 'WC_KNOCKOUT' → buildWCKnockoutReport(ctx)
  else                 → 'STANDARD'    → buildStandardReport(ctx)
```

This selection is deterministic and side-effect free.

---

## Forbidden in Story Engine

The engine MUST NOT:
- Call `fetch()` or any async function
- Access Vercel KV or any cache
- Use `Date.now()` or any real-time value outside what's in `StoryContext`
- Modify `StoryContext` fields
- Import from `match-snapshot.ts` or `live-cache.ts`
- Hold module-level state

The engine MAY:
- Call string formatting functions
- Call pure utility functions (date formatting, label lookups)
- Branch on `StoryContext` fields

---

## Architecture Check

`scripts/check-runtime-architecture.mjs` verifies:
- No LIVE branch in match-story-engine.ts embeds `${ftH}` or `${ftA}`
- Story engine imports no fetch/KV/cache modules
- `buildStoryContext` and `buildStoryReport` are the only exported functions that touch StoryContext
