# DATA-16 Lineups Report
## ESPN Roster → Lineups Section

Date: 2026-06-17

---

## Source

ESPN summary endpoint (already called by `getEspnMatchEvents`):
```
GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event={id}
```

`rosters` array confirmed present for all 18 finished WC 2026 matches.
No additional API call needed — data is in the same response as goals/cards/subs.

---

## Data available per player

| Field | ESPN key | Stored |
|-------|----------|--------|
| Name | `athlete.displayName` | ✅ |
| Jersey number | `jersey` | ✅ |
| Position (abbreviated) | `position.abbreviation` | ✅ e.g. `G`, `CD-L`, `CM-R`, `CF` |
| Formation placement | `formationPlace` | ✅ 1–11 (1=GK) |
| Starter vs bench | `starter` | ✅ |
| Subbed in | `subbedIn` | ✅ |
| Subbed out | `subbedOut` | ✅ |
| Coach | — | ❌ not in ESPN summary |
| Formation string | — | ❌ not provided |

---

## UI rendering

`LineupsSection` in `src/app/match/[id]/page.tsx`:

- Two-column layout: home team (left) | divider | away team (right)
- Starting XI: jersey · name · position · ↓ if substituted off
- Bench separator heading
- Bench players: faded, jersey · name · position · ↑ if substituted on
- Players sorted by `formationPlace` (1=GK at top)
- Falls back to "not available" message if `match.lineups` is null (no regression for matches without enrichment)

---

## Cache

`lineups` stored in `CachedEspnEvents` alongside goals/bookings/subs, under
`goalradar:espn:event:{fdMatchId}` with the new 30-day TTL (DATA-16 Obj 2).

Once a match is enriched, lineups are stable and cached for 30 days.

---

## Known limitations

- **Formation string** not provided by ESPN; position abbreviations infer line but not shape
- **Coach** not available in ESPN summary
- **Photo/crest** per player not available on free ESPN tier
- Bench size varies per match (14-15 players); all are listed under "Substitutes"
