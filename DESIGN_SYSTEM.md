# WC 2026 Design System

> Dark theme only. All tokens expressed as Tailwind utility class aliases and/or CSS custom properties.

---

## Design Principles

1. **Broadcast Quality** — every element should feel like it belongs on an official sports broadcast
2. **Data Trust** — typography and spacing make data readable at a glance; nothing is ambiguous
3. **Event Energy** — colour, motion, and hierarchy communicate that this is THE sporting event
4. **Presentation Only** — the design system never creates data logic; it only styles what exists

---

## Colour Palette

### Surfaces (dark backgrounds)

```
--wc-surface-base:     #0a0a0f   /* page background */
--wc-surface-raised:   #111118   /* card level 1 */
--wc-surface-elevated: #1a1a24   /* card level 2 / hover */
--wc-surface-overlay:  #22222e   /* modal / dropdown */
```

Tailwind mapping:
```
bg-[#0a0a0f]   → surface-base
bg-gray-950    → surface-raised  (≈ #0c111d — close enough, use consistently)
bg-gray-900    → surface-elevated (≈ #111827)
bg-gray-800    → surface-overlay  (≈ #1f2937)
```

**Rule**: Never mix `bg-gray-900` and `bg-[#111827]` — always use a single class name per surface level.

### Brand / Accent

```
--wc-gold:          #f59e0b   /* primary brand accent (amber-500) */
--wc-gold-muted:    rgba(245,158,11,0.15)  /* gold tint */
--wc-gold-border:   rgba(245,158,11,0.30)  /* gold border */
```

Tailwind: `text-amber-500`, `bg-amber-500/15`, `border-amber-500/30`

### Status Colours

| Status | Text | Background | Border |
|--------|------|-----------|--------|
| LIVE | `text-red-400` | `bg-red-500/15` | `border-red-500/30` |
| UPCOMING / TIMED | `text-blue-400` | `bg-blue-500/10` | `border-blue-500/20` |
| FINISHED | `text-gray-400` | `bg-gray-700/50` | `border-gray-700` |
| PROJECTED | `text-amber-400` | `bg-amber-500/10` | `border-amber-500/20` (dashed) |
| QUALIFIED | `text-emerald-400` | `bg-emerald-500/10` | `border-emerald-500/25` |
| CANCELLED | `text-gray-500` | `bg-gray-800/60` | `border-gray-700/50` |
| PAUSED (HT) | `text-yellow-400` | `bg-yellow-500/10` | `border-yellow-500/25` |

### Qualification Colours (Group Table)

| Position | Border Left | Row Tint |
|----------|------------|---------|
| 1st–2nd (Advance) | `border-l-emerald-500` | `bg-emerald-500/5` |
| 3rd (Possible) | `border-l-amber-500` | `bg-amber-500/5` |
| 4th (Eliminated) | `border-l-gray-700` | (none) |

### Stage Colours (Bracket)

| Stage | Accent |
|-------|--------|
| LAST_32 | `text-sky-400` / `border-sky-500/30` |
| LAST_16 | `text-blue-400` / `border-blue-500/30` |
| QUARTER_FINALS | `text-violet-400` / `border-violet-500/30` |
| SEMI_FINALS | `text-pink-400` / `border-pink-500/30` |
| THIRD_PLACE | `text-amber-500` / `border-amber-600/40` (bronze) |
| FINAL | `text-yellow-400` / `border-yellow-500/40` (gold) |

### Text Hierarchy

```
Primary text:    text-white           (headings, team names, scores)
Secondary text:  text-gray-300        (subtitles, body copy)
Tertiary text:   text-gray-400        (section labels, metadata)
Muted text:      text-gray-500        (timestamps, supplementary info)
Disabled text:   text-gray-600        (MINIMUM — only for non-interactive decorative labels)
```

**Rule**: `text-gray-700` is FORBIDDEN for any text that carries meaning. Minimum meaningful text: `text-gray-500`.

### Gradient System

```css
/* Hero background */
.wc-hero-gradient {
  background: linear-gradient(
    135deg,
    rgba(245,158,11,0.08) 0%,
    transparent 50%,
    rgba(139,92,246,0.06) 100%
  );
}

/* Card premium */
.wc-card-premium {
  background: linear-gradient(
    135deg,
    rgba(255,255,255,0.04) 0%,
    rgba(255,255,255,0.01) 100%
  );
}

/* Final gold */
.wc-final-gradient {
  background: linear-gradient(
    135deg,
    rgba(234,179,8,0.12) 0%,
    rgba(120,53,15,0.08) 100%
  );
}

/* Third place bronze */
.wc-bronze-gradient {
  background: linear-gradient(
    135deg,
    rgba(245,158,11,0.10) 0%,
    rgba(120,53,15,0.06) 100%
  );
}
```

### Glass Effects

```css
/* Frosted glass card */
.wc-glass {
  background: rgba(17,17,24,0.70);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.06);
}

/* Subtle glass (hero stat chips) */
.wc-glass-subtle {
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.08);
}
```

---

## Typography Scale

All sizes are from Tailwind's default scale. No `text-[10px]` or `text-[11px]` arbitrary values.

```
--wc-type-display:   text-4xl sm:text-5xl font-black tracking-tight  /* Hero score, trophy */
--wc-type-hero:      text-2xl sm:text-3xl font-black                  /* Page H1 */
--wc-type-title:     text-xl sm:text-2xl font-bold                    /* Section title H2 */
--wc-type-subtitle:  text-lg font-semibold                            /* Card title, H3 */
--wc-type-body:      text-sm font-normal                              /* Body copy */
--wc-type-label:     text-xs font-semibold uppercase tracking-wider   /* Section labels */
--wc-type-caption:   text-xs font-normal text-gray-400                /* Timestamps, meta */
--wc-type-micro:     text-xs font-medium                              /* Badges, chips */
```

**Score typography** (special case):
```
Match score:  text-5xl sm:text-6xl font-black tabular-nums
Card score:   text-base font-black tabular-nums
Bracket:      text-sm font-bold tabular-nums
```

**Rules**:
- `text-[10px]` → replace with `text-xs` (12px)
- `text-[11px]` → replace with `text-xs` (12px)
- h2 section labels must be at minimum `text-sm font-semibold`
- Heading hierarchy must be visible: h1 > h2 > h3 at minimum 2px size steps

---

## Spacing Scale

Base unit: 4px (Tailwind's default)

```
space-1  =  4px   /* micro gap between icon + text */
space-2  =  8px   /* intra-component gap */
space-3  = 12px   /* tight component padding */
space-4  = 16px   /* standard component padding */
space-5  = 20px   /* (avoid — not in 4px grid) */
space-6  = 24px   /* comfortable padding */
space-8  = 32px   /* section gap */
space-10 = 40px   /* major section gap */
space-12 = 48px   /* hero vertical padding */
space-16 = 64px   /* page hero height hint */
```

**Page rhythm**: outer container uses `space-y-8` between all major sections. Use `space-y-12` for the gap after hero.

**Card padding**:
```
compact card:  p-3    (12px)
standard card: p-4    (16px)
premium card:  p-5    (20px) or p-6 (24px)
hero card:     p-6 sm:p-8
```

**Rule**: Never use `p-3` and `p-4` for structurally identical cards on the same page.

---

## Border Radius

```
--wc-radius-sm:   rounded      (4px)   — badges, small chips
--wc-radius-md:   rounded-lg   (8px)   — buttons, small cards
--wc-radius-lg:   rounded-xl   (12px)  — standard cards (DEFAULT for all match cards)
--wc-radius-xl:   rounded-2xl  (16px)  — featured cards, hero panels
--wc-radius-full: rounded-full         — avatar crests, status dots, pills
```

**Rule**: All MatchCard variants use `rounded-xl`. Special cards (Final, Third Place, Hero) use `rounded-2xl`.

---

## Shadow System

```css
/* Subtle card depth */
.shadow-wc-card    { box-shadow: 0 1px 3px rgba(0,0,0,0.40), 0 1px 2px rgba(0,0,0,0.24); }

/* Elevated hover state */
.shadow-wc-raised  { box-shadow: 0 4px 6px rgba(0,0,0,0.40), 0 2px 4px rgba(0,0,0,0.24); }

/* Live glow */
.shadow-wc-live    { box-shadow: 0 0 0 1px rgba(239,68,68,0.4), 0 0 12px rgba(239,68,68,0.15); }

/* Gold glow (Final, winner) */
.shadow-wc-gold    { box-shadow: 0 0 0 1px rgba(245,158,11,0.4), 0 0 16px rgba(245,158,11,0.12); }
```

Tailwind custom extension needed in `tailwind.config.ts`:
```js
boxShadow: {
  'wc-card':   '0 1px 3px rgba(0,0,0,0.40), 0 1px 2px rgba(0,0,0,0.24)',
  'wc-raised': '0 4px 6px rgba(0,0,0,0.40), 0 2px 4px rgba(0,0,0,0.24)',
  'wc-live':   '0 0 0 1px rgba(239,68,68,0.4), 0 0 12px rgba(239,68,68,0.15)',
  'wc-gold':   '0 0 0 1px rgba(245,158,11,0.4), 0 0 16px rgba(245,158,11,0.12)',
}
```

---

## Surface Elevation

Z-axis system (corresponds to visual depth):

| Level | Usage | Classes |
|-------|-------|---------|
| Base (0) | Page background | `bg-[#0a0a0f]` |
| Surface (1) | Standard cards | `bg-gray-950 border border-gray-800/60` |
| Raised (2) | Hover state / active card | `bg-gray-900 border border-gray-700 shadow-wc-raised` |
| Overlay (3) | Dropdowns, tooltips | `bg-gray-800 border border-gray-700/80` |
| Modal (4) | Dialogs | `bg-gray-900 border border-gray-600/60` |

---

## Card Variants

### Base Card
```
bg-gray-950 border border-gray-800/60 rounded-xl p-4
hover:border-gray-700 hover:bg-gray-900 transition-[border-color,background-color] duration-150
```

### Elevated Card
```
bg-gray-900 border border-gray-700/60 rounded-xl p-4 shadow-wc-card
hover:border-gray-600/80 hover:-translate-y-0.5 shadow-wc-raised transition-[transform,border-color,box-shadow] duration-150
```

### Glass Card
```
bg-gray-900/70 backdrop-blur-md border border-white/[0.06] rounded-xl p-4
```

### Hero Card (Hub section hero)
```
bg-gradient-to-br from-amber-950/20 to-gray-950 border border-amber-800/20 rounded-2xl p-6 sm:p-8
```

### Live Card
```
bg-gray-950 border border-red-500/40 rounded-xl p-4 shadow-wc-live
```

### Projected Card
```
bg-gray-950 border border-amber-500/20 border-dashed rounded-xl p-4
```

---

## Button Variants

```
Primary:   bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg px-4 py-2 transition-colors duration-150
Secondary: bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 rounded-lg px-4 py-2
Ghost:     text-gray-300 hover:text-white hover:bg-gray-800/60 rounded-lg px-3 py-1.5 transition-colors
Danger:    bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg px-4 py-2
```

All buttons: minimum `min-h-[44px]` on touch targets on mobile.

---

## Badge Variants

```
LIVE:       inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-bold
PAUSED/HT:  px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 text-xs font-bold
FINISHED:   px-2 py-0.5 rounded bg-gray-700/60 text-gray-400 border border-gray-700 text-xs font-bold
PROJECTED:  px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-medium
QUALIFIED:  px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-xs font-medium
CANCELLED:  px-2 py-0.5 rounded bg-gray-800 text-gray-500 border border-gray-700/50 text-xs font-medium
UPCOMING:   px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-medium
```

Live badge always includes animated pulse dot:
```jsx
<span className="relative flex h-1.5 w-1.5">
  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
</span>
```

---

## Skeleton Loading

All skeletons use the `animate-pulse` shimmer pattern with matching layout:

### MatchCard Skeleton
```jsx
<div className="bg-gray-950 border border-gray-800/60 rounded-xl p-4 animate-pulse">
  <div className="flex justify-between mb-3">
    <div className="h-3 w-24 bg-gray-800 rounded" />
    <div className="h-4 w-12 bg-gray-800 rounded-full" />
  </div>
  <div className="space-y-2.5">
    <div className="flex items-center gap-2">
      <div className="h-5 w-5 bg-gray-800 rounded-full shrink-0" />
      <div className="h-3 flex-1 bg-gray-800 rounded" />
      <div className="h-4 w-5 bg-gray-800 rounded" />
    </div>
    <div className="flex items-center gap-2">
      <div className="h-5 w-5 bg-gray-800 rounded-full shrink-0" />
      <div className="h-3 flex-1 bg-gray-800 rounded" />
      <div className="h-4 w-5 bg-gray-800 rounded" />
    </div>
  </div>
</div>
```

### GroupTable Skeleton
```jsx
<div className="bg-gray-950 border border-gray-800/60 rounded-xl overflow-hidden animate-pulse">
  <div className="bg-gray-800/50 h-9" />
  {[...Array(4)].map((_, i) => (
    <div key={i} className="flex gap-3 px-3 py-2 border-t border-gray-800/40">
      <div className="h-3 w-4 bg-gray-800 rounded" />
      <div className="h-3 flex-1 bg-gray-800 rounded" />
      {[...Array(4)].map((_, j) => <div key={j} className="h-3 w-6 bg-gray-800 rounded" />)}
    </div>
  ))}
</div>
```

### Section Header Skeleton
```jsx
<div className="h-4 w-32 bg-gray-800 rounded animate-pulse mb-4" />
```

---

## Empty States

### No Matches
```jsx
<div className="bg-gray-950 border border-gray-800/60 rounded-xl p-8 text-center">
  <div className="text-4xl mb-3" aria-hidden="true">📅</div>
  <p className="text-gray-300 font-semibold">No fixtures available</p>
  <p className="text-gray-500 text-sm mt-1">Season may not have started yet.</p>
</div>
```

### Off Season
```jsx
<div className="bg-gray-950 border border-amber-500/20 rounded-xl p-8 text-center">
  <p className="text-amber-400 font-semibold text-sm mb-1">Off Season</p>
  <p className="text-gray-400 text-sm">{competitionName} season concluded.</p>
  <Link href="..." className="...">View World Cup →</Link>
</div>
```

### Pre-Tournament (stage not started)
```jsx
<div className="bg-gray-950 border border-gray-800/60 rounded-xl p-6 text-center">
  <p className="text-gray-300 font-semibold">Fixtures confirmed once group stage completes</p>
  <p className="text-gray-500 text-sm mt-1">Teams will be assigned to bracket slots automatically.</p>
</div>
```

---

## Focus & Hover States

### Universal Focus Ring
Apply to ALL interactive elements:
```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-950
```

### Hover Elevation (Cards)
```
hover:-translate-y-0.5 hover:shadow-wc-raised transition-[transform,box-shadow,border-color] duration-150
```

**Rule**: Never use `transition-all` — always specify which properties are animated.

### Active State (Navigation Pills)
```
bg-amber-500 text-black border-amber-400 font-semibold
```

### Disabled State
```
opacity-40 cursor-not-allowed pointer-events-none
```

---

## Animation Durations

```
--wc-duration-instant:  0ms      /* flag/boolean state switches */
--wc-duration-fast:     100ms    /* micro-interactions (dot colour) */
--wc-duration-base:     150ms    /* hover state transitions */
--wc-duration-enter:    200ms    /* elements entering view */
--wc-duration-deliberate: 300ms  /* panel reveals, accordion */
--wc-duration-cinematic: 500ms   /* bracket expansion, hero entry */
--wc-duration-loop:     1500ms   /* live pulse, skeleton shimmer */
```

Tailwind custom extensions:
```js
transitionDuration: {
  '100': '100ms',
  '150': '150ms',
  '2000': '2000ms',
},
animation: {
  'wc-pulse':  'pulse 1.5s ease-in-out infinite',
  'wc-shimmer': 'shimmer 2s linear infinite',
  'wc-slide-up': 'slideUp 200ms ease-out',
  'wc-fade-in':  'fadeIn 300ms ease-out',
}
```
