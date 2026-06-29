# Responsive Guide — WC 2026

> Every page must feel native on every screen.
> No horizontal overflow. No cramped touch targets. No layout shift.

---

## Breakpoints

Using Tailwind defaults:

| Name | Width | Device |
|------|-------|--------|
| (base) | 0–639px | Mobile phones |
| sm | 640px+ | Large phones / small tablets |
| md | 768px+ | Tablets (portrait) |
| lg | 1024px+ | Laptops / tablets (landscape) |
| xl | 1280px+ | Desktops |

**Critical gap currently in codebase**: almost no `md:` breakpoints exist.
The grid jumps `1-col → 2-col at sm → 3-col at lg`, leaving tablets (768–1023px) under-served.

**Fix**: add `md:grid-cols-2` explicitly on all match card grids.

---

## Mobile-First Principles

- Design for **390px width** (iPhone 14 Pro) as the primary canvas
- All touch targets: minimum **44×44px** (WCAG 2.5.5)
- No horizontal overflow anywhere (test with `overflow: hidden` on `<body>`)
- Font minimum: `text-xs` (12px). Never `text-[10px]` or `text-[11px]`
- Sticky elements: test that `top` offset matches actual header height

---

## Per-Component Responsive Behavior

### MatchCard

| Viewport | Columns | Card padding |
|----------|---------|-------------|
| Mobile | 1 | p-3 |
| sm (640px) | 2 | p-4 |
| lg (1024px) | 3 | p-4 |

Team name: `truncate max-w-[120px] sm:max-w-[160px]` — never let long names overflow the card.
Score: always `shrink-0 w-5 text-right` — fixed width so layout never shifts.

```
grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5
```

Note: `md:grid-cols-2` added explicitly (currently missing). `md:gap-5` adds breathing room on tablets.

### WCBracket

| Viewport | Mode |
|----------|------|
| Mobile (< 768px) | Accordion by round (details/summary) |
| Tablet (768–1279px) | Horizontal scroll, overflow-x-auto, scroll-snap |
| Desktop (1280px+) | Full horizontal bracket |

Mobile bracket must have:
- `overflow-x-auto` wrapper with scroll-shadow fade on right edge
- Current round expanded by default in accordion
- All rounds accessible with single tap

### WCGroupTable

| Viewport | Visible columns |
|----------|----------------|
| Mobile | Pos, Team, P, Pts, Form |
| Tablet+ | Pos, Team, P, W, D, L, Pts, Form |

Column hiding:
```tsx
// W, D, L columns:
<th className="hidden sm:table-cell ...">W</th>
```

Form pills: always visible — this is the most valuable column for mobile users.

### WCPageNav

Always single-row horizontal scroll:
```
flex overflow-x-auto scrollbar-hide -mx-4 px-4 gap-2
```

The `-mx-4 px-4` bleed trick extends the scroll area to screen edges. Works unless a parent has `overflow: hidden` — verify on all page layouts.

### Hub Page

| Viewport | Layout |
|----------|--------|
| Mobile | Single column, priority order: hero → live/today → upcoming → bracket preview → groups |
| sm | Hero (full width), then 2-col match grid |
| lg | 2-col layout: content (8/12) + sidebar (4/12) |

Group standings on Hub: mobile = single tab visible, tap to switch. Desktop = up to 3 groups side-by-side.

### Schedule Page

Competition tab strip: always single-row horizontal scroll (same as WCPageNav).
Currently uses `flex-wrap` on CompetitionSelector — this must change to `flex overflow-x-auto scrollbar-hide`.

### Bracket Page

R32 grid: `grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4`
- Mobile: 1 col (16 cards = long scroll — acceptable for R32)
- Desktop: 4 col (all 16 cards visible without scrolling)

### Match Page

| Viewport | Hero layout |
|----------|-------------|
| Mobile | Stacked: home team (top) → score (middle) → away team (bottom) |
| Desktop | Side-by-side: home (left) — score (center) — away (right) |

Score font:
```
text-4xl sm:text-5xl lg:text-6xl font-black tabular-nums
```

Team crest sizes:
- Mobile: 48px
- Desktop: 72px

### Standings Table

| Viewport | GD column | GF/GA |
|----------|-----------|-------|
| Mobile | hidden | hidden |
| sm | visible | hidden |
| lg | visible | visible (if added) |

Always `overflow-x-auto` wrapper on the table — current implementation has this, keep it.

---

## Typography Responsive Scaling

| Element | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Match page score | text-4xl | text-5xl | text-6xl |
| Page H1 | text-2xl | text-3xl | text-3xl |
| Section H2 | text-sm | text-base | text-base |
| Match card team | text-sm | text-sm | text-sm |
| Badge text | text-xs | text-xs | text-xs |
| Timestamp | text-xs | text-xs | text-xs |

Rule: body copy is always `text-sm` (14px) — never scale down below this.

---

## Spacing Responsive Scaling

```
Page padding:    px-4        sm:px-6     lg:px-8
Section gaps:    space-y-6   sm:space-y-8
Card grid gap:   gap-4       md:gap-5    lg:gap-6
Card padding:    p-3 sm:p-4
```

---

## No-Overflow Checklist

Every PR must verify:

- [ ] All tables wrapped in `overflow-x-auto`
- [ ] Long team names use `truncate` + `title` attribute
- [ ] WCBracket wrapped in `overflow-x-auto` container
- [ ] Score display: `shrink-0` so it never wraps
- [ ] Match date/time: shorter format on mobile (`'HH:mm'` not `'HH:mm UTC, DD MMM YYYY'`)
- [ ] WCPageNav and round pills: `overflow-x-auto scrollbar-hide` — NOT `flex-wrap`
- [ ] Sticky nav `top` offset matches current header height
- [ ] No `min-w` that forces horizontal overflow

---

## Touch Interactions

All interactive elements must meet 44×44px minimum:

Current violations:
- `'← WC Hub'` back-link in fixtures/bracket headers — tiny text link. Fix: wrap in `<span className="inline-flex items-center min-h-[44px] px-3">
- `'View Knockout Bracket →'` CTA — tiny button. Fix: `px-4 py-2.5` minimum
- Prev/Next round nav text links — bare text. Fix: styled nav cards (see COMPONENT_LIBRARY.md)
- `'fixtures & details →'` per-group links in Groups page

Touch targets fix — add to every small interactive element:
```
min-h-[44px] flex items-center
```

---

## Responsive Testing Checklist

After each phase:

| Viewport | Device reference |
|----------|-----------------|
| 375px | iPhone SE |
| 390px | iPhone 14 Pro (PRIMARY) |
| 430px | iPhone 14 Pro Max |
| 768px | iPad portrait |
| 1024px | iPad landscape / small laptop |
| 1280px | Standard desktop |
| 1440px | Wide desktop |

Test scenarios:
- [ ] All pages: no horizontal scroll at 390px
- [ ] All tables: readable without horizontal scroll at 390px (or graceful scroll)
- [ ] WCBracket: navigable on 390px (accordion or scroll)
- [ ] Hub: group standings readable on 390px (tabbed)
- [ ] Match page: score dominant above fold at 390px
- [ ] All touch targets: 44×44px minimum
- [ ] All nav strips: single row, horizontal scroll
