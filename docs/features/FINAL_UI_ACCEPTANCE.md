# Final UI Acceptance Criteria — WC 2026

> The bar: the final product must feel like an official premium World Cup experience,
> not a football statistics website.

---

## The Emotional Bar

A stakeholder visiting for the first time should feel:
- "This looks like it belongs next to FIFA.com"
- "I can feel the tournament energy"
- "The data is authoritative — I trust this"
- "This works perfectly on my phone"
- "Everything is fast and smooth"

If any of these statements are doubtful, the sprint is not done.

---

## Per-Page Acceptance Criteria

### Hub (`/world-cup-2026`)

- [ ] Hero section immediately communicates "this is the World Cup 2026" — no ambiguity
- [ ] Next kickoff countdown visible above the fold on 390px viewport
- [ ] Live matches (when active) are prominently displayed with red live indicator
- [ ] Live and Today sections are unified — no duplicate conceptual sections
- [ ] Group standings reachable without more than 2 scrolls from top of page
- [ ] Bracket preview visible on the page — even if not full detail
- [ ] No 🏆 emoji as the primary hero visual — replaced with proper tournament identity
- [ ] Crawler discovery nav is visually subordinate (not competing with content)
- [ ] Page feels like an **event dashboard**, not a homepage

### Schedule (`/schedule?competition=WC`)

- [ ] WC matches show team crests — never just text names
- [ ] No "TBD vs TBD" for matches where teams are confirmed
- [ ] Live matches show red pulse indicator
- [ ] Competition tab strip visible without scrolling
- [ ] CompetitionSelector has visible fallback (no null Suspense)
- [ ] Page scannable at a glance — user can find today's matches in under 5 seconds

### Fixtures (`/world-cup-2026/fixtures`)

- [ ] Knockout matches show slot labels (e.g., "1st Group A") until resolved
- [ ] No dual-render — matches appear once, not as list + card simultaneously
- [ ] Group stage matches show group letter context
- [ ] Stage filter or jump-to-section mechanism present
- [ ] Status badges consistent and readable across all match types

### Results (`/world-cup-2026/results`)

- [ ] Each result shows the tournament stage/round (Group A, Quarter-final, etc.)
- [ ] Results not cut off at 40 with no explanation (pagination or load-more visible)
- [ ] Stats strip visible when matches have been played
- [ ] No text-[10px] labels — all text ≥ text-xs (12px)

### Standings (`/standings?competition=WC`)

- [ ] WC tab navigates to the WC standings correctly
- [ ] Form pills (last 5: W/D/L) visible in table
- [ ] Competition selector is single-row scrollable strip on mobile
- [ ] Zone legend is competition-appropriate (not UCL/UEL/Relegation for WC groups)
- [ ] Table skeleton matches actual table column structure

### Groups (`/world-cup-2026/groups`)

- [ ] All 12 groups visible without excessive scrolling (tabbed, paginated, or accordion)
- [ ] Qualification positions visually coded (green = advancing, amber = 3rd-place race)
- [ ] "X of 6 matches played" progress visible per group
- [ ] Browse Groups A–L has ≥ 44px touch targets on mobile
- [ ] No text-[10px] labels

### Bracket (`/world-cup-2026/bracket`)

- [ ] Bracket immediately recognizable as a tournament bracket
- [ ] Current round visually emphasized (bolder, highlighted)
- [ ] TBD slots show slot labels — not empty boxes
- [ ] Hover (desktop): connections between matches highlighted
- [ ] Mobile: bracket navigable without horizontal overflow (accordion or horizontal scroll with indicator)
- [ ] "All Knockout Matches" duplicate list removed (or replaced with expandable accordion)
- [ ] Third Place and Final have distinct premium visual treatment (bronze/gold)
- [ ] No BracketMatchCard — unified with MatchCard

### Round Pages (R32 / R16 / QF / SF / Third Place / Final)

- [ ] Stage context clear — user knows where they are in the tournament
- [ ] Bracket path progress indicator visible (Group Stage → R32 → R16 → ...)
- [ ] Matches show team crests
- [ ] Upcoming matches show correct slot labels (not empty)
- [ ] Finished matches show scores prominently
- [ ] Prev/Next navigation is styled and visually distinct (not bare text links)
- [ ] ScheduleSlots fallback text is readable (no text-gray-700 — fails WCAG)

### Team Page (`/world-cup-2026/team/[slug]`)

- [ ] Team crest prominent (≥ 64px)
- [ ] Current group standing shown inline (position, points, group)
- [ ] Qualification status badge visible
- [ ] Upcoming and recent matches listed

### Match Page (`/match/[id]`)

#### PROJECTED state (teams TBD)
- [ ] Slot labels shown (e.g., "Winner Group C vs 2nd Group D") — not "TBD"
- [ ] Clear explanation of when teams will be confirmed
- [ ] No error message, no white screen
- [ ] PROJECTED badge visible

#### QUALIFIED state (teams confirmed, match scheduled)
- [ ] Both teams with crests and full names
- [ ] Kickoff date/time prominent
- [ ] No score shown (match not played)

#### PRE_MATCH state (within 24h of kickoff)
- [ ] Countdown to kickoff visible above fold on 390px
- [ ] Teams prominent with crests
- [ ] Venue shown

#### LIVE state
- [ ] Current score **dominates** the viewport — large, bold, centered
- [ ] Red live pulse indicator
- [ ] Match time/minute shown
- [ ] Recent goals visible without scrolling

#### FINISHED state
- [ ] Final score prominent
- [ ] Goals with times visible (above fold or within first scroll)
- [ ] Winning team visually indicated (winner text white, loser muted)

#### CANCELLED state
- [ ] Clear CANCELLED/POSTPONED status pill
- [ ] Teams shown (faded)
- [ ] No harsh red error treatment — gentle, informational

---

## Visual Consistency Acceptance

- [ ] All pages use the same typography scale — no text-[10px] anywhere
- [ ] All match cards use unified MatchCard component — zero duplicates
- [ ] Status badges consistent shape/colour across all pages (same badge, not different per page)
- [ ] Colour palette consistent: amber-400/amber-500 for brand, red-400/red-500 for live, emerald for qualification
- [ ] No `transition-all` — always specify which properties animate
- [ ] No `text-gray-700` for meaningful text
- [ ] All interactive elements have visible `focus-visible` ring

---

## Accessibility Acceptance

- [ ] All interactive elements keyboard-navigable
- [ ] Focus indicators visible (ring-2 ring-amber-400/70)
- [ ] Sufficient contrast: all meaningful text ≥ 4.5:1 against background
- [ ] Screen reader: MatchCard reads "Match: [Home] vs [Away], [Status], [Score if applicable]"
- [ ] All decorative emojis have `aria-hidden="true"`
- [ ] All images have explicit `width` and `height` props
- [ ] Qualification legend not colour-only (includes text labels)
- [ ] aria-labelledby on Hub sections points to real IDs

---

## Performance Acceptance

- [ ] Lighthouse Performance ≥ 85 on Hub page
- [ ] Lighthouse Performance ≥ 85 on Match page
- [ ] CLS < 0.05 on all pages
- [ ] LCP ≤ 2.5s on Hub (simulated 4G)
- [ ] No horizontal overflow at 390px on any page
- [ ] CompetitionSelector has non-null Suspense fallback (no CLS)
- [ ] Ad slots have min-height reservation

---

## Architecture Acceptance

- [ ] `npx tsc --noEmit` → zero real errors (filter stale third-place-playoff artifact)
- [ ] `npm run build` → succeeds
- [ ] No new `/api/` routes
- [ ] No new KV cache keys
- [ ] No duplicate route serving same WC content
- [ ] ONE MatchCard: `BracketMatchCard`, `ResultRow`, `LocalKnockoutRound` deleted
- [ ] All WC data flows: `authority:v1 → enrichKnockoutSlots → canonicalToMatch`
- [ ] PROJECTED snapshots still expire in 5min (not regressed to 6h)
- [ ] TBD-RESOLVE self-heal still functional

---

## Final Sign-Off Gate

Sign-off requires ALL of the following:

```
[ ] All per-page criteria pass (Hub, Schedule, Fixtures, Results, Standings, Groups, Bracket, Rounds, Team, Match)
[ ] Visual consistency checks pass
[ ] Accessibility acceptance passes (minimum: focus rings, aria-hidden emojis, contrast)
[ ] Performance acceptance passes (Lighthouse ≥85, CLS <0.05)
[ ] Architecture acceptance passes (tsc zero errors, build succeeds, no duplicates)
[ ] Regression check passes (REGRESSION_CHECK.md full checklist)
[ ] Production smoke test passes (journey gate + guardian scripts)
```

If any gate fails: fix and recheck before declaring the sprint complete.

---

## Acceptance Statement

When all gates pass:

> GoalRadar World Cup 2026 has been elevated from a football statistics site to a premium tournament destination. The experience is visual, authoritative, and immersive. Data architecture is intact. All accessibility requirements are met. Performance is equal to or better than pre-sprint baseline.

This statement is the definition of DONE for DATA-18WC.UI-X Sprint.
