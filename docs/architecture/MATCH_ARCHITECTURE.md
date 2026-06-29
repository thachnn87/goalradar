# MATCH_ARCHITECTURE.md
## DATA-18WC.MATCH.TRUTH — Phase 10: Architecture Enforcement Rules

---

## The Four Invariants

These invariants must hold at all times. Any PR that breaks one must be rejected.

---

### Invariant 1: ONE DATASET

> There MUST be exactly one function that builds or retrieves a MatchDetail for the
> match detail page. That function is `getOrBuildMatchSnapshot(id)`.

**Enforcement:**
- `getOrBuildMatchSnapshot` is wrapped with `React.cache()` in `match-snapshot.ts`
- No Server Component on the match page may call any other function that returns a `MatchDetail`
- Architecture check script verifies: zero other callers of snapshot-building functions

**Violations:**
- Adding a second `getMatchDetail()` call in `BelowTheFoldDeferred`
- Fetching match data separately in a new Suspense boundary
- Calling the provider directly from a page component

---

### Invariant 2: ONE VIEWMODEL

> `MatchDetail` (the `match` field of `MatchSnapshot`) is the ViewModel.
> No transformation layer may produce a second match object.

**Enforcement:**
- All components receive `match: MatchDetail` as a prop passed down from the page
- No component may call a data-fetching function that returns a `MatchDetail`
- `MatchLiveZone` may hold client state for `score`, `status`, `minute` only — no full MatchDetail

**Violations:**
- Introducing a `MatchViewModel` type with a mapping step
- Creating a `toViewModel(match: MatchDetail): MatchViewModel` function
- Storing a full `MatchDetail` in `useState`

---

### Invariant 3: ONE STATE

> Match page state is derived by exactly one function: `deriveMatchPageState(match)`.
> All conditional rendering branches on this value.

**Enforcement:**
- `pageState` is computed once and passed down
- No component derives its own match state from `match.status` directly for rendering decisions
- `MatchLiveZone` internal state is exempt — it is a live-update mechanism, not a page state

**Violations:**
- A component reading `match.status === 'IN_PLAY'` to show/hide UI sections
- A second `deriveMatchState()` function
- Branching on `match.status` directly for major layout decisions outside `deriveMatchPageState`

---

### Invariant 4: ONE STORY

> All narrative text for a match must come from `buildStoryReport(buildStoryContext(match))`.
> The story engine must not embed live scores for LIVE matches.

**Enforcement:**
- Only one call to `buildStoryReport` per page render
- LIVE branches in the story engine must not contain `ftH` or `ftA` inside score-claiming sentences
- Score in narrative is only permitted for `matchState === 'FINISHED'`

**Violations:**
- A second narrative builder function
- Re-introducing `${ftH}–${ftA}` in a LIVE branch intro (see Phase 8 fix)
- Generating narrative inside a component instead of the story engine

---

## The centerSlot ?? Rule

`ScoreHero` renders the center column using `centerSlot ?? (...)`. This pattern
ensures that for LIVE matches, only MatchLiveZone renders the score — the static
score block is excluded from the DOM.

```typescript
// CORRECT:
{centerSlot ?? (
  <StaticScoreBlock score={score} />
)}

// WRONG — renders both:
{centerSlot}
{!centerSlot && <StaticScoreBlock score={score} />}

// WRONG — renders static score regardless:
<>
  <StaticScoreBlock score={score} />
  {pageState === 'LIVE' && <MatchLiveZone ... />}
</>
```

**Enforcement**: Architecture check script scans for the `??` pattern on `centerSlot`.

---

## Score Gating Rules

| Context | Rule | Guard |
|---------|------|-------|
| JSON-LD score | FINISHED only | `const hasScore = isFinished && homeScore != null` |
| FAQ result/scorer | FINISHED only | `if (isFinished)` block |
| Story score claim | FINISHED only | `if (matchState === 'FINISHED')` |
| generateMetadata score | Allowed for LIVE | In title only, snapshot score — acceptable ISR lag |
| MatchLiveZone score | LIVE only | Rendered only as `centerSlot` |
| ScoreHero static score | Not LIVE | Excluded by `centerSlot ??` pattern |

---

## Acceptable Staleness

The following are NOT violations — they are accepted ISR lag behaviors:

| Surface | Staleness | Why Acceptable |
|---------|----------|----------------|
| Metadata title score | Up to 30s | ISR revalidate=30s; re-generated on next request |
| Story text (for FINISHED) | Snapshot score | Same object as all other surfaces — consistent |
| H2H match scores | Historical | Historical data does not change |
| WC group match scores | Historical/current | Read from their own match objects, not MatchDetail |

---

## Architecture Check CI Integration

The `scripts/check-match-architecture.mjs` script is a static code check — no
server required. It can run in CI as a pre-build step:

```yaml
# In CI pipeline (example):
- name: Match architecture check
  run: node scripts/check-match-architecture.mjs
```

Exit code 0 = clean. Exit code 1 = violation found.

---

## Summary

```
ONE DATASET  →  getOrBuildMatchSnapshot (React.cache deduped)
ONE VIEWMODEL →  snapshot.match (MatchDetail, no transformation)
ONE STATE    →  deriveMatchPageState(match) → pageState
ONE STORY    →  buildStoryReport(buildStoryContext(match))
ONE LIVE     →  MatchLiveZone as centerSlot (score-agnostic story)
```
