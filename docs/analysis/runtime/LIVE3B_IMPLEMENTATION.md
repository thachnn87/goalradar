# LIVE-3B Goal Scorers Implementation
## GoalRadar · Sprint LIVE-3B

Generated: 2026-06-15

---

## Audit findings

### 1. `snapshot.match.goals[]` — present and complete

`buildSnapshot()` in `match-snapshot.ts` populates `snapshot.match` as a full
`MatchDetail` (line ~378: `return assembleSnapshot(matchId, match, ...)`).
`MatchDetail` extends `Match` and adds `goals[]`.

```typescript
interface MatchDetail extends Match {
  goals:         Goal[];
  bookings:      Booking[];
  substitutions: Substitution[];
  venue:         string | null;
  referees:      Referee[];
}

interface Goal {
  minute:     number;
  injuryTime: number | null;
  type:       string;
  team:       Team;
  scorer:     { id: number; name: string };
  assist:     { id: number; name: string } | null;
}
```

**`goals[]` is present and complete in `snapshot.match` at runtime.**

### 2. Goal type values by provider

| Provider | Regular | Penalty | Own goal |
|----------|---------|---------|----------|
| football-data.org | `"REGULAR"` or `""` | `"PENALTY"` | `"OWN_GOAL"` |
| api-football | `"Normal Goal"` | `"Penalty"` | `"Own Goal"` |

`goalSuffix()` helper normalises both providers:
```typescript
function goalSuffix(type: string): string {
  if (type === 'PENALTY'  || type === 'Penalty')  return '(P)';
  if (type === 'OWN_GOAL' || type === 'Own Goal') return '(OG)';
  return '';
}
```

### 3. Existing `GoalsSection` — preserved, complementary

A detailed `GoalsSection` already exists in `BelowTheFoldDeferred` (line 670 of
`page.tsx`). It renders below the fold in a separate card with assists, goal type
labels, and a 2-column mirrored layout. **It is not replaced.**

The new compact component renders **inside the ScoreHero card**, immediately visible
without scrolling. The two serve different roles:
- `GoalScorers` (new): above-fold compact summary for immediate orientation
- `GoalsSection` (existing): below-fold detailed view with assists

### 4. Placement

The compact scorers are added at the bottom of `ScoreHero`, after the venue/referee
line. This is the natural match-result pattern — score + scorers in one card.

No new components file needed: `GoalScorers` is a plain function in `page.tsx`,
co-located with `ScoreHero` and `minuteLabel`.

---

## Format

```
Home goals (left column)    Away goals (right column)
⚽ Isak 12'                 ⚽ Khazri 41'
⚽ Gyokeres 34'
⚽ Kulusevski (P) 79'
```

- Normal goal: `⚽ Player 34'`
- Penalty:     `⚽ Player (P) 67'`
- Own goal:    `⚽ Player (OG) 52'`
- Injury time: `⚽ Player 45+2'` (uses existing `minuteLabel()`)
- Away column: text right-aligned, mirrored from home

---

## Implementation

### `GoalScorers` component (added to `page.tsx`)

```typescript
function GoalScorers({ match }: { match: MatchDetail }) {
  const goals = [...(match.goals ?? [])].sort((a, b) => a.minute - b.minute);
  if (!goals.length) return null;
  if (!['IN_PLAY', 'PAUSED', 'FINISHED'].includes(match.status)) return null;

  const homeGoals = goals.filter((g) => g.team?.id === match.homeTeam.id);
  const awayGoals = goals.filter((g) => g.team?.id !== match.homeTeam.id);

  return (
    <div className="mt-4 pt-4 border-t border-gray-800">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          {homeGoals.map((g, i) => (
            <div key={i} className="flex items-baseline gap-1.5 text-xs text-gray-300">
              <span className="text-sm leading-none">⚽</span>
              <span className="font-medium truncate">{g.scorer?.name}</span>
              {goalSuffix(g.type) && (
                <span className="text-gray-500 shrink-0">{goalSuffix(g.type)}</span>
              )}
              <span className="text-gray-500 ml-auto shrink-0 tabular-nums">
                {minuteLabel(g.minute, g.injuryTime)}
              </span>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {awayGoals.map((g, i) => (
            <div key={i} className="flex items-baseline gap-1.5 text-xs text-gray-300 flex-row-reverse">
              <span className="text-sm leading-none">⚽</span>
              <span className="font-medium truncate text-right">{g.scorer?.name}</span>
              {goalSuffix(g.type) && (
                <span className="text-gray-500 shrink-0">{goalSuffix(g.type)}</span>
              )}
              <span className="text-gray-500 mr-auto shrink-0 tabular-nums">
                {minuteLabel(g.minute, g.injuryTime)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Placement in `ScoreHero`

Added after the venue/referee meta section:

```tsx
{/* Goal scorers — compact above-fold summary */}
<GoalScorers match={match} />
```

---

## What is unchanged

| Concern | Status |
|---------|--------|
| `vercel.json` | not touched |
| `GoalsSection` (below fold) | unchanged — detailed view preserved |
| `BookingsSection` | unchanged |
| `SubstitutionsSection` | unchanged |
| Provider calls | zero — uses existing `snapshot.match.goals[]` |
| KV keys | none added |
| Polling | none — SSR only |
| Bookings / substitutions | out of scope — LIVE-4 Timeline |
