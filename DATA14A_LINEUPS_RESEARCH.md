# DATA-14A Lineups Research
## ESPN Roster/Lineup Data Availability

Date: 2026-06-16
Status: Research only — no implementation.

---

## 1. Endpoint Investigated

```
GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event={id}
```

Tested on: 760423 (Ivory Coast–Ecuador), 760427 (Iran–New Zealand).

---

## 2. Available Data in `rosters` Array

The summary response includes a top-level `rosters` array (confirmed present for all audited WC matches).

### Shape

```typescript
interface EspnRoster {
  team:   { id: string; displayName: string; ... }
  roster: EspnRosterEntry[]
}

interface EspnRosterEntry {
  active:         boolean
  starter:        boolean         // true = starting XI, false = substitute bench
  jersey:         string          // shirt number
  athlete: {
    id:           string
    displayName:  string
    shortName?:   string
  }
  position: {
    name:         string          // 'Goalkeeper', 'Center-Back Left', 'Right Back', ...
    abbreviation: string          // 'G', 'CD-L', 'RB', 'CM', 'LM', 'CF', ...
  }
  subbedIn:       boolean         // true = came on as a substitute
  subbedOut:      boolean         // true = was substituted off
  formationPlace: number          // 1–11 formation slot (1=GK, 2–11 outfield)
  stats:          unknown[]       // present but empty in tested responses
  media:          unknown         // present, not inspected
}
```

### Confirmed data per match

| Data point | Available | Notes |
|-----------|-----------|-------|
| Starting XI (11 players) | ✅ | `starter === true`, 11 entries per team |
| Substitutes (bench) | ✅ | `starter === false`, 14–15 entries per team |
| Shirt numbers | ✅ | `jersey` field |
| Positions | ✅ | `position.abbreviation` — tactical positions (CD-L, CM-R, etc.) |
| Formation placement | ✅ | `formationPlace` 1–11 (1=GK) |
| Substitutions made | ✅ | `subbedIn` / `subbedOut` booleans on each player |
| Coach | ❌ | Not present in rosters or any summary key |
| Formation (as string, e.g. "4-3-3") | ❌ | No explicit formation string; inferred from `formationPlace` |

### Formation inference

The `formationPlace` field assigns each of the 11 starters a slot 1–11. Combined with `position.abbreviation`, the formation can be reconstructed geometrically. Example (Ivory Coast):

```
#1  Yahia Fofana         [G]    fp=1   ← goalkeeper
#20 Emmanuel Agbadou     [CD-L] fp=6   ← left center-back
#5  Wilfried Singo       [CD-R] fp=5   ← right center-back
#3  Ghislain Konan       [LB]   fp=3   ← left back
#17 Guela Doué           [RB]   fp=2   ← right back
#6  Seko Fofana          [CM-L] fp=8
#8  Franck Kessié        [CM-R] fp=4
#24 Bazoumana Touré      [LM]   fp=11
#11 Yan Diomande         [RM]   fp=7
#12 Elye Wahi            [CF-L] fp=9
#19 Nicolas Pépé         [CF-R] fp=10
```

The position slot pattern suggests a back-5 or back-4 formation. No ESPN-provided formation string was found.

---

## 3. Other Relevant Summary Keys

Full list of top-level keys in the summary response (760423):

```
boxscore, format, gameInfo, lastFiveGames, headToHeadGames, leaders, broadcasts,
pickcenter, odds, hasOdds, news, rosters, article, videos, commentary,
wallclockAvailable, meta, standings
```

Potentially useful for future features:
- **`boxscore.teams`** — team-level stats (possession, shots, etc.) if present
- **`leaders`** — statistical leaders per team
- **`headToHeadGames`** — recent H2H directly from ESPN
- **`gameInfo`** — venue, attendance, referee

---

## 4. Summary

| Feature | Feasible via ESPN? | Source key |
|---------|-------------------|-----------|
| Starting XI names | ✅ | `rosters[].roster[].{starter=true}` |
| Bench players | ✅ | `rosters[].roster[].{starter=false}` |
| Jersey numbers | ✅ | `rosters[].roster[].jersey` |
| Tactical positions | ✅ | `rosters[].roster[].position.abbreviation` |
| Formation placement (visual) | ✅ (inferred) | `rosters[].roster[].formationPlace` |
| Sub events (who replaced whom) | ✅ | `keyEvents` type:76 + `subbedIn/subbedOut` |
| Formation string ("4-3-3") | ❌ | Not provided |
| Coach name | ❌ | Not in summary |
| Possession / shots | Possibly | `boxscore.teams` — not inspected |

---

## 5. Implementation Notes (for future DATA-14B)

Implementing a lineups section would require:

1. Fetch `rosters` from ESPN summary (already fetched in `getEspnMatchEvents`)
2. Define `EspnRosterEntry` interface and parse into `Lineup` type
3. Cache alongside goals/bookings/subs in `CachedEspnEvents`
4. Add `LineupsSection` component to match page (currently shows static "not available" message)

**Complexity estimate:** Medium — the data is clean and well-structured. Main work is UI layout and caching schema extension.
