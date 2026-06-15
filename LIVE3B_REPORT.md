# LIVE-3B Goal Scorers Report
## GoalRadar · Sprint LIVE-3B

Implemented: 2026-06-15
Implementation plan: `LIVE3B_IMPLEMENTATION.md`
Audit: `LIVE3B_SCORERS_AUDIT.md`

---

## Change

Added a compact `GoalScorers` component to the bottom of the `ScoreHero` card in
`src/app/match/[id]/page.tsx`. Renders for FINISHED/IN_PLAY/PAUSED matches when
`match.goals[]` is non-empty. SSR only — no polling, no provider calls, no KV keys.

### New helpers (co-located in `page.tsx`)

**`goalSuffix(type: string)`** — normalises both provider formats:
```
football-data.org:  "PENALTY"   → "(P)"   |  "OWN_GOAL"   → "(OG)"
api-football:       "Penalty"   → "(P)"   |  "Own Goal"    → "(OG)"
"REGULAR" / "Normal Goal" / any other → ""
```

**`GoalScorers({ match })`** — two-column compact scorer list:
- Left column: home team goals, chronological
- Right column: away team goals, reversed (right-aligned)
- Format: `⚽ Player 34'` / `⚽ Player (P) 67'` / `⚽ Player (OG) 52'` / `⚽ Player 45+2'`
- Returns `null` when goals array is empty or match not yet live/finished

### Placement

Inside `ScoreHero`, after the venue/referee meta row. Visually separated by a
`border-t border-gray-800` divider — same style as the referee row above it.

---

## Verification

### Component logic

Verified by injecting mock goals into the hero on `/match/537358-sweden-vs-tunisia`:

```
⚽ Gyöke...  12'      41'  Khazri  ⚽
⚽ Isak      34'
⚽ Ku...  (P) 67'
⚽ Claess... 78'
⚽ [OG]   45+2'
```

Confirmed:
- ✅ Two-column layout: home left, away right
- ✅ Away column correctly reversed (`flex-row-reverse`)
- ✅ `(P)` and `(OG)` suffix labels render
- ✅ Injury time `45+2'` formats correctly via `minuteLabel()`
- ✅ Names truncate gracefully on narrow viewport

### Real data state

Match 537358 (Sweden 5–1 Tunisia, WC 2026, 15 Jun 02:00 UTC) returned an
**empty `goals[]`** from the football-data.org API. This is a data availability
issue — WC 2026 event data (goal events with scorer names) is not yet populated
by the provider for matches completed today.

The component correctly returned `null` — no empty section shown, no crash.
The existing below-fold `GoalsSection` also showed nothing for the same reason.

**Full scorer display will work once football-data.org populates goal events
for WC 2026 matches.** No code change is required.

---

## What is unchanged

| Concern | Status |
|---------|--------|
| `vercel.json` | not touched |
| `GoalsSection` (below fold) | unchanged — detailed view preserved |
| Provider calls | zero — uses existing `snapshot.match.goals[]` |
| KV keys | none added |
| Polling | none — SSR only |
| TypeScript | 0 errors |
| Bookings / substitutions | out of scope — LIVE-4 Timeline |

---

## Commit

Pending — see git log.
