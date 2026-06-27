# FIELD_RUNTIME_MATRIX.md
## DATA-18WC.RUNTIME.TRUTH — Phase 0: Field Runtime Matrix

---

## Legend

- **Owner**: Which object/function is the authoritative source for this field
- **Clock**: Which timing mechanism drives updates to this field
- **Mutable?**: Can this field change after initial server render?
- **Versioned?**: Is there a version/timestamp attached to changes?
- **Divergence risk**: Can this field show different values in different components simultaneously?

---

## Core Match Fields

### score

| Attribute | Value |
|-----------|-------|
| **Owner** | `MatchLiveZone` (LIVE); `snapshot.match.score` (other states) |
| **Clock** | Poll Clock (30s) for LIVE; ISR Clock (60s) for other |
| **Mutable?** | YES — during LIVE match |
| **Versioned?** | NO — no version attached to poll updates |
| **SSR location** | `match.score.fullTime.home/away` in `ScoreHero` static block |
| **Client location** | `MatchLiveZone.score` React state → rendered in live zone |
| **Divergence risk** | LOW — centerSlot ?? prevents double-render; single owner per state |
| **Divergence window** | Up to 30s between poll and ISR revalidation |

### minute

| Attribute | Value |
|-----------|-------|
| **Owner** | `MatchLiveZone` (LIVE); `snapshot.match.minute` (other) |
| **Clock** | Poll Clock (30s) |
| **Mutable?** | YES — during LIVE match |
| **Versioned?** | NO |
| **SSR location** | Not displayed as a number (only StatusBadge in MatchLiveZone) |
| **Client location** | `MatchLiveZone.minute` React state → StatusBadge `{minute}'` |
| **Divergence risk** | NONE — only MatchLiveZone renders the match minute |

### status

| Attribute | Value |
|-----------|-------|
| **Owner** | `MatchLiveZone` (LIVE); `snapshot.match.status` for `deriveMatchPageState()` |
| **Clock** | Poll Clock (30s) for client status; ISR Clock (60s) for page state |
| **Mutable?** | YES — during LIVE; terminal status ends polling |
| **Versioned?** | NO |
| **SSR location** | `deriveMatchPageState(match)` → `pageState` → controls component tree |
| **Client location** | `MatchLiveZone.status` React state → StatusBadge rendering |
| **Divergence risk** | LOW — page state doesn't change during session (no live page state update) |
| **Note** | When match finishes: MatchLiveZone sets status=FINISHED, stops polling, shows FULL TIME. Page state remains LIVE until next ISR. Visual result is acceptable. |

---

## Event Fields

### goals[]

| Attribute | Value |
|-----------|-------|
| **Owner** | `snapshot.match.goals` |
| **Clock** | ISR Clock (60s) |
| **Mutable?** | YES — new goals appear after next ISR revalidation |
| **Versioned?** | NO |
| **Rendered by** | `MatchTimeline`, `buildFaqs` (FINISHED), `buildStoryReport` |
| **Divergence risk** | NONE — single server source, no client update |
| **Gap** | During LIVE: MatchLiveZone can show 1-0 before ISR renders the goal in MatchTimeline |

### bookings[]

| Attribute | Value |
|-----------|-------|
| **Owner** | `snapshot.match.bookings` |
| **Clock** | ISR Clock (60s) |
| **Mutable?** | YES — after ISR revalidation |
| **Versioned?** | NO |
| **Rendered by** | `MatchTimeline` |
| **Divergence risk** | NONE — single server source |

### substitutions[]

| Attribute | Value |
|-----------|-------|
| **Owner** | `snapshot.match.substitutions` |
| **Clock** | ISR Clock (60s) |
| **Mutable?** | YES — after ISR revalidation |
| **Versioned?** | NO |
| **Rendered by** | `MatchTimeline` |
| **Divergence risk** | NONE — single server source |

### lineups / formations

| Attribute | Value |
|-----------|-------|
| **Owner** | `snapshot.match.lineups` |
| **Clock** | ISR Clock (60s), or PRE_MATCH (available 1hr before kick-off) |
| **Mutable?** | YES — lineup can change until kick-off |
| **Versioned?** | NO |
| **Rendered by** | Lineup section in BelowTheFoldDeferred (conditional on `match.lineups != null`) |
| **Divergence risk** | NONE — single server source |

---

## Match Context Fields

### venue

| Attribute | Value |
|-----------|-------|
| **Owner** | `snapshot.match.venue` |
| **Clock** | ISR Clock (static for confirmed matches) |
| **Mutable?** | RARELY — only changes on replay/postponement |
| **Versioned?** | NO |
| **Rendered by** | `ScoreHero` (venue meta), `JsonLd` (Place schema), `buildFaqs` |
| **Divergence risk** | NONE |

### referee

| Attribute | Value |
|-----------|-------|
| **Owner** | `snapshot.match.referees[]` |
| **Clock** | ISR Clock (static for confirmed matches) |
| **Mutable?** | RARELY |
| **Versioned?** | NO |
| **Rendered by** | `ScoreHero` (referee meta line) |
| **Divergence risk** | NONE |

### attendance

| Attribute | Value |
|-----------|-------|
| **Owner** | NOT PRESENT in `MatchDetail` |
| **Clock** | N/A |
| **Mutable?** | N/A |
| **Note** | `attendance` is not a field in the current MatchDetail type. Not rendered. |

### competition / stage / group

| Attribute | Value |
|-----------|-------|
| **Owner** | `snapshot.match.competition`, `snapshot.match.stage`, `snapshot.match.group` |
| **Clock** | ISR Clock (static) |
| **Mutable?** | NO |
| **Versioned?** | NO |
| **Rendered by** | `ScoreHero`, `buildStoryContext`, `JsonLd`, `generateMetadata`, `buildFaqs` |
| **Divergence risk** | NONE — static for the match lifecycle |

### statistics

| Attribute | Value |
|-----------|-------|
| **Owner** | Computed from match events in `page.tsx:667` |
| **Clock** | ISR Clock (60s) |
| **Mutable?** | YES — updates after ISR as new events arrive |
| **Versioned?** | NO |
| **Note** | "API free tier only" comment — may not be populated from provider |
| **Divergence risk** | NONE — computed server-side from same match object |

### weather / broadcast

| Attribute | Value |
|-----------|-------|
| **Owner** | Not sourced from MatchDetail; rendered as static content (broadcast guide) |
| **Clock** | N/A |
| **Mutable?** | NO |
| **Note** | Broadcast section (`page.tsx:1316`) is static editorial content, not from MatchDetail |

---

## Narrative / SEO Fields

### storyContext / narrative

| Attribute | Value |
|-----------|-------|
| **Owner** | `buildStoryContext(snapshot.match)` |
| **Clock** | ISR Clock (60s) |
| **Mutable?** | YES — story re-derives from new snapshot on ISR |
| **Versioned?** | NO |
| **Rendered by** | `buildStoryReport()` sections in BelowTheFoldDeferred |
| **Divergence risk** | NONE — single derivation per render |

### metadata title / OG

| Attribute | Value |
|-----------|-------|
| **Owner** | `generateMetadata(snapshot.match)` |
| **Clock** | ISR Clock (60s) |
| **Mutable?** | YES — ISR updates it |
| **Versioned?** | NO |
| **Divergence risk** | LOW — ISR lag only; metadata is separate from MatchLiveZone |

### JSON-LD score

| Attribute | Value |
|-----------|-------|
| **Owner** | `JsonLd(snapshot.match)` |
| **Clock** | ISR Clock (60s) |
| **Mutable?** | NO for LIVE (score absent); YES for FINISHED (updates with snapshot) |
| **Versioned?** | NO |
| **Divergence risk** | NONE — gated on `isFinished` |

---

## Divergence Summary

| Field | Can Diverge? | Window | Risk Level |
|-------|-------------|--------|-----------|
| score | YES (LIVE) | 30s | MANAGED — MatchLiveZone is sole visual owner |
| minute | YES (LIVE) | 30s | MANAGED — only MatchLiveZone renders minute |
| status | YES (LIVE) | 30s | MANAGED — page state is server-derived, client status is display-only |
| goals | YES (gap) | 30s | LOW — user sees updated score before updated timeline |
| bookings | YES (gap) | 30s | LOW — no immediate visual impact |
| substitutions | YES (gap) | 30s | LOW |
| lineups | NO | — | NONE |
| venue | NO | — | NONE |
| referee | NO | — | NONE |
| competition | NO | — | NONE |
| narrative | NO | — | NONE (story is score-agnostic for LIVE) |
| JSON-LD | NO | — | NONE (score absent for LIVE) |
| attendance | N/A | — | N/A (field not populated) |
| statistics | NO | — | NONE |

**Key insight**: After MATCH.TRUTH Phase 8 fix, score divergence is contained to the
visible score display (owned by MatchLiveZone). No other surface claims a live score.
The GOAL TIMELINE vs. SCORE divergence (score shows 1-0 before timeline shows the goal)
is an inherent ISR lag behavior — the score updates faster than events because polling
is separate from ISR.
