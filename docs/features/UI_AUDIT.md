# UI Audit — World Cup 2026 (DATA-18WC.UI-X)

> Generated from parallel 35-agent audit of all WC pages and components.
> Date: 2026-06-26

---

## Executive Summary

GoalRadar's current World Cup 2026 experience functions as a **data-presentation site** rather than a **tournament destination**. The architecture is sound — ONE SOURCE, ONE PIPELINE, correct data flows — but the presentation layer has accumulated inconsistencies that collectively prevent premium perception:

- **No design system**: spacing, typography, and colour are chosen ad-hoc on every page
- **Component duplication**: `BracketMatchCard`, `ResultRow`, `LocalKnockoutRound` are all MatchCard variants never unified
- **Accessibility gaps**: broken aria-labelledby chains, missing focus rings, emoji characters announced by screen readers across every page
- **No skeleton/streaming**: entire pages block on data; no progressive reveal
- **Emoji-as-hero**: the 🏆 emoji is the primary visual for the WC hub — no imagery, no tournament identity
- **Mobile friction**: no sticky nav, no date-jump, cramped touch targets, no scroll indicators on bracket

The gap between current state and a premium tournament experience is large but entirely in the **presentation layer** — no data architecture changes are required.

---

## Page-by-Page Audit

---

### Hub (`/world-cup-2026`)

**Current UX**
Dark ISR page (30s). Opens with a 🏆 emoji hero, WCCountdown, ad slot, sticky jump nav, then six stacked sections: Live, Today, Upcoming, Groups, Bracket, Results. Closes with newsletter, 48-team crawler nav, WCRelatedLinks.

**Content Hierarchy**
Breadcrumb → WCPageNav → Hero card → WCCountdown → PushNotificationButton → AdSlot → Sticky jump nav → Live grid → Today grid → Upcoming / LocalKnockoutRound → Group Standings grid → AdSlot → Bracket → Results → Newsletter → Crawler nav → WCRelatedLinks

**Pain Points**
- Two navigation systems: WCPageNav + sticky section-jump nav (cognitive redundancy, wastes vertical space)
- Emoji (🏆) as sole primary visual — no tournament imagery, no brand signal
- Live + Today are two sections sharing the same conceptual meaning (matches happening now/today)
- aria-labelledby on all six sections points to IDs that don't exist in the DOM — broken accessible names across entire page
- 48-team crawler nav adds ~600px of low-value visual noise with no UX purpose
- LocalKnockoutRound (pre-fixture fallback) has no crests, no links, lower visual quality than MatchCard
- PushNotificationButton + AdSlot interrupt before any football content appears
- No Suspense/streaming — full page blocks on 4 parallel data calls

**Visual Issues**
- Hero background glow is rgba(234,179,8,0.06) — 6% opacity, visually imperceptible
- Two pill badges in hero repeat information already in the subtitle paragraph
- Sections separated only by spacing — no visual dividers; 104 matches of content blurs together
- ResultRow uses bare `<img>` with no crest fallback (shows broken image on 404)
- Crawler nav uses two different chip colour schemes with no hierarchy reason
- WCBracket rendered in a plain container with no preview/teaser

**Interaction Issues**
- Sticky nav href="#fixtures" / href="#groups" exist, but href="#results" is missing from the nav
- Sticky nav has no active/scroll-spy state — no indication of current section
- LocalKnockoutRound rows have no link — breaks interaction contract established by MatchCard
- No keyboard focus ring on any nav pill links

**Accessibility Issues**
- `aria-labelledby` on all six `<section>` elements points to IDs never assigned on the h2 inside `SectionHeader`
- Live pulse dot in SectionHeader has no sr-only "Live" text
- Emojis in sticky nav links (📅 🏁 📊 🔗 🗂) have no `aria-hidden` — announced by screen readers
- Crawler nav has h2 inside `<nav>` — unusual heading hierarchy
- Hero div has no landmark role

**Mobile Issues**
- Sticky nav `top-16` hardcoded — will break if header height changes
- Crawler nav renders 48 chips with flex-wrap — extremely tall block on mobile, small tap targets
- LocalKnockoutRound has no horizontal scroll wrapper — team names clip on 320px screens
- Grid jumps 1→2 col at sm (640px) with no md step — awkward dead zone 640–1024px
- Sticky nav -mx-4 negative margin breaks inside `overflow-hidden` parents

**Spacing Issues**
- Three padding scales co-exist at the same visual level: `p-6 sm:p-8`, `p-5`, `p-4 sm:p-6`
- SectionHeader `mb-4` vs MatchGrid date labels `mb-3` — undocumented scale
- ResultRow container uses `rounded-2xl` while LocalKnockoutRound uses `rounded-xl` — inconsistent radius for equivalent containers

**Typography Issues**
- SectionHeader h2 is `text-xs uppercase tracking-widest` — visually smaller than body copy; h2 hierarchy inverted
- Date labels in MatchGrid also use `text-xs uppercase tracking-wider` — indistinguishable from section headers
- `text-[10px]` and `text-[11px]` appear as arbitrary pixel values outside Tailwind scale

**Color Issues**
- Live section header `text-red-400` + pulse dot `bg-red-500` — mismatched reds in same component
- Nav hover uses `yellow-500/15` tint + `yellow-400` text, but bracket link uses `text-yellow-500 hover:text-yellow-300` — three yellow variants on same page
- Gray scale jumps: white → gray-600 (skips gray-400/500), high-contrast discontinuity

**Top Upgrade Opportunities**
1. Full-bleed tournament hero with stadium imagery / official WC 2026 artwork + dark overlay
2. Merge Live + Today into one "Today" section with time-ordered list and live visual differentiation
3. Add horizontally scrollable featured-match strip (top 3–5 matches with countdown timers)
4. Suspense + streaming skeleton for each section — page shell renders instantly
5. Group standings as tabbed/accordion UI (A–L letter tabs) — reduce page length dramatically
6. Fix aria-labelledby by assigning id props to SectionHeader's h2 — one-line fix
7. Replace crawler nav with visually designed "Explore" section using flag thumbnails
8. Add tournament context cards (Top Scorers, Venues, Next match in your timezone)

---

### Schedule (`/schedule?competition=WC`)

**Current UX**
Server-rendered page (ISR 300s). Defaults to WC tab. Shows breadcrumb, heading, compact WCCountdown, ad slot, timezone banner, CompetitionSelector, then date-grouped MatchCard grid. Skeleton during load.

**Content Hierarchy**
AnalyticsTracker → Breadcrumb → Title + subtitle → WCCountdown → AdSlot → TimezoneBanner → CompetitionSelector → Date-grouped MatchCard grid → AdSlot × 2

**Pain Points**
- CompetitionSelector wrapped in `Suspense fallback={null}` — tabs disappear entirely during hydration (CLS)
- WCCountdown + AdSlot + TimezoneBanner triple-stack before tabs — content buried on mobile
- No "Jump to Live" or "Jump to Today" affordance
- Skeleton shows 6 cards with no date headers — jarring layout shift when content arrives
- 300s revalidation with no visible staleness indicator for live scores

**Visual Issues**
- Error state `p-6` vs empty state `p-8` — inconsistent for structurally identical containers
- Error state missing decorative icon that empty state has
- Skeleton has no date-header placeholder — section labels pop in causing shift
- Date headings `text-xs uppercase tracking-widest` — too small for structural headings
- `space-y-6` (page) vs `space-y-8` (ScheduleContent) — mixed rhythm at same level

**Interaction Issues**
- No optimistic UI or transition on tab switch — full page navigation
- No client-side auto-refresh for live status
- No date-picker or horizontal date strip (ESPN/FotMob style)

**Accessibility Issues**
- Off-season ⚠ Unicode has no aria-label
- 📅 emoji in empty state has no `aria-hidden`
- Date `<section>` elements have no `aria-label`
- SkeletonGrid has no `aria-busy` — screen readers get no loading feedback

**Mobile Issues**
- WCCountdown + AdSlot + TimezoneBanner push competition tabs well below fold
- No sticky competition tab bar on scroll
- Ad slots have no min-height reservation — risks CLS on slow connections
- `grid-cols-1` → `grid-cols-2` at sm, `grid-cols-3` at lg — no md step

**Top Upgrade Opportunities**
1. Sticky competition tab bar that pins at top on mobile scroll
2. "LIVE NOW" section pinned at top when live matches are in progress
3. Full structural skeleton mirroring date headers + card layouts
4. Stage-filter chips for WC view (Group Stage | R32 | R16 | QF | SF | Final)
5. Gold/amber accent for WC-specific UI elements (date headers, dividers)
6. Date-strip navigator for jumping to specific match days

---

### Fixtures (`/world-cup-2026/fixtures`)

**Current UX**
Server-rendered (ISR 900s). Shows Upcoming Fixtures and Recent Results. Each date block renders every match **twice** — compact list row + full MatchCard grid back-to-back.

**Pain Points**
- **Dual render**: every match shown as list row AND MatchCard — doubles DOM nodes, confuses users
- No filter by group/stage/team
- No pagination on Results — 96+ group stage results render simultaneously
- 📅 emoji hardcoded in two places — templated, not intentional

**Visual Issues**
- `text-gray-600` for 'vs' separator and stage labels — likely fails WCAG AA against gray-900
- `text-gray-700` for match count label — even lower contrast
- Hover arrow (→) uses `opacity-0` — invisible to keyboard users with no other focus indicator

**Accessibility Issues**
- List row + MatchCard below it link to the same match URL — two consecutive focusable elements going to same destination
- No skip-to-content link
- LIVE `<span>` has no `role="status"` or `aria-live` region

**Top Upgrade Opportunities**
1. Eliminate dual-render — compact list row IS the primary surface on fixtures page
2. Sticky filter bar (Group Stage | R32 | R16 | QF | SF | Final) with scroll-to-section
3. Progressive disclosure / virtual scroll for Results section
4. LIVE match rows with pulsing red left-border accent + `aria-live`
5. Team/group quick-filter input

---

### Results (`/world-cup-2026/results`)

**Current UX**
Server-rendered (ISR 300s). Stats strip (Played, Goals, Avg Goals, Live Now) + Live matches section + Finished results (capped at 40) in flat chronological list.

**Pain Points**
- No stage/round context per match row — users cannot tell Group A vs Final
- Results hard-capped at 40 with no pagination or load-more
- Date column `text-[10px]` `text-gray-600` — nearly invisible
- Stats strip hidden when played === 0 — absent at tournament start even when matches are live

**Visual Issues**
- Live badge `rounded-full` vs finished badge `rounded` — inconsistent shape
- Raw emoji (📊) in eyebrow with no `aria-hidden`
- `text-[10px]` used for status badge and date label — outside Tailwind type scale

**Accessibility Issues**
- `text-gray-600` on `bg-gray-900` ≈ 2.5:1 contrast — fails WCAG AA
- 4-col stats grid `grid-cols-4` has no responsive variant — breaks at 320px

**Top Upgrade Opportunities**
1. Add stage/round label per match row
2. Load-more / pagination for results
3. Tournament round grouping (Group Stage, R32, etc.)
4. `aria-live` region on live section
5. Auto-refresh for live scores (currently 5-minute revalidation — too slow for live football)

---

### Standings (`/standings?competition=WC`)

**Current UX**
Redirects WC to `/world-cup-2026-standings`. For other competitions: breadcrumb, heading, CompetitionSelector (horizontal chips), ad, StandingsTable with zone indicators.

**Pain Points**
- WC tab always redirects away — disorienting navigation
- CompetitionSelector `Suspense fallback={null}` — tabs flash in, CLS
- Zone legend always shows UCL/UEL/Relegation — wrong for CL or WC groups
- No form column despite form data existing on `StandingEntry`
- Off-season card uses plain `<a>` tag not Next.js Link

**Visual Issues**
- WC active tab: `yellow-500/black`; all others: `green-500/white` — dual active-colour with no semantic justification
- `text-gray-500` on `bg-gray-900` ≈ 3.5:1 — fails WCAG AA for normal text (error card)
- `goal difference positive` and `team hover` both use `text-green-400` — same colour for two unrelated purposes

**Top Upgrade Opportunities**
1. Form guide column (last 5: W/D/L dots) — zero API cost, high engagement
2. Competition-aware zone legend (WC groups: Advance/Eliminated vs UCL/UEL)
3. Single-row horizontally scrollable CompetitionSelector on mobile
4. Shimmer skeleton mirroring actual table columns
5. "Last updated X min ago" timestamp

---

### Groups (`/world-cup-2026/groups`)

**Current UX**
Server-rendered (ISR 3600s). 12 WCGroupTable cards in 1/2/3-col grid. Qualification legend strip. Browse Groups A–L tiles. WCRelatedLinks footer.

**Pain Points**
- No Suspense/skeleton — entire page blocks on getStandingsCached('WC')
- `text-[10px]` on Browse Groups tiles — unreadably small on mobile
- API error shown as tiny inline orange text — easy to miss

**Visual Issues**
- Browse Groups tiles are `grid-cols-3` on mobile with `text-[10px]` labels — tap targets below 44px minimum
- `text-gray-600` on fixture links — likely fails WCAG AA

**Accessibility Issues**
- Qualification legend colour swatches have no role or aria-label — colour alone conveys meaning (WCAG 1.4.1 violation)
- Page H1 preceded by 📊 emoji with no `aria-hidden`

**Top Upgrade Opportunities**
1. Suspense + streaming with WCGroupsSkeleton per group card
2. Qualification legend as sticky LegendBar with proper ARIA wiring
3. Browse Groups A–L as horizontal pill-scroller on mobile
4. "X of 6 matches played" micro-stat per group card
5. "Last updated X minutes ago" timestamp

---

### Bracket (`/world-cup-2026/bracket`)

**Current UX**
Server-rendered (ISR 900s). Breadcrumb + hero + WCPageNav + round progress pills + R32 MatchCard grid + AdSlot + WCBracket + Third Place card + Final card + "All Knockout Matches" exhaustive list + WCRelatedLinks.

**Pain Points**
- "All Knockout Matches" list at bottom **duplicates** all per-round sections and WCBracket — severe visual repetition
- LocalKnockoutRound fallback: no link, no crest, no match detail — looks broken
- `SectionHeading` component defined but **used nowhere** — all h2s are inlined with duplicated classNames
- R32 grid uses `xl:grid-cols-4` — 16 MatchCards stacked before bracket → very long scroll on mobile

**Visual Issues**
- FinalCard `p-6 mb-5` vs ThirdPlaceCard `p-5 mb-4` — no padding scale
- FinalCard crests 56×56 vs ThirdPlaceCard 40×40 — no shared size token
- FinalCard and hero both use 🏆 — dilutes Final specialness

**Accessibility Issues**
- No `focus-visible` styles on any Link in the file
- Round pills aria-label = 'Knockout rounds' but individual pills read only 'R32 0/16' — cryptic
- Live ping spans have no `aria-live` region

**Top Upgrade Opportunities**
1. Replace "All Knockout Matches" duplicate list with expandable accordion per round
2. Proper overflow-x-auto + fade-out edge on WCBracket for mobile
3. Shared `SpecialMatchCard` base for Third Place + Final (bronze/gold parameterized)
4. `SectionHeading` component used consistently (eliminate 7 duplicated className strings)
5. Suspense boundaries for WCBracket and MatchCard sections

---

### Round Pages (R32 / R16 / QF / SF / Third Place / Final)

All six round pages are thin wrappers over shared `WCRoundPage` — one change applies to all.

**Current UX**
Breadcrumb → hero (icon + h1 + date range + match count) → WCPageNav → round blurb → round pill nav → AdSlot → MatchCard grid or ScheduleSlots fallback → Prev/Next nav → AdSlot → WCRelatedLinks

**Pain Points**
- `ScheduleSlots` uses `text-[10px] text-gray-700` for venue city + footer — contrast ≈ 1.5:1, fails WCAG AA and AAA
- `SectionHeading` component unused — h2 headings duplicated inline
- `WCPageNav` + round pill nav appear within ~20px of each other — two competing nav layers
- Prev/Next navigation is bare text links — low discoverability after long scroll

**Visual Issues**
- `text-[10px]` outside Tailwind type scale (three occurrences in ScheduleSlots)
- `MatchCard` hero h1 `text-2xl` → `sm:text-3xl` with no intermediate step — abrupt jump on tablets
- Round pills overflow on narrow screens with no scroll indicator (WCPageNav has fade edge; round pills don't)

**Accessibility Issues**
- Breadcrumb does not set `aria-current="page"` on last item
- ScheduleSlots has no role or aria-label — invisible to AT navigation
- `ℹ️` emoji in ScheduleSlots footnote has no `aria-hidden`
- Duplicate JSON-LD breadcrumb (from both Breadcrumb.tsx and JsonLd inline in WCRoundPage)

**Top Upgrade Opportunities**
1. Stage progress indicator in hero (e.g., progress ring: "12 of 16 matches played")
2. Sticky round-tab mini-header appearing on scroll
3. `ScheduleSlots` → premium pre-tournament countdown card per slot
4. `SectionHeading` used consistently everywhere
5. Prev/Next as styled navigation cards with round name, match count, date range

---

### Team Page (`/world-cup-2026/team/[slug]`)

**Current UX** (via `WCTeamPageContent`)
Large team crest + team name hero, confederation badge, group letter, followed by upcoming matches and recent results in MatchCard grids, then a WCRelatedLinks footer.

**Pain Points**
- No group standing shown inline — users must navigate to the Groups page to see team's standing
- No qualification status indicator on the page
- Team stats (goals for/against, form) not surfaced despite being available in StandingEntry

**Top Upgrade Opportunities**
1. Inline group standing (team's current row from WCGroupTable)
2. Qualification status badge (Qualified / On track / Eliminated)
3. Recent form pills (W/D/L last 5)
4. Head-to-head upcoming opponents shown

---

### Match Page (`/match/[id]`)

**Current UX**
6-state machine now implemented: PROJECTED, QUALIFIED, PRE_MATCH, LIVE, FINISHED, CANCELLED. ProjectedHero shows dashed-border TBD slots with slot labels. CancelledHero shows faded crests with CANCELLED pill.

**Remaining Issues**
- `ProjectedHero` uses dashed border but no animation or "awaiting" visual motion
- QUALIFIED state countdown is not prominently above-the-fold on mobile
- Live score font size could be larger (currently standard text — should dominate the viewport)
- Below-fold deferred content takes noticeable time to appear with no skeleton

---

## Component Audit

---

### MatchCard (`src/components/MatchCard.tsx`)

**Purpose**: Primary match display unit used across all pages.

**Current Implementation**
Single flat component. `bg-gray-900 border-gray-800 rounded-xl p-4`. Two-row layout with crest + name + score per team. StatusBadge handles FINISHED/LIVE/PAUSED/POSTPONED/CANCELLED. Uses bare `<img>` not `next/image`. `transition-all` on hover (animates all CSS properties — perf issue).

**Issues**
- No variant system — size/density/emphasis cannot be changed via props
- `<img>` not `<next/image>` — no lazy loading, no LQIP, no WebP optimization
- No skeleton/loading state
- No PROJECTED variant — shows "TBD" text without slot label styling
- `transition-all` is a performance anti-pattern (animates layout properties)
- StatusBadge not exported — cannot be reused across pages

**Duplicates in codebase**
| Duplicate | Location | Lines |
|-----------|----------|-------|
| `BracketMatchCard` | `WCBracket.tsx:72` | Full rewrite, fixed px dimensions |
| `ResultRow` | `world-cup-2026/page.tsx:220` | Horizontal score layout |
| `LocalKnockoutRound` | `world-cup-2026/page.tsx:269` | Pre-fixture slot rows |
| `MatchDateList` | `world-cup-2026/fixtures/page.tsx` | Date-grouped compact rows |

**Reusability**: High potential — already used on 8+ pages, but blocked by lack of variant system.

---

### WCBracket (`src/components/WCBracket.tsx`)

**Purpose**: Visual knockout bracket from R16 to Final using SVG connectors.

**Current Implementation**
Fixed px math: `SLOT_H=88, CARD_W=168, CARD_H=68`. SVG connector strips between columns. `BracketMatchCard` is a full MatchCard duplicate. Not responsive — relies on `overflow-x-auto` on mobile. No hover path highlighting. No winner glow. No animated connectors.

**Issues**
- `BracketMatchCard` is 100% duplication of MatchCard — separate component, separate code path
- Fixed pixel dimensions make responsive scaling impossible without a full rewrite
- No hover interaction to highlight which matches feed into each other
- No animation on bracket connectors
- Mobile experience is bare horizontal scroll with no scroll indicator

**Upgrade Opportunities**
1. Replace `BracketMatchCard` with MatchCard (variant="compact-bracket")
2. SVG connector animation via `stroke-dashoffset`
3. CSS hover to highlight connected matches (sibling selector or JS class toggle)
4. CSS `scroll-snap` on mobile with position indicator

---

### WCGroupTable (`src/components/WCGroupTable.tsx`)

**Purpose**: Single group standings table with qualification colour coding.

**Current Implementation**
Clean and reusable. Accepts `qualifications?: Map<number, QualificationStatus>`. Left-border colour indicates qualification status. Missing: form column, GF/GA columns (deliberately removed?), goal difference visual bar, third-place race indicator.

**Issues**
- No form pills (last 5: W/D/L)
- No responsive column hiding for mobile (W/D/L hidden on mobile should show only P/Pts + form)
- Table `<th>` elements have no `scope="col"`
- No sticky group header on scroll

---

### WCCountdown (`src/components/WCCountdown.tsx`)

**Purpose**: Countdown to next match / tournament milestone.

**Issues**
- No digit-flip animation on countdown tick
- Two modes (compact/full) — verify responsive behavior
- No prefers-reduced-motion guard on countdown animation

---

### WCRoundPage (`src/components/WCRoundPage.tsx`)

**Purpose**: Shared server component for all six knockout round pages.

**Issues**
- `ScheduleSlots` uses `text-[10px] text-gray-700` — nearly invisible text
- No stage context header showing bracket path (Group Stage → R32 → R16 → QF → SF → Final)
- Prev/Next navigation lacks visual affordance
- No skeleton / loading.tsx sibling

---

## Cross-Cutting Issues

| Issue | Severity | Affected Pages |
|-------|----------|----------------|
| Missing `focus-visible` rings on all Links | High | All pages |
| Emoji not `aria-hidden` | High | All pages |
| `text-[10px]` outside type scale | High | Hub, Fixtures, R32, R16, Bracket |
| `text-gray-600`/`text-gray-700` fails WCAG AA | High | Fixtures, Results, R32, R16, Groups |
| No Suspense/skeleton | High | Hub, Groups, Bracket |
| `transition-all` perf anti-pattern | Medium | MatchCard (all pages) |
| `<img>` not `next/image` | Medium | MatchCard, ResultRow, all crest displays |
| No sticky nav on mobile scroll | Medium | Schedule, Groups, Round pages |
| Duplicate MatchCard variants | High | Hub (2×), Bracket (1×), Fixtures (1×) |
| aria-labelledby pointing to non-existent IDs | Critical | Hub (all 6 sections) |
| Hardcoded `text-[10px]` arbitrary sizes | Medium | ScheduleSlots, multiple pages |
| `transition-colors` only with no focus style | Medium | All interactive links |

---

## Priority Matrix

### P0 — Fix before any visual work (accessibility + correctness)
- Fix Hub `aria-labelledby` — assign IDs to SectionHeader h2s
- Add `aria-hidden="true"` to all decorative emojis
- Add `focus-visible:ring-2 focus-visible:ring-yellow-400/70` to all interactive elements
- Fix `text-gray-600`/`text-gray-700` contrast failures → use `text-gray-400` minimum

### P1 — Highest visual impact
- Unify MatchCard variants — eliminate BracketMatchCard, ResultRow, LocalKnockoutRound duplicates
- Hub hero: replace emoji with tournament identity header
- Hub: merge Live + Today sections
- Bracket: remove duplicate "All Knockout Matches" list

### P2 — Design system foundation
- Establish typography scale with named tokens
- Establish spacing scale
- Consistent card elevation system
- StatusBadge exported and used everywhere

### P3 — Premium features
- WCBracket hover path highlighting + connector animation
- WCGroupTable form pills
- ScheduleSlots → premium pre-tournament countdown cards
- Suspense + skeleton for all async sections
