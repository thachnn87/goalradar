# Motion Guidelines — WC 2026

> Motion must be purposeful, not decorative.
> Every animation earns its place by communicating state, guiding attention, or rewarding interaction.
> NO excessive animation. Respect prefers-reduced-motion.

---

## Philosophy

Motion in GoalRadar WC 2026 follows broadcast motion language:
- **Decisive** — fast, purposeful. A score update flips in 200ms and is done.
- **Contextual** — live matches pulse; finished matches are static. Motion = meaning.
- **Restrained** — one motion at a time per viewport. Never animate two adjacent elements simultaneously.

---

## Duration Scale

```
Instant:     0ms    — state flag flips
Fast:        100ms  — micro-interactions (icon colour on hover)
Base:        150ms  — hover state transitions (border colour, background)
Enter:       200ms  — elements entering viewport (score digit flip)
Deliberate:  300ms  — panel reveals, bracket connector draw per match
Cinematic:   500ms  — hero section entry, bracket full draw
Loop:        1500ms — live pulse ring, skeleton shimmer
```

---

## Easing Functions

```
ease-out    — default for elements entering the screen
ease-in     — elements leaving
ease-in-out — elements moving within screen
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)  — satisfying snaps
```

---

## Specific Animations

### 1. Hover Elevation (Card) — P0

```
hover:-translate-y-0.5 hover:shadow-wc-raised
transition-[transform,box-shadow,border-color] duration-150
```

### 2. Live Pulse Ring — P0 (already implemented — verify)

```jsx
<span className="relative flex h-2 w-2">
  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
</span>
```

prefers-reduced-motion: hide outer ring, show only static inner dot.

### 3. Loading Shimmer Skeleton — P0

Replace plain `animate-pulse` with directional shimmer:
```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.wc-skeleton {
  background: linear-gradient(90deg,
    rgba(31,41,55,0.8) 25%, rgba(55,65,81,0.6) 50%, rgba(31,41,55,0.8) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s linear infinite;
}
```

### 4. Score Digit Flip — P1

```css
@keyframes digitFlip {
  0%   { transform: rotateX(90deg); opacity: 0; }
  100% { transform: rotateX(0deg);  opacity: 1; }
}
```

Trigger: compare prev score prop. If changed, animate entering digit. 200ms ease-out.
prefers-reduced-motion: opacity fade only (no rotateX).

### 5. Card Reveal on Scroll — P2

```css
@keyframes cardReveal {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

IntersectionObserver, threshold 0.1. Stagger 50ms per card within a date group.
prefers-reduced-motion: skip — render fully visible.

### 6. Bracket Connector Draw — P2

```css
.bracket-connector {
  stroke-dasharray: var(--path-length);
  stroke-dashoffset: var(--path-length);
  animation: drawConnector 300ms ease-out forwards;
  animation-delay: calc(var(--match-index, 0) * 50ms);
}
@keyframes drawConnector { to { stroke-dashoffset: 0; } }
```

Stagger 50ms per match index. Full bracket draws in ~800ms.
prefers-reduced-motion: stroke-dashoffset: 0 immediately.

### 7. Bracket Hover Path Highlight — P2

```css
[data-hover="match-42"] .bracket-connector[data-feeds-into="match-42"] {
  stroke: rgba(245,158,11,0.60);
  transition: stroke 150ms ease-out;
}
```

JS sets data-hover on bracket container on mouseenter.

### 8. Countdown Digit Slide — P3

```css
@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
```

Outgoing digit slides up-out; incoming slides up-in. 200ms ease-in-out.

---

## Tailwind Config Additions

```js
keyframes: {
  shimmer:       { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
  digitFlip:     { '0%': { transform: 'rotateX(90deg)', opacity: '0' }, '100%': { transform: 'rotateX(0)', opacity: '1' } },
  cardReveal:    { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
  drawConnector: { '100%': { strokeDashoffset: '0' } },
  slideUp:       { '0%': { transform: 'translateY(100%)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
},
animation: {
  'wc-shimmer':   'shimmer 1.5s linear infinite',
  'wc-flip':      'digitFlip 200ms ease-out',
  'wc-reveal':    'cardReveal 300ms ease-out forwards',
  'wc-connector': 'drawConnector 300ms ease-out forwards',
  'wc-slide-up':  'slideUp 200ms ease-out',
},
```

---

## prefers-reduced-motion

All animations must be wrapped:

Tailwind (preferred): `motion-safe:hover:-translate-y-0.5`, `motion-safe:animate-wc-shimmer`

CSS fallback:
```css
@media (prefers-reduced-motion: reduce) {
  .wc-skeleton { animation: none; background: rgba(31,41,55,0.8); }
  .bracket-connector { stroke-dashoffset: 0; animation: none; }
}
```

---

## Implementation Priority

| Animation | Priority | Effort | Impact |
|-----------|----------|--------|--------|
| Hover elevation | P0 | 15min | High — every page |
| Live pulse (verify) | P0 | 5min | High — live matches |
| Shimmer skeleton | P0 | 30min | High — perceived perf |
| Card reveal on scroll | P1 | 1h | Medium — premium feel |
| Bracket connector draw | P2 | 2h | Medium — bracket page |
| Bracket hover highlight | P2 | 2h | Medium — bracket page |
| Score digit flip | P2 | 1.5h | Medium — match page |
| Countdown digit slide | P3 | 2h | Low — countdown only |

---

## What NOT to Animate

- Page transitions between routes
- Table row reorders
- width, height, top, left — compositor-thread properties only (transform, opacity)
- Two animations simultaneously on the same element
- Anything after FINISHED status — history is static
