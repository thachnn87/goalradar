# Page Redesign Plan — WC 2026

> Presentation layer only. No new API routes. No new cache keys. No new data logic.
> Every change must flow from: authority:v1 → enrichKnockoutSlots → canonicalToMatch → Match[]

---

## Redesign Principles

1. **ONE ROUTE per page** — no parallel routes for same content
2. **Presentation layer only** — component changes, not data changes
3. **Mobile-first** — design for 390px width, then enhance
4. **Ship incrementally** — Phase A establishes foundation; Phases B–D build on it

---

## Phase A — Foundation (Week 1)
*Establish design tokens, fix accessibility baseline, unify MatchCard*

### A1: Design Tokens in `tailwind.config.ts`

Add custom tokens:
```js
theme: {
  extend: {
    boxShadow: {
      'wc-card':   '0 1px 3px rgba(0,0,0,0.40), 0 1px 2px rgba(0,0,0,0.24)',
      'wc-raised': '0 4px 6px rgba(0,0,0,0.40), 0 2px 4px rgba(0,0,0,0.24)',
      'wc-live':   '0 0 0 1px rgba(239,68,68,0.4), 0 0 12px rgba(239,68,68,0.15)',
      'wc-gold':   '0 0 0 1px rgba(245,158,11,0.4), 0 0 16px rgba(245,158,11,0.12)',
    },
    transitionProperty: {
      'wc': 'border-color, background-color, transform, box-shadow',
    },
  }
}
```

### A2: MatchCard Unification

**File**: `src/components/MatchCard.tsx`

1. Add `variant` prop: `'medium' | 'compact' | 'bracket' | 'result' | 'featured' | 'slot'`
2. Add `theme` prop: `'default' | 'gold' | 'bronze'`
3. Replace `<img>` with `next/image` (or add `loading="lazy"`, `width`, `height` explicitly)
4. Replace `transition-all` with `transition-[border-color,background-color]`
5. Add `focus-visible:ring-2 focus-visible:ring-amber-400/70` to MatchLink
6. Export `MatchCardSkeleton`
7. Handle PROJECTED: show slot label text instead of "TBD"

**Files to delete/refactor after**:
- `BracketMatchCard` in `WCBracket.tsx` → replaced by `MatchCard variant="bracket"`
- `ResultRow` in `world-cup-2026/page.tsx` → replaced by `MatchCard variant="result"`
- `LocalKnockoutRound` in `world-cup-2026/page.tsx` → replaced by `MatchCard variant="slot"`

### A3: Accessibility Baseline

Apply to all files in a single pass:
```bash
# Find all files missing aria-hidden on emojis
# Find all interactive elements missing focus-visible ring
# Fix aria-labelledby → assign IDs to SectionHeader h2s
```

Changes:
- `SectionHeader` in `world-cup-2026/page.tsx`: add `id={titleId}` to the `<h2>`
- All `<img>` crest elements with broken alt: verify `alt=""`
- All `aria-hidden` missing on emoji spans
- All interactive Links: add `focus-visible:ring-2 focus-visible:ring-amber-400/70`
- All `text-gray-700` meaningful text → `text-gray-500` minimum
- All `text-[10px]` → `text-xs`

---

## Phase B — High-Traffic Pages (Week 2)

### Hub (`/world-cup-2026`)

**Files to modify**: `src/app/world-cup-2026/page.tsx`

#### B1: Tournament Hero (replace emoji hero)

Replace:
```tsx
<div className="... bg-gradient-to-br from-yellow-950/30 ...">
  <div className="text-6xl mb-4">🏆</div>
  <h1>FIFA World Cup 2026</h1>
```

With a proper `WCTournamentHero` section:
```tsx
<section className="relative overflow-hidden rounded-2xl bg-gray-950 border border-amber-800/20 p-6 sm:p-8 mb-8">
  {/* Ambient gradient */}
  <div className="absolute inset-0 bg-gradient-to-br from-amber-950/20 via-transparent to-violet-950/10 pointer-events-none" aria-hidden />
  
  {/* Content */}
  <div className="relative">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">FIFA World Cup 2026</span>
      <span className="text-gray-700">·</span>
      <span className="text-xs text-gray-500">USA · Canada · Mexico</span>
    </div>
    <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
      The World Cup is <span className="text-amber-400">Happening Now</span>
    </h1>
    <p className="text-gray-400 text-sm max-w-lg">
      48 nations. 104 matches. 3 host countries. Follow every goal, every result, every moment.
    </p>
  </div>
  
  {/* Quick stats row */}
  <div className="relative flex gap-4 mt-5 pt-5 border-t border-gray-800/60">
    <div><p className="text-white font-black text-xl tabular-nums">{playedCount}</p><p className="text-gray-500 text-xs">Matches played</p></div>
    <div><p className="text-white font-black text-xl tabular-nums">{goalCount}</p><p className="text-gray-500 text-xs">Total goals</p></div>
    <div><p className="text-amber-400 font-black text-xl tabular-nums">{liveCount || remainingCount}</p><p className="text-gray-500 text-xs">{liveCount ? 'Live now' : 'Remaining'}</p></div>
  </div>
</section>
```

No new data needed — computed from existing `authorityData.matches`.

#### B2: Merge Live + Today sections

Replace two separate sections with one "Today" section:

```tsx
// Merge: liveMatches + todayMatches, sorted by utcDate
// Live matches get 'live' visual treatment (red border ring, pulsing badge)
// Scheduled/upcoming today get standard treatment
// Section title: "Live Now" if any live, else "Today's Matches"
```

**Implementation**: filter `authorityData.matches` for `utcDate.startsWith(todayUTC())` OR `state === 'live'`. No new API call.

#### B3: Remove dual sticky nav

Remove the sticky section-jump nav (the one with 📅 🏁 📊 🔗 🗂 icons). WCPageNav already provides navigation.

#### B4: Groups section → Tabbed accordion

Replace the full 12-group grid with a tab UI:
```tsx
// Group A | B | C | D | E | F | G | H | I | J | K | L
// Click tab → show that group's WCGroupTable
// Default: first group with a live/recently-played match, or Group A
// "View all groups →" link below
```

**Implementation**: client component for tab state, passes selected group to conditional render. All 12 WCGroupTable instances still rendered as RSC — client only tracks `selectedGroup`.

#### B5: ResultRow → MatchCard variant="result"

Replace `ResultRow` component with `<MatchCard variant="result" />`.

---

### Schedule (`/schedule?competition=WC`)

**Files to modify**: `src/app/schedule/page.tsx`

#### B6: Structural skeleton matching date headers

Replace:
```tsx
function SkeletonGrid() {
  return <div className="grid ...">...</div>
}
```

With:
```tsx
function ScheduleSkeleton() {
  return (
    <div className="space-y-8">
      {[0, 1].map(day => (
        <div key={day}>
          <div className="h-4 w-24 bg-gray-800 rounded animate-pulse mb-3" /> {/* Date header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0,1,2].map(i => <MatchCardSkeleton key={i} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
```

#### B7: CompetitionSelector Suspense fallback

Replace `fallback={null}` with `fallback={<CompetitionSelectorSkeleton />}` — a non-null placeholder that reserves height.

#### B8: LIVE NOW pinned section

When `wcLiveMatches.length > 0`, render a LIVE NOW section above the date groups:
```tsx
{wcLiveMatches.length > 0 && (
  <div className="bg-red-950/10 border border-red-900/20 rounded-xl p-4 mb-2">
    <SectionHeader title="Live Now" live />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {wcLiveMatches.map(m => <MatchCard key={m.id} match={m} />)}
    </div>
  </div>
)}
```

`wcLiveMatches` already fetched from `getCurrentLiveMatches()` — no new data.

---

### Groups (`/world-cup-2026/groups`)

**Files to modify**: `src/app/world-cup-2026/groups/page.tsx`

#### B9: Suspense + skeleton

Wrap `getStandingsCached` section in Suspense with `WCGroupsSkeleton`:
```tsx
<Suspense fallback={<WCGroupsSkeleton />}>
  <GroupsContent />
</Suspense>
```

`WCGroupsSkeleton`: 12 `WCGroupTableSkeleton` components in the same 1/2/3-col grid.

#### B10: Fix Browse Groups tiles

Replace `text-[10px]` with `text-xs`. Increase tile padding to ensure 44px minimum touch target.

---

## Phase C — Bracket + Round Pages (Week 3)

### Bracket (`/world-cup-2026/bracket`)

**Files to modify**: `src/app/world-cup-2026/bracket/page.tsx`, `src/components/WCBracket.tsx`

#### C1: Remove "All Knockout Matches" duplicate

Delete the exhaustive flat list at the bottom of bracket/page.tsx. Users can navigate to per-round pages via the round pill nav. This removes ~200 lines and the primary source of duplication.

#### C2: WCBracket — replace BracketMatchCard

Inside `WCBracket.tsx`:
- Delete `BracketMatchCard` component
- Import `MatchCard` and render `<MatchCard variant="bracket" match={match} />`
- Wrap with same `isLinkable` guard

#### C3: WCBracket — mobile accordion

Add a `mode` prop to WCBracket:
```typescript
interface WCBracketProps {
  matches: Match[];
  mode?: 'desktop' | 'mobile';  // auto-detected via a 'use client' wrapper
}
```

For mobile mode: render rounds as `<details>/<summary>` accordion. Current round opened by default.

#### C4: SVG connector animation

Add `stroke-dasharray`/`stroke-dashoffset` animation to bracket connectors (see MOTION_GUIDELINES.md).

#### C5: Shared SpecialMatchCard for Third Place + Final

Extract to a parameterized component:
```tsx
// Replaces ThirdPlaceCard + FinalCard + inline-final-slot in bracket/page.tsx
<SpecialMatchCard match={thirdPlaceMatch} theme="bronze" stage="THIRD_PLACE" />
<SpecialMatchCard match={finalMatch} theme="gold" stage="FINAL" />
```

Map to `MatchCard variant="featured" theme="gold/bronze"`.

### Round Pages (`WCRoundPage.tsx`)

**Files to modify**: `src/components/WCRoundPage.tsx`

#### C6: Stage Progress Header

Add `<WCStageProgress currentStage={round.stage} />` above the hero.

#### C7: Prev/Next as Cards

Replace bare text links with `<RoundNavCard>` styled cards (see COMPONENT_LIBRARY.md).

#### C8: ScheduleSlots contrast fix

Replace `text-gray-700` with `text-gray-500` on venue city and footnote text.

---

## Phase D — Match Page + Team Page + Polish (Week 4)

### Match Page (`/match/[id]`)

**Files to modify**: `src/app/match/[id]/page.tsx`

Match page has the 6-state machine already. Polish items:

#### D1: LIVE score prominence

Current live score is `text-5xl`. Ensure:
```tsx
<div className="text-6xl sm:text-7xl font-black tabular-nums text-white text-center">
  {homeScore} — {awayScore}
</div>
```

#### D2: PROJECTED hero — slot label emphasis

Current TBD slots show slot labels. Ensure `WCTeamCrest` TBD state used with dashed ring.

#### D3: PRE_MATCH countdown above fold on mobile

Ensure countdown timer is in the hero section, visible without scrolling on 390px viewport.

### Team Page (`/world-cup-2026/team/[slug]`)

**Files to modify**: `src/components/WCTeamPageContent.tsx`

#### D4: Inline group standing

Pull the team's row from `WCGroupTable` data and show it inline:
```tsx
// Below team crest + name: show team's current group position
<div className="flex items-center gap-3 mt-4 p-3 bg-gray-900 rounded-lg">
  <span className="text-2xl font-black text-amber-400">#{standing.position}</span>
  <div>
    <p className="text-white text-sm font-semibold">{groupLabel}</p>
    <p className="text-gray-400 text-xs">{standing.points} pts · {form}</p>
  </div>
</div>
```

Data: `getStandingsCached('WC')` already available in the page hierarchy.

#### D5: Qualification status badge

Show `WCQualBadge` (existing component) prominently on team hero.

---

## Implementation Sequence

```
Week 1 (Phase A):
  A1 tailwind.config.ts tokens        → 30min
  A2 MatchCard unification            → 3h
  A3 Accessibility baseline pass      → 2h

Week 2 (Phase B):
  B1–B5 Hub redesign                  → 4h
  B6–B8 Schedule improvements         → 2h
  B9–B10 Groups improvements          → 1h

Week 3 (Phase C):
  C1–C5 Bracket upgrades              → 4h
  C6–C8 WCRoundPage improvements      → 2h

Week 4 (Phase D):
  D1–D3 Match page polish             → 2h
  D4–D5 Team page inline standing     → 1h
  Final cross-browser QA              → 2h
  Lighthouse run                      → 30min
```

---

## Files NOT to touch

```
src/lib/match-snapshot.ts     — snapshot layer (already fixed)
src/lib/knockout-vm.ts        — enrichKnockoutSlots (already fixed)
src/lib/api.ts                — data fetching layer
src/lib/canonical-match.ts    — canonical adapter
src/lib/wc-qualification.ts   — qualification engine
src/lib/wc-live-ssot.ts       — live SSOT
src/app/api/                  — all API routes
```
