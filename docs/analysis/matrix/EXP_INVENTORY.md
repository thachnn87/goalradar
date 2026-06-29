# EXP_INVENTORY — DATA-18WC.EXPERIENCE.V2 Phase 1

**Date:** 2026-06-26  
**Status:** VERIFIED from source code ✅  
**Rule:** No new engines. No new pipelines. Reuse only.

---

## 1. Page Inventory

| Page | Route | Current Hero | Current Sections | Experience Gaps |
|---|---|---|---|---|
| **WC Hub** | `/world-cup-2026` | ✅ Rich (stats: played, goals, live) | Live, Today, Upcoming, Groups, Bracket preview, Recent Results | Story Cards, Qualification Simulator teaser, Golden Boot teaser |
| **Group** | `/world-cup-2026/group-[a-l]` | ⚠️ Text h1 only | Standings table + matches | Story Cards for group matches, Qual simulator widget, Live qualification badges |
| **Bracket** | `/world-cup-2026/bracket` | ⚠️ Static h1 | WCBracket visual | No "path highlights"; no team qualifier journey |
| **Round of 32** | `/world-cup-2026/round-of-32` | ✅ Good (icon + date range) | Round nav + match cards | No story cards, no stage intro narrative |
| **Round of 16** | `/world-cup-2026/round-of-16` | ✅ Same as R32 | Same | Same gaps |
| **Quarter-finals** | `/world-cup-2026/quarter-finals` | ✅ Same | Same | Same |
| **Semi-finals** | `/world-cup-2026/semi-finals` | ✅ Same | Same | Same |
| **Third Place** | `/world-cup-2026/third-place` | ✅ Same | Same | Same |
| **Final** | `/world-cup-2026/final` | ✅ Same | Same | Same gaps — this is the crown page |
| **Match** | `/match/[id]` | ⚠️ No hero section | H2H, Events, Match Report, FAQs | NO TIMELINE unified view; story cards; knockout journey indicator |
| **Team** | `/world-cup-2026/teams/[slug]` | ✅ WCTeamPageContent exists | varies by team | Knockout journey indicator, qualification path |
| **Venue** | `/world-cup-2026/venues/[venue]` | ✅ Static full content | All 16 venues complete | No match schedule on venue card (minor) |
| **TV Guide** | `/world-cup-2026/tv-schedule` | ⚠️ Static | Country list | Exists, good |

---

## 2. Reusable Components (AS-IS or minor prop addition)

### Always reuse — DO NOT REPLACE

| Component | File | What it does | Reuse for |
|---|---|---|---|
| `MatchCard` | `src/components/MatchCard.tsx` | Medium/bracket/result variants | Timeline match refs, story card context |
| `WCGroupTable` | `src/components/WCGroupTable.tsx` | Standings + qual color-coded rows | Qualification simulator (swap table data) |
| `WCQualBadge` | `src/components/WCQualBadge.tsx` | Qual status pill (compact or full) | Story card qual status, group widget |
| `WCBracket` | `src/components/WCBracket.tsx` | Full R16→Final bracket | Bracket page; Road to Final highlight layer |
| `WCRoundPage` | `src/components/WCRoundPage.tsx` | Round page shell + Suspense | All 6 round pages (already wired) |
| `WCPageNav` | `src/components/WCPageNav.tsx` | Tournament nav pills | All WC pages |
| `WCCountdown` | `src/components/WCCountdown.tsx` | Countdown / CTA | Hub page |
| `WCGroupTabsClient` | `src/components/WCGroupTabsClient.tsx` | Tab switcher for groups | Hub groups section |
| `Breadcrumb` | `src/components/Breadcrumb.tsx` | Breadcrumb nav | All pages |
| `WCRelatedLinks` | `src/components/WCRelatedLinks.tsx` | Footer link grid | All WC pages |
| `StandingsTable` | `src/components/StandingsTable.tsx` | League standings | Non-WC pages |

### Extend with new props — DO NOT REPLACE

| Component | Current limitation | Needed addition |
|---|---|---|
| `WCGroupTable` | No "scenario" mode | Add optional `scenarioPoints?: Map<teamId, number>` prop for simulator |
| `MatchCard` | No stage context | Add optional `storyCards?: StoryCard[]` prop (renders chips below score) |
| `WCBracket` | No highlight | Add optional `highlightTeamId?: number` prop (gold ring on team's path) |

---

## 3. Engine Reuse Map

### `calculateQualificationStatus()` — `src/lib/wc-qualification.ts`
- **Powers:** Qual Simulator (run on mutated standings), Live Qualification badges, Story Cards (QUALIFIED/ELIMINATED trigger), Group Widget qual status
- **New export needed:** `applyScenarioResult(table, homeId, awayId, homeGoals, awayGoals): StandingTable` — pure function, ~20 lines

### `buildKnockoutViewModel()` — `src/lib/knockout-vm.ts`  
- **Powers:** Road to Final path, Knockout Journey, Bracket highlight
- **New export needed:** `getTeamKnockoutPath(vm, teamId): KnockoutStage[]` — filter vm.bracketMatches for team's progression, ~15 lines

### `buildStoryContext()` + `buildStoryReport()` — `src/lib/match-story-engine.ts`
- **Powers:** Match narrative (already deployed), Stage intro text on round pages
- **New export needed:** `buildStoryCards(match: MatchDetail, qual?: TeamQualification): StoryCard[]` — rule engine returning array of cards, ~60 lines

### `getWCAuthorityMatchesV2()` — `src/lib/api.ts`
- **Powers:** All WC match data. No change needed.

### `getStandingsCached()` — `src/lib/api.ts`
- **Powers:** All standings data. No change needed.

### `getOrBuildMatchSnapshot()` — `src/lib/match-snapshot.ts`
- **Powers:** Match page data (goals, bookings, subs, referees, H2H). No change needed.

---

## 4. New Code Required (Components only — no new engines)

| What | Where | How | Estimated lines |
|---|---|---|---|
| `StoryCardStrip` | `src/components/StoryCardStrip.tsx` | NEW component — renders array of `StoryCard[]` as horizontal chip strip | ~80 lines |
| `MatchTimeline` | `src/components/MatchTimeline.tsx` | NEW component — merges goals+bookings+subs sorted by minute, renders chronological spine | ~120 lines |
| `KnockoutJourney` | `src/components/KnockoutJourney.tsx` | NEW component — renders team's path: Group → R32 → R16 → QF → SF → Final | ~100 lines |
| `RoadToFinal` | `src/components/RoadToFinal.tsx` | NEW component — bracket path from current stage to Final for one match/winner | ~90 lines |
| `QualSimulator` | `src/components/QualSimulator.tsx` | NEW client component — toggle match outcomes, update `WCGroupTable` live | ~150 lines |
| `buildStoryCards()` | `src/lib/match-story-engine.ts` | ADD export — rule engine for story card generation | ~60 lines |
| `applyScenarioResult()` | `src/lib/wc-qualification.ts` | ADD export — pure scenario calculation | ~20 lines |
| `getTeamKnockoutPath()` | `src/lib/knockout-vm.ts` | ADD export — team's match chain | ~15 lines |

**Total new code: ~635 lines. No new files in `lib/` except additions to existing engine files.**

---

## 5. Do-Not-Touch List (Architecture — Frozen)

| Asset | Why frozen |
|---|---|
| `src/lib/match-story-engine.ts` (buildStoryReport) | ONE story engine — only add exports, never modify existing functions |
| `src/lib/wc-qualification.ts` (calculateQualificationStatus) | ONE qualification engine |
| `src/lib/knockout-vm.ts` (buildKnockoutViewModel) | ONE knockout VM |
| `src/lib/match-snapshot.ts` (getOrBuildMatchSnapshot) | Cache architecture |
| `src/lib/api.ts` (getWCAuthorityMatchesV2) | Authority pipeline |
| All KV keys | Cache contract |
| All route files (page.tsx) for pages listed above | Routes frozen — only add component imports |

---

## 6. Violation Check

Before each implementation task, confirm:
- ONE SOURCE: reading from authority:v1 / snapshot / standings KV only ✅
- ONE PIPELINE: no new fetch chains ✅
- ONE VIEW MODEL: knockout-vm.ts is the only VM ✅
- ONE COMPONENT: check existing list before creating ✅
- ONE ROUTE: no new routes in this sprint ✅
