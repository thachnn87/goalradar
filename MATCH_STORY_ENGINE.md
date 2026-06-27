# MATCH_STORY_ENGINE — DATA-18WC.MATCH-STORY

**Date:** 2026-06-26
**Status:** IMPLEMENTED ✅

---

## Rule Zero

ONE source. ONE engine. ONE template per match type.

No paragraph may inspect raw match objects directly.
Every section reads from `StoryContext` only.

---

## Source File

```
src/lib/match-story-engine.ts
```

---

## Public API

```typescript
// Build the context from a raw MatchDetail (the only place raw match is touched)
buildStoryContext(match: MatchDetail): StoryContext

// Produce all narrative sections (routes to correct template)
buildStoryReport(ctx: StoryContext): ReportSection[]

// Shared type used by page component
export interface ReportSection {
  heading: string;
  paragraphs: string[];
}
```

Usage in `MatchReport`:
```typescript
const sections = buildStoryReport(buildStoryContext(match));
```

---

## StoryContext

```typescript
interface StoryContext {
  home:             string;     // full team name
  homeS:            string;     // short name (fallback: full name)
  away:             string;
  awayS:            string;
  comp:             string;     // competition display name
  compFull:         string;     // "FIFA World Cup 2026" or comp
  matchType:        MatchType;  // 'WC_GROUP' | 'WC_KNOCKOUT' | 'STANDARD'
  stage:            string;     // raw stage key e.g. 'LAST_32'
  stageLabel:       string;     // "Round of 32"
  nextStageLabel:   string | null; // "Round of 16" (null for FINAL, THIRD_PLACE)
  groupLabel:       string | null; // 'A'–'L' (null for knockout)
  matchState:       MatchState; // 'FINISHED' | 'LIVE' | 'UPCOMING' | 'CANCELLED'
  winner:           Winner;     // 'HOME' | 'AWAY' | 'DRAW' | null
  ftH:              number;
  ftA:              number;
  htH:              number | null;
  htA:              number | null;
  secondHalfGoals:  number;
  totalGoals:       number;
  matchDate:        string;     // formatted "Wednesday, 11 June 2026"
  matchLabel:       string;     // "Group A" | "Round of 32" | "Matchday 5"
}
```

---

## Engine Architecture

```
buildStoryReport(ctx)
  ↓
  switch ctx.matchType
    'WC_KNOCKOUT' → buildWCKnockoutReport(ctx)
    'WC_GROUP'    → buildWCGroupReport(ctx)
    'STANDARD'    → buildStandardReport(ctx)
  ↓
  Each template calls shared section builders for First Half + Second Half
  Each template owns its own Introduction + Section 4 + Section 5
  ↓
  Returns ReportSection[] — 5 sections
```

---

## Shared Sections (identical across all templates)

### First Half

| Condition | Text style |
|---|---|
| HT score available, home leading | Home dominance, press, confidence |
| HT score available, away leading | Away clinical, composure, discipline |
| HT score available, level | Absorbing battle, deadlock, tight |
| UPCOMING (no HT data) | Preview: tone-setting, tactical shape |
| LIVE (no HT data) | In progress, possession, crowd |

### Second Half

| Condition | Text style |
|---|---|
| FINISHED, score unchanged from HT | Mirrored first half, defences stood firm |
| FINISHED, 0 second-half goals | Patient tactical battle, defensive quality |
| FINISHED, goals added | Match opened up, managers reacted, high tempo |
| UPCOMING | Decisive moments, fitness, bench depth |
| LIVE | Crucial half, impose game plan |

---

## Template Sections

### STANDARD (League / CL / Domestic Cup)

| # | Heading | Key phrases |
|---|---|---|
| 1 | Introduction | "three points", "share the spoils", victory/draw/away win |
| 2 | First Half | (shared) |
| 3 | Second Half | (shared) |
| 4 | Result Impact | "three vital points", "league table", "season", "campaign" |
| 5 | Competition Context | "{comp} is one of the most prestigious…" |

### WC_GROUP (World Cup Group Stage)

| # | Heading | Key phrases |
|---|---|---|
| 1 | Introduction | "crucial victory", "group standings", "qualification push", "knockout rounds" |
| 2 | First Half | (shared) |
| 3 | Second Half | (shared) |
| 4 | Group Stage Impact | "three points", "Group [X] standings", "race to qualify" |
| 5 | FIFA World Cup 2026 | "48 nations, 12 groups, top-2 + 8 best third" |

### WC_KNOCKOUT (All knockout stages)

| # | Heading | Key phrases |
|---|---|---|
| 1 | Introduction | "winner advances", "loser eliminated", "knockout football" |
| 2 | First Half | (shared) |
| 3 | Second Half | (shared) |
| 4 | Road to the Final / The World Cup Champion / The Bronze Medal | stage-specific |
| 5 | FIFA World Cup 2026 | stage-specific tournament context |

**Section 4 heading by stage:**

| Stage | Heading |
|---|---|
| LAST_32 / LAST_16 / QUARTER_FINALS / SEMI_FINALS | "Road to the Final" |
| THIRD_PLACE | "The Bronze Medal" |
| FINAL | "The World Cup Champion" |

---

## Forbidden Vocabulary in WC_KNOCKOUT

These phrases MUST NOT appear in any `WC_KNOCKOUT` output:

- "three points" (knockout has no points)
- "league table" (no league in WC knockout)
- "draw helps both" (draws go to extra time)
- "campaign" (standalone — use "World Cup journey")
- "season standings" / "title race" / "fixture congestion"
- "remaining league fixtures"

These phrases MUST appear contextually in `WC_KNOCKOUT`:

- "winner advances to the [next round]"
- "loser is eliminated" / "loser faces elimination"
- "extra time" (on 90-min draw)
- "penalty shootout" (on draw)
- "road to the Final"
- knockout / elimination framing

---

## Classification

```typescript
type MatchType = 'WC_KNOCKOUT' | 'WC_GROUP' | 'STANDARD';

// Derived in buildStoryContext():
const isWC         = match.competition?.code === 'WC';
const hasGroup     = !!(match.group);
const isGroupStage = hasGroup || stage === 'GROUP_STAGE';
const isKnockout   = isWC && !isGroupStage && !!stage;

matchType:
  isWC && isGroupStage → 'WC_GROUP'
  isWC && isKnockout   → 'WC_KNOCKOUT'
  else                 → 'STANDARD'
```

---

## DATA-18WC.MATCH.TRUTH — Phase 7 Audit: LIVE Score Claims

**Finding**: All three templates embed `${ftH}–${ftA}` in their LIVE intro blocks.
`ftH`/`ftA` come from `snapshot.match.score.fullTime.home/away` (ISR render time).
`MatchLiveZone` polls every 30s and may show a newer score — creating a divergence.

**Affected lines:**

| Template | Location | Line | Claim |
|----------|----------|------|-------|
| STANDARD | `buildStoryReport` | ~276 | `"the score stands at ${ftH}–${ftA}"` |
| WC_GROUP | `buildWCGroupStoryReport` | ~369 | `"The score stands at ${ftH}–${ftA}"` |
| WC_KNOCKOUT (Final) | `buildWCKnockoutStoryReport` | ~503 | `"The score stands at ${ftH}–${ftA}"` |
| WC_KNOCKOUT (other) | `buildWCKnockoutStoryReport` | ~508 | `"The score stands at ${ftH}–${ftA}"` |

**Fix (Phase 8)**: Remove score phrases from LIVE branches. Replace with score-agnostic
deference text: `"Follow the live score above for real-time updates."` This makes
MatchLiveZone the sole owner of live score truth — the story provides context only.

**Status**: Fixed in Phase 8 — see `src/lib/match-story-engine.ts`.
