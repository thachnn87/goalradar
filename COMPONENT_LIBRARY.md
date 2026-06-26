# Component Library — WC 2026

> ONE COMPONENT per concept. Variants via props, not separate files.
> No new data logic. Presentation layer only.
> All components: dark theme only.

---

## Core Principle

Every display of a match on any WC page must use **one** `MatchCard` component.

Current violations to eliminate:
| Duplicate Component | Location | Action |
|--------------------|----------|--------|
| `BracketMatchCard` | `WCBracket.tsx:72` | Replace with `MatchCard variant="bracket"` |
| `ResultRow` | `world-cup-2026/page.tsx:220` | Replace with `MatchCard variant="result"` |
| `LocalKnockoutRound` row | `world-cup-2026/page.tsx:269` | Replace with `MatchCard variant="slot"` |
| `MatchDateList` row | `fixtures/page.tsx` | Replace with `MatchCard variant="compact"` |
| `ThirdPlaceCard` | `bracket/page.tsx` | Replace with `MatchCard variant="featured" theme="bronze"` |
| `FinalCard` | `bracket/page.tsx` | Replace with `MatchCard variant="featured" theme="gold"` |

---

## MatchCard (UNIFIED)

**File**: `src/components/MatchCard.tsx`
**Rule**: ONE component. All match display uses this.

### Props

```typescript
type MatchCardVariant = 
  | 'medium'    // default — 3-col grid cards
  | 'compact'   // list row — fixtures page, schedule
  | 'bracket'   // fixed dimensions for bracket
  | 'result'    // horizontal score — hub recent results
  | 'featured'  // full-width premium — Final, Third Place
  | 'slot'      // pre-tournament TBD slot (LocalKnockoutRound replacement)

interface MatchCardProps {
  match: Match | CanonicalMatch;
  variant?: MatchCardVariant;           // default: 'medium'
  theme?: 'default' | 'gold' | 'bronze';
  showCompetition?: boolean;            // show competition name label
  showGroup?: boolean;                  // show group label (Group A, etc.)
  showVenue?: boolean;                  // show venue city in footer
  className?: string;
}
```

### Variant: medium (default — grid cards, all pages)

```
bg-gray-950 border border-gray-800/60 rounded-xl p-4
hover:border-gray-700 hover:bg-gray-900
transition-[border-color,background-color] duration-150
```

Layout: competition label top-left | status badge top-right | team rows | matchProgress footer

### Variant: compact (list row — schedule / fixtures)

```
flex items-center px-4 py-3 gap-3 rounded-xl
hover:bg-gray-900/60 transition-colors duration-150
```

Layout: `[time] [home crest + name] [score/vs] [away name + crest] [status]`
One line, horizontal. Used in fixtures page list view.

### Variant: bracket (knockout bracket card)

Fixed dimensions to align with bracket SVG: `w-[168px] h-[68px]`
```
flex flex-col justify-between rounded-lg border overflow-hidden
```

Layout: two condensed team rows (short name + score). No competition label, no time.
For Final: apply `theme="gold"` gradient background.

### Variant: result (hub recent results, Hub page)

```
flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-800/60
```

Layout: `[date] [home name + crest → score ← crest + away name]`
Symmetric horizontal layout with score centred. Replaces current `ResultRow`.

### Variant: featured (Final, Third Place)

```
bg-gradient-to-br rounded-2xl p-5 sm:p-6
```

Themes:
- `theme="gold"`: `from-yellow-950/50 to-gray-950 border-yellow-600/40 shadow-wc-gold`
- `theme="bronze"`: `from-amber-950/40 to-gray-950 border-amber-700/30`

Layout: large crests (56px for Final, 40px for Third Place), centred score, stage label badge, venue.

### Variant: slot (pre-tournament TBD — replaces LocalKnockoutRound)

```
flex items-center justify-between px-4 py-3 border-b border-gray-800/40
```

Layout: `[home slot label] [round + date] [away slot label]`
Shows slot labels from `enrichKnockoutSlots` (e.g. "1st Group A") with amber `UPCOMING` badge.
No link when `match.id <= 0`.

### Skeleton

```tsx
function MatchCardSkeleton({ variant = 'medium' }: { variant?: MatchCardVariant }) {
  if (variant === 'compact') {
    return <div className="h-12 bg-gray-950 border border-gray-800/60 rounded-xl animate-pulse" />;
  }
  return (
    <div className="bg-gray-950 border border-gray-800/60 rounded-xl p-4 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-3 w-20 bg-gray-800 rounded" />
        <div className="h-4 w-10 bg-gray-800 rounded-full" />
      </div>
      <div className="space-y-2.5">
        {[0, 1].map(i => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-5 w-5 bg-gray-800 rounded-full" />
            <div className="h-3 flex-1 bg-gray-800 rounded" />
            <div className="h-4 w-4 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Export `MatchCardSkeleton` alongside the default export.

### Implementation Notes

- Replace `<img>` with `next/image` for crest display — set `width`, `height`, `loading="lazy"` for below-fold crests
- Replace `transition-all` with `transition-[border-color,background-color,transform,box-shadow]`
- Add `focus-visible:ring-2 focus-visible:ring-amber-400/70` to the wrapping `MatchLink`
- `StatusBadge` — export it so it can be used independently on the Results page
- For PROJECTED state: show slot label text instead of "TBD" fallback

---

## WCBracket (Enhanced)

**File**: `src/components/WCBracket.tsx`

### Current → Target

| Current | Target |
|---------|--------|
| `BracketMatchCard` (duplicate) | `MatchCard variant="bracket"` |
| Fixed px, not responsive | Fixed px on desktop; accordion on mobile |
| No hover path highlight | CSS hover reveals connected path |
| No animated connectors | SVG `stroke-dashoffset` animation on mount |
| No winner glow | Gold `drop-shadow` on winning team name |

### Connector Animation

Each SVG connector animates in on bracket load:
```css
.wc-bracket-connector {
  stroke-dasharray: var(--path-length);
  stroke-dashoffset: var(--path-length);
  animation: drawConnector 300ms ease-out forwards;
  animation-delay: calc(var(--match-index) * 50ms);
}

@keyframes drawConnector {
  to { stroke-dashoffset: 0; }
}
```

### Hover Path Highlighting

When hovering a bracket match card, add a `data-match-id` attribute. CSS sibling-connector SVGs use CSS custom property / JS class toggle to highlight which match this feeds into and feeds from.

```js
// On card mouse-enter: add class to parent bracket container
bracketEl.setAttribute('data-hover-match', matchId);
// CSS: [data-hover-match="123"] .connector-to-123 { stroke: rgba(245,158,11,0.6); }
```

### Mobile Bracket

On mobile (`< 768px`), render an **accordion by round** instead of the horizontal bracket:
```
[Round of 32 ▼]  (expanded by default for current round)
  Match 1
  Match 2
  ...
[Round of 16 ▷]
[Quarter-finals ▷]
...
```

Each round is a `<details>/<summary>` with WCRoundPage link. Active round is open by default.

---

## WCGroupTable (Enhanced)

**File**: `src/components/WCGroupTable.tsx`

### Current → Target

| Current | Target |
|---------|--------|
| P/W/D/L/Pts columns | Add form pills column (5 recent results) |
| Left-border colour only | Add thin qualification bar beside position |
| No responsive column hiding | Hide W/D/L on mobile, keep P/Pts/Form |
| No `scope="col"` on `<th>` | Add `scope="col"` to all headers |
| No sticky group header | Add `sticky top-0` to group header row |

### Form Pills

```tsx
function FormPills({ form }: { form?: string }) {
  if (!form) return null;
  const results = form.split(',').slice(-5).reverse();
  return (
    <div className="flex gap-0.5">
      {results.map((r, i) => (
        <span
          key={i}
          className={`inline-flex items-center justify-center w-4 h-4 rounded-sm text-[10px] font-bold
            ${r === 'W' ? 'bg-emerald-500/20 text-emerald-400' :
              r === 'D' ? 'bg-yellow-500/15 text-yellow-400' :
              'bg-red-500/15 text-red-400'}`}
        >
          {r}
        </span>
      ))}
    </div>
  );
}
```

Note: `text-[10px]` is acceptable here ONLY for the form pill letter — it's a single character inside a 16×16 fixed box, not a label.

### Responsive Column Hiding

```tsx
// Show on all:   Pos, Team, Pts
// Hide on mobile (hidden sm:table-cell): W, D, L, GD
// Show form pills: always
```

---

## WCCountdown (Enhanced)

**File**: `src/components/WCCountdown.tsx`

### Enhancement: Digit Flip Animation

Wrap each countdown digit in a container with CSS perspective + rotateX transition:
```css
.wc-digit {
  display: inline-block;
  transition: transform 200ms ease-in-out;
}
.wc-digit.flip {
  transform: rotateY(90deg);
}
```

Toggle class when digit changes. Remove after transition. Respects `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  .wc-digit { transition: none; }
}
```

---

## WCRoundPage (Enhanced)

**File**: `src/components/WCRoundPage.tsx`

### Enhancement: Stage Progress Header

Add a visual tournament stage progress indicator above the hero on knockout round pages:

```tsx
function StageProgress({ currentStage }: { currentStage: string }) {
  const stages = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'];
  const currentIndex = stages.indexOf(currentStage);
  
  return (
    <div className="flex items-center gap-1 text-xs text-gray-500 mb-4">
      {stages.map((s, i) => (
        <React.Fragment key={s}>
          <span className={i <= currentIndex ? 'text-amber-400 font-medium' : ''}>
            {STAGE_SHORT[s]}
          </span>
          {i < stages.length - 1 && <span className="text-gray-700">›</span>}
        </React.Fragment>
      ))}
    </div>
  );
}
```

### Enhancement: Prev/Next as Cards

Replace bare text links with styled navigation cards:

```tsx
function RoundNavCard({ round, direction }: { round: WCRoundConfig; direction: 'prev' | 'next' }) {
  return (
    <Link
      href={`/world-cup-2026/${round.slug}`}
      className="flex items-center gap-3 bg-gray-950 border border-gray-800/60 rounded-xl px-4 py-3 
                 hover:border-gray-700 transition-colors group flex-1"
    >
      {direction === 'prev' && <span className="text-gray-500 group-hover:text-gray-300">←</span>}
      <div className={direction === 'next' ? 'ml-auto text-right' : ''}>
        <p className="text-xs text-gray-500">{direction === 'prev' ? 'Previous' : 'Next'}</p>
        <p className="text-sm font-semibold text-gray-300 group-hover:text-white">{round.label}</p>
      </div>
      {direction === 'next' && <span className="text-gray-500 group-hover:text-gray-300">→</span>}
    </Link>
  );
}
```

---

## New: WCStageHeader

**File**: `src/components/WCStageHeader.tsx`

Tournament stage progression breadcrumb — shows current position in the bracket path.

```tsx
interface WCStageHeaderProps {
  currentStage: 'GROUP_STAGE' | 'LAST_32' | 'LAST_16' | 'QUARTER_FINALS' | 'SEMI_FINALS' | 'THIRD_PLACE' | 'FINAL';
}

export default function WCStageHeader({ currentStage }: WCStageHeaderProps) {
  // Renders: Group Stage → R32 → R16 → QF → SF → Final
  // Current stage highlighted in amber; past stages in gray-400; future in gray-700
}
```

---

## New: WCTeamCrest

**File**: `src/components/WCTeamCrest.tsx`

Unified team crest display with TBD fallback.

```typescript
type CrestSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
// xs=16, sm=20, md=28, lg=40, xl=56

interface WCTeamCrestProps {
  crest?: string;
  name?: string;      // for alt text
  size?: CrestSize;
  ring?: boolean;     // show subtle border ring
  tbd?: boolean;      // force TBD display
}
```

TBD state: `rounded-full bg-gray-800 border border-dashed border-gray-600` with `?` centered.
Non-tbd with no crest: gray circle with team initial letter.

This replaces all bare `<img src={crest} />` patterns across the codebase.

---

## Accessibility Checklist for All Components

Every component must:
- [ ] `focus-visible:ring-2 focus-visible:ring-amber-400/70` on all `<Link>` and `<button>`
- [ ] `aria-hidden="true"` on all decorative emojis
- [ ] `alt=""` on decorative crest images (correct)
- [ ] `aria-label` on links whose text content alone is insufficient
- [ ] No `text-gray-700` for meaningful text (use `text-gray-500` minimum)
- [ ] `scope="col"` on all `<th>` in tables
- [ ] Minimum 44px touch target on mobile for all interactive elements
- [ ] `@media (prefers-reduced-motion: reduce)` guard on all CSS animations
