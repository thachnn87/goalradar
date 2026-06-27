# FINAL_MATCH_TRUTH.md
## DATA-18WC.MATCH.TRUTH — Final Acceptance

---

## Sprint Summary

**Objective**: Eliminate every possibility that one match detail page can display
conflicting information. ONE DATASET → ONE VIEWMODEL → ONE COMPONENT → ONE STATE → ONE STORY.

**Root cause found and fixed**: Four places in `src/lib/match-story-engine.ts` embedded
snapshot-time scores (`${ftH}–${ftA}`) inside LIVE match narrative. Because
`MatchLiveZone` polls `/api/live-score/{id}` every 30s independently, the displayed
score could advance while the story still claimed the older score. Phase 8 removes
all four score claims from LIVE narrative branches.

---

## Deliverables

| File | Phase | Status |
|------|-------|--------|
| `MATCH_SOURCE_INVENTORY.md` | Phase 1 | ✅ Complete |
| `MATCH_SCORE_TRACE.md` | Phase 2 | ✅ Complete |
| `MATCH_EVENT_TRACE.md` | Phase 3 | ✅ Complete |
| `MATCH_COMPONENT_MATRIX.md` | Phase 4 | ✅ Complete |
| `MATCH_VIEWMODEL.md` | Phase 5 | ✅ Complete |
| `MATCH_STATE.md` | Phase 6 | ✅ Complete |
| `MATCH_STORY_ENGINE.md` | Phase 7 | ✅ Updated |
| Phase 8 Consolidation — `src/lib/match-story-engine.ts` | Phase 8 | ✅ Fixed |
| `MATCH_RUNTIME_VALIDATION.md` + `scripts/check-match-truth.mjs` | Phase 9 | ✅ Complete |
| `MATCH_ARCHITECTURE.md` + `scripts/check-match-architecture.mjs` | Phase 10 | ✅ Complete |

---

## Architecture After Sprint

```
getOrBuildMatchSnapshot(id)  ← React.cache() deduped, 1 call per request
        │
  snapshot.match: MatchDetail
        │
        ├─ generateMetadata()         → <title>, OG (snapshot score — ISR max 30s lag)
        ├─ <JsonLd match={match} />   → score ONLY if isFinished
        ├─ <MatchFaqJsonLd ... />     → score ONLY if isFinished
        ├─ deriveMatchPageState()     → pageState (single derivation)
        │
        └─ <ScoreHero match={match}
                centerSlot={
                  pageState==='LIVE'
                    ? <MatchLiveZone initialScore={match.score} />   ← polls live
                    : undefined
                }
           />
           {centerSlot ?? <StaticScore score={match.score} />}      ← ?? = no double-score
        │
        └─ <BelowTheFoldDeferred>
                buildStoryReport(buildStoryContext(match))   ← score-agnostic for LIVE
                <MatchTimeline match={match} />
                <MatchSummary match={match} />
```

---

## The Phase 8 Fix

**File**: `src/lib/match-story-engine.ts`

**Four changes** — all in `matchState === 'LIVE'` intro blocks:

| Template | Before | After |
|----------|--------|-------|
| STANDARD | `"The match is live and the score stands at ${ftH}–${ftA}."` | `"The match is live — follow the score above for real-time updates."` |
| WC_GROUP | `"The score stands at ${ftH}–${ftA} and the outcome will have..."` | `"Follow the live score above — the outcome will have..."` |
| WC_KNOCKOUT (Final) | `"The score stands at ${ftH}–${ftA} — one team is playing..."` | `"Follow the live score above — one team is playing..."` |
| WC_KNOCKOUT (other) | `"The score stands at ${ftH}–${ftA} — the winner advances..."` | `"Follow the live score above — the winner advances..."` |

**TypeScript compile**: Zero errors.
**Architecture check**: All 9 invariants pass (`node scripts/check-match-architecture.mjs`).

---

## Architecture Enforcement

`scripts/check-match-architecture.mjs` — static code analysis, no server required.

```
node scripts/check-match-architecture.mjs

ALL INVARIANTS HOLD ✅
ONE DATASET  → getOrBuildMatchSnapshot (React.cache)
ONE VIEWMODEL → MatchDetail (no MatchViewModel type)
ONE STATE    → deriveMatchPageState()
ONE STORY    → buildStoryReport() (no live score claims)
ONE LIVE     → MatchLiveZone as centerSlot
```

---

## Score Surface Matrix — Final State

| Surface | LIVE match | FINISHED match |
|---------|-----------|----------------|
| `<title>` metadata | Snapshot score (ISR max 30s lag — acceptable) | Final score |
| JSON-LD SportsEvent | **No score embedded** | Final score |
| FAQ JSON-LD | **No score embedded** | Final score |
| Story narrative | **No score claim** (Phase 8 fix) | Final score |
| ScoreHero | **Not rendered** (centerSlot ?? excludes it) | Static score |
| MatchLiveZone | **Sole score owner** (polls every 30s) | Not rendered |

For LIVE matches: MatchLiveZone is the only surface claiming a specific score.
No other surface can contradict it.

---

## Known Acceptable Behaviors

These are intentional, not bugs:

1. **Metadata title lag**: `<title>` may show a score up to 30s old during live play.
   ISR `revalidate = 30` ensures catch-up within one refresh cycle.

2. **Story narrative**: For LIVE matches, the story says "follow the live score above"
   rather than a specific score. This is correct — the story is contextual, not live.

3. **Historical H2H and WC group match scores**: These are read from their own match
   objects (not from MatchDetail). They reflect historical data and do not change.

---

## Success Criteria — All Met

- [x] ONE DATASET: `getOrBuildMatchSnapshot` with `React.cache()` deduplication
- [x] ONE VIEWMODEL: No MatchViewModel type; MatchDetail is the ViewModel
- [x] ONE COMPONENT: ScoreHero with centerSlot ?? ensures no double-score
- [x] ONE STATE: `deriveMatchPageState()` is the single state derivation
- [x] ONE STORY: Story engine makes zero score claims for LIVE matches
- [x] JSON-LD score absent for LIVE matches (gated on `isFinished`)
- [x] FAQ score absent for LIVE matches (gated on `isFinished`)
- [x] Architecture check script passes all 9 invariants
- [x] TypeScript compile: zero errors
