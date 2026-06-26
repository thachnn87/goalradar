# Regression Check — WC 2026 UI Sprint

> Architecture invariants that MUST survive every UI change.
> Run this checklist after every PR before merge.

---

## Architecture Invariants — ABSOLUTE

These rules do not change in a UI sprint:

### Data Architecture
- **ONE SOURCE**: `goalradar:wc:authority:v1` — no new WC data sources
- **ONE PIPELINE**: `authority:v1 → enrichKnockoutSlots → canonicalToMatch → Match[]`
- **ONE VIEW MODEL**: `MatchDetail` drives all match page states
- **NO new API routes** in `src/app/api/`
- **NO new KV cache keys**
- **NO duplicate data fetching** — no calling `getStandingsCached` on a page that already has it from a parent

### Routing Architecture
- **ONE ROUTE per feature** — no parallel `/wc-bracket` alongside `/world-cup-2026/bracket`
- All existing routes must continue to work with no redirects added or removed

### Component Architecture
- **ONE MatchCard** — after unification, `BracketMatchCard`, `ResultRow`, `LocalKnockoutRound` must be deleted
- Any new component must be a **presentation-only** wrapper, not a data-fetching component
- No new `getWhateverCached` calls inside components

---

## Regression Test Checklist

### After EVERY change

```
[ ] npx tsc --noEmit → zero errors (filter known stale artifact: third-place-playoff)
[ ] npm run build → succeeds
[ ] /world-cup-2026 renders without crash
[ ] /schedule?competition=WC shows match cards (not TBD)
[ ] /world-cup-2026/fixtures renders without crash
[ ] /world-cup-2026/bracket renders bracket without crash
[ ] /world-cup-2026/groups renders group tables
[ ] /match/[any-id] renders without crash
[ ] /world-cup-2026/round-of-32 renders (WCRoundPage)
```

### After MatchCard Changes

```
[ ] /schedule?competition=WC — match cards render
[ ] /world-cup-2026 Hub — match cards render (Live, Today, Upcoming sections)
[ ] /world-cup-2026/fixtures — match cards render
[ ] /world-cup-2026/results — match rows render
[ ] /world-cup-2026/round-of-32 — match cards render
[ ] /world-cup-2026/round-of-16 — match cards render
[ ] /world-cup-2026/quarter-finals — match cards render
[ ] /world-cup-2026/semi-finals — match cards render
[ ] /world-cup-2026/third-place — match card renders
[ ] /world-cup-2026/final — match card renders
[ ] /world-cup-2026/bracket — bracket match cards render
[ ] All MatchCard variants work: medium, compact, bracket, result, featured, slot
[ ] PROJECTED match shows slot labels (not empty, not "TBD")
[ ] LIVE match shows red pulse badge
[ ] FINISHED match shows score with FT badge
[ ] Non-linkable card (id <= 0) is NOT a link — no broken navigation
```

### After WCBracket Changes

```
[ ] Desktop: full horizontal bracket renders
[ ] Mobile: accordion or horizontal scroll renders without overflow
[ ] All bracket match cards are clickable (where match.id > 0)
[ ] Connector lines visible between rounds
[ ] Third Place and Final cards render with correct theme
[ ] No BracketMatchCard references remain in the file
```

### After WCGroupTable Changes

```
[ ] /world-cup-2026/groups — all 12 groups render
[ ] /world-cup-2026 Hub — group table renders in tabbed section
[ ] /world-cup-2026/[group-a through group-l] — individual group pages render
[ ] Qualification colours still applied (green/amber/none borders)
[ ] Form pills render correctly (W/D/L)
[ ] Mobile: W/D/L columns hidden, Pts visible
```

### After Design Token / Tailwind Config Changes

```
[ ] No new horizontal overflow on any page at 390px
[ ] Dark theme consistent (no white backgrounds appearing)
[ ] amber-400/amber-500 used consistently (not yellow-400 on some pages, amber on others)
[ ] Card border colours correct (gray-800/60 at rest, gray-700 on hover)
```

### After Hub Page Changes

```
[ ] Hero section renders without crash
[ ] Live + Today merged section works when matches are live
[ ] Live + Today merged section works when no live matches (shows just Today)
[ ] Group standings tabbed UI: tab switching works
[ ] ResultRow replaced by MatchCard variant="result" — still shows correct scores
[ ] Crawler discovery nav still present (for SEO) — can be visually hidden but must exist in DOM
```

### After Schedule Changes

```
[ ] WC tab shows correct matches (no TBD regression)
[ ] PL, La Liga etc. still work
[ ] CompetitionSelector Suspense fallback is not null (no CLS)
[ ] SkeletonGrid is structural (has date header placeholders)
```

---

## Snapshot / KV Layer — Must Not Regress

From commits `5da7235`, `16db72e`:

```
[ ] PROJECTED knockout snapshots expire in 5 min (not 6h)
[ ] TBD-RESOLVE self-heal triggers on stale PROJECTED snapshots
[ ] Live match status from getCurrentLiveMatches() (not authority)
[ ] Schedule WC branch uses: getWCAuthorityMatchesV2 → enrichKnockoutSlots → canonicalToMatch
```

---

## Files FORBIDDEN from Modification in UI Sprint

These files contain the data architecture. DO NOT modify:

```
src/lib/match-snapshot.ts      ← snapshot layer (recently fixed)
src/lib/knockout-vm.ts         ← enrichKnockoutSlots
src/lib/api.ts                 ← data fetching layer
src/lib/canonical-match.ts     ← CanonicalMatch → Match adapter
src/lib/wc-qualification.ts    ← qualification engine
src/lib/wc-live-ssot.ts        ← live SSOT
src/lib/wc-fixtures.ts         ← static slot schedules
src/lib/wc-rounds.ts           ← round config
src/app/api/**                 ← all API routes
```

If a UI change seems to require modifying these files, stop and escalate. The requirement is likely solvable in the presentation layer.

---

## Known Stale Artifact (filter from tsc output)

```
.next/dev/types/validator.ts(602,39): error TS2307: Cannot find module
  '../../../src/app/world-cup-2026/third-place-playoff/page.js'
```

This is a pre-existing `.next/` cache artifact, not a real error. Filter with:
```bash
npx tsc --noEmit 2>&1 | grep -v "third-place-playoff"
```

Any OTHER error is a real regression and must be fixed before merge.

---

## Production Smoke Test (post-deploy)

After Vercel deployment:

```bash
# Journey gate
CRAWL_BASE_URL=https://www.goalradar.org node scripts/check-wc-journeys.mjs

# Guardian check
CRAWL_BASE_URL=https://www.goalradar.org node scripts/guardian.mjs
```

Manual checks on production:
```
[ ] https://www.goalradar.org/world-cup-2026 — hub renders, no white screen
[ ] https://www.goalradar.org/schedule?competition=WC — matches visible
[ ] https://www.goalradar.org/world-cup-2026/bracket — bracket visible
[ ] https://www.goalradar.org/world-cup-2026/groups — all 12 groups
[ ] https://www.goalradar.org/match/537417-south-africa-vs-canada — NOT PROJECTED (teams confirmed)
```
