# Visual Language — WC 2026

> GoalRadar's identity: authoritative, immersive, broadcast-quality.
> Inspired by FIFA, ESPN, The Athletic, Apple event pages.
> NOT a clone of any source — GoalRadar's own voice.

---

## Design Philosophy

GoalRadar WC 2026 should make the user feel they are **inside the tournament**, not reading a database. Every design decision should answer: *does this make the World Cup feel bigger?*

The emotional intent:
- **Gravitas**: this is the biggest sporting event on Earth — the design should feel weighty, not light
- **Precision**: every pixel communicates data clearly; nothing is ambiguous or decorative noise
- **Anticipation**: upcoming matches feel exciting; live matches feel urgent; results feel historic
- **Trust**: the user believes our data is authoritative because our design communicates authority

---

## Visual Identity Pillars

### 1. Broadcast Quality
The design should look at home on a broadcast lower-third or stadium scoreboard. This means:
- High-contrast white text on dark surfaces for primary data
- Tabular numbers for all scores, standings, times
- Status indicators that are unambiguous at a glance (red=live, gray=finished, amber=upcoming)
- No clutter — a score is a score, not a score + 5 decorative elements

### 2. Dark Premium (not dark gloomy)
Dark ≠ gray mud. The WC 2026 dark theme should feel like a premium product, not a developer console.
- Use `#0a0a0f` as base (slightly warm black, not pure `#000000` nor flat `#111827`)
- Cards should float above the background with subtle depth
- Gradients should be used sparingly — one per page maximum for hero sections
- A hint of gold/amber elevates the WC brand identity

### 3. Event Energy
Every page should remind the user: a World Cup is happening.
- Gold accent (#f59e0b) for brand moments
- Red accent for LIVE — this is a universal sports signal
- Stage colours that progress from cool (R32 = sky blue) to warm (Final = gold)
- Section headers that feel like broadcast program segments, not navigation breadcrumbs

### 4. Digital Native
This is a web product, not a print magazine. Motion, depth, and interactivity should be used.
- Hover states that reward curiosity
- Live data should visually pulse/update
- Bracket connectors should feel structural, not decorative
- Countdown digits should animate naturally

---

## Typography Direction

### Hero Type (Match Scores, Tournament Headings)
```
text-5xl sm:text-6xl font-black tabular-nums tracking-tight
```
Scores should dominate the viewport on the match page. The score is the most important piece of information — design around it.

### Section Headings (H2)
```
text-sm font-semibold uppercase tracking-widest text-gray-400
```
Section headings are wayfinding — they should be visible but not compete with data.

**Important rule**: Section headings must be `text-sm` minimum. `text-xs uppercase` section headings (current state) are too small to serve as wayfinding.

### Team Names
```
text-sm sm:text-base font-semibold text-white truncate
```
Always truncate with `title` attribute on hover for full name.

### Body / Editorial Copy
```
text-sm text-gray-400 leading-relaxed max-w-prose
```

### Data / Tabular
```
text-sm tabular-nums font-medium
```
All standings, scores, times: `tabular-nums` ensures digits align perfectly.

### Timestamps / Metadata
```
text-xs text-gray-500
```
Minimum: `text-xs`. Never `text-[10px]` or `text-[11px]`.

### Score Display (Match Card)
```
text-base font-black tabular-nums text-white   /* card score */
text-4xl sm:text-5xl font-black tabular-nums   /* match page score */
```

---

## Colour Direction

### Primary Surface: `#0a0a0f`
Rationale: Slightly warm black prevents the cold sterility of `#000000`. Cards at `bg-gray-950` float against this clearly. The warmth complements the gold accent.

### Brand Accent: `#f59e0b` (amber-500)
Rationale: Gold/amber is universally associated with championships, trophies, and prestige. It reads as warm and energetic against dark backgrounds, and provides sufficient contrast for interactive elements. Used for: active nav tabs, CTAs, score highlights, tournament stage accents.

### Live Accent: `#ef4444` (red-400/500)
Rationale: Red for live is a universal broadcast convention. Users globally recognise a red dot as "on air" / "live". Used exclusively for live match indicators — never for errors or other states.

### Text Hierarchy (specific hex for contrast verification)
```
#ffffff (white)    — primary: scores, team names, headings
#d1d5db (gray-300) — secondary: subtitles, body
#9ca3af (gray-400) — tertiary: section labels, metadata
#6b7280 (gray-500) — muted: timestamps, supplementary
#374151 (gray-700) — FORBIDDEN for meaningful text (use only as decorative separator)
```

### How to Use Gradients
Rule: **maximum one accent gradient per page**, used only for the hero section or a special featured card (Final, Third Place).

Good gradient use:
```css
/* Hub hero — barely perceptible depth */
background: radial-gradient(ellipse at top, rgba(245,158,11,0.06) 0%, transparent 60%);
```

Bad gradient use:
- Gradients on every card
- Gradients used for navigation elements
- Gradients that fight the data legibility

---

## Layout Direction

### Grid Philosophy
- 12-column grid at desktop (standard)
- 4-column at mobile
- Content max-width: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- Match cards: always `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (add `md:grid-cols-2` — currently missing)

### Card Elevation
Cards should float above the page background — not just be a different shade of gray.
```
Page:    bg-[#0a0a0f]          (depth 0)
Card:    bg-gray-950 + border  (depth 1)
Hover:   bg-gray-900 + shadow  (depth 2)
```
The border should be faint: `border-gray-800/60` at rest. Brightens on hover: `border-gray-700`.

### White Space as Premium Signal
Premium sports products (The Athletic, ESPN Plus) use generous white space to signal quality.
- Section gaps: `gap-y-8` minimum (32px)
- Card internal padding: `p-4` minimum
- Page padding: `px-4 sm:px-6 lg:px-8` — never less than 16px

### Asymmetry for Visual Interest (Score Cards)
A match score card should not be symmetric — the two teams should be equal, but the layout should use visual tension:
- Home team left-aligned, away team right-aligned
- Score in center with `tabular-nums font-black` — this IS the focal point
- Status badge above the score, not beside it

---

## Iconography

### Flag / Crest Display
- Team crests: always with explicit `width` and `height` props for CLS prevention
- Crest sizes: 16px (micro), 20px (card), 28px (compact-bracket), 40px (feature), 56px (hero), 80px (team page)
- Crest background: `rounded-full` pill wrapper with `bg-gray-800` fallback
- TBD state: gray circle with `?` glyph or dashed circle

### Status Dots
```
Live:     bg-red-500 with animate-ping outer ring
Upcoming: bg-blue-500/60 (no animation)
Finished: bg-gray-600 (static, muted)
```

### Navigation Emojis
All emojis in navigation must have `aria-hidden="true"`:
```jsx
<span aria-hidden="true">📅</span>
<span className="sr-only">Schedule</span>
```

### Bracket Connectors
SVG lines connecting bracket matches should:
- Use `stroke: rgba(255,255,255,0.12)` at rest
- Use `stroke: rgba(245,158,11,0.60)` on hover for the path leading to a match
- Use `stroke: rgba(52,211,153,0.60)` for the winning progression path

---

## Premium Signals

Ten specific techniques that elevate the GoalRadar WC experience:

1. **Tabular numbers everywhere data appears**: `tabular-nums` on scores, standings, times. Prevents digit-width jitter and looks professionally typeset.

2. **Status badge shape language**: LIVE uses `rounded-full` (continuous, ongoing). FINISHED uses `rounded` (closed, done). PROJECTED uses dashed border (uncertain, awaiting). Shape communicates meaning independent of colour.

3. **Depth through border opacity**: `border-gray-800/60` (default) → `border-gray-700` (hover) — the card comes forward to meet you on hover. No `box-shadow` needed on a dark background.

4. **Gold accent exactly when warranted**: The Final card gets the gold gradient. The bracket connector to the winner glows gold. The active navigation tab is gold. Used precisely, gold signals "this is important" — use it everywhere and it loses meaning.

5. **Stage progression in the bracket**: Each round gets its own subtle colour — sky blue (R32) → blue (R16) → violet (QF) → pink (SF) → gold (Final). As you progress through the bracket, the colour warms. The visual metaphor matches the emotional reality.

6. **Crest with placeholder ring**: Team crests always display inside a subtle `border border-gray-700/40 rounded-full` ring. When the crest 404s or TBD is shown, the ring remains as a placeholder — no broken image, no layout shift.

7. **Qualification bar in group tables**: A thin coloured bar at the left edge of each row (green for advancing, amber for 3rd-place race, nothing for eliminated) communicates group position without reading the Pts column. This is how broadcast graphics work.

8. **Live section gets an elevated visual treatment**: The live section should look different from the finished section. Use `bg-red-950/10 border-red-900/20` as the section background — the red tint signals urgency without being alarming.

9. **Section labels as wayfinding, not headings**: Section labels (`text-sm font-semibold uppercase tracking-widest`) are navigation aids, not document structure. They should be clearly below body text in size but above muted metadata. Currently inverted in several places.

10. **Empty states as marketing moments**: The "Fixtures confirmed once group stage completes" state should communicate excitement about what's coming, not failure. Use the bracket path, team slot labels, and scheduled dates to show users what to look forward to — not a generic "no data" message.
