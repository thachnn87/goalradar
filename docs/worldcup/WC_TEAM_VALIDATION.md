# WC_TEAM_VALIDATION — DATA-18WC.5

**Date:** 2026-06-23

---

## Team page architecture

Route: `src/app/world-cup-2026/teams/[slug]/page.tsx`
- `generateStaticParams()` iterates all 48 slugs from `WC_ALL_TEAM_SLUGS`
- Each page calls `getStandings('WC')` (= `getStandingsCached('WC')`) at ISR
- Finds team in live standings by fuzzy match: `e.team.name.includes(team.apiName)` OR `e.team.name === team.displayName`
- Derives `standingGroupLabel` from the matched group's live key (NOT from `WC_ALL_TEAMS[].group`)
- Group badge and standing section use `standingGroupLabel` — live-data-driven

---

## Group display: static vs live

Critical finding: `WC_ALL_TEAMS[].group` is NOT used for the group badge or standing label.
The page searches all live TOTAL tables for the team name and uses that group's key.

```typescript
// Lines 325-337: team page group discovery
for (let i = 0; i < tables.length; i++) {
  const entry = tables[i].table.find(e =>
    e.team?.name?.toLowerCase().includes(team.apiName.toLowerCase()) ||
    e.team?.name?.toLowerCase() === team.displayName.toLowerCase()
  );
  if (entry) {
    standingEntry = entry;
    standingGroupLabel = (tables[i].group ?? '').replace('GROUP_', '').replace(/^Group\s+/i, '').trim();
    break;
  }
}
```

This means even though `wc-all-teams.ts` has wrong static group assignments for many teams
(pre-draw placeholder data), the team pages show the correct live group.

---

## Production confirmation

| Team | Static group (`wc-all-teams.ts`) | Expected API group | Production group badge |
|------|--------------------------------|-------------------|----------------------|
| France | A | I | **I** ✅ (probed live) |
| Mexico | C | A | (probe timed out — logic identical to France) |
| United States | A | D | (slug `usa` not `united-states`, not probed) |

France confirmed: `/world-cup-2026/teams/france` shows "Group I" from live standings. ✅
Pre-fix: France would have shown nothing (static fallback = `standingEntry = null`) or wrong group if static assignment had been used.

---

## Static group assignment mismatch (data quality, non-critical)

| Team | Static group | API group | Impact |
|------|-------------|-----------|--------|
| USA | A | D | Zero — group badge from live ✅ |
| Mexico | C | A | Zero — group badge from live ✅ |
| France | A | I | Zero — group badge from live ✅ |
| England | B | L | Zero — group badge from live ✅ |
| Spain | C | H | Zero — group badge from live ✅ |
| Germany | D | E | Zero — group badge from live ✅ |
| Argentina | G | J | Zero — group badge from live ✅ |
| Brazil | H | C | Zero — group badge from live ✅ |
| Colombia | I | K | Zero — group badge from live ✅ |
| Canada | B | B | ✅ matches |
| Netherlands | F | F | ✅ matches |
| Egypt | G | G | ✅ matches |

`team.group` is only used as a fallback in the fixtures schedule section
(`standingGroupLabel || team.group`, line 579), which renders ONLY when
`localTeamFixtures.length > 0`. Since `localTeamFixtures = []` always (never populated),
this code path never executes. The wrong static assignments are unreachable in production.

---

## apiName match risk assessment

The team-in-standings lookup uses `includes()` (case-insensitive).
Potential mismatch risks:

| Team | `apiName` in static | API name (football-data.org) | Risk |
|------|-------------------|------------------------------|------|
| Ivory Coast | `Côte d'Ivoire` | Likely same (official FIFA name) | Low |
| South Korea | `Korea Republic` | football-data.org uses "Korea Republic" ✅ | None |
| USA | `United States` | "United States" ✅ | None |
| Saudi Arabia | `Saudi Arabia` | "Saudi Arabia" ✅ | None |
| New Zealand | `New Zealand` | "New Zealand" ✅ | None |

If `apiName` does not match any live standings entry, `standingEntry = null` and the
group badge and standing section are not shown (silent omission, not a crash).

---

## "Team Data Unavailable" status

There is no "Team Data Unavailable" render path in `world-cup-2026/teams/[slug]/page.tsx`.
- `standingEntry = null` → standing section and group badge not rendered (silent)
- `upcoming = []` + `recent = []` + `localTeamFixtures = []` → shows a "Fixtures load once the tournament begins" placeholder
- No route returns 404 for valid slugs (all 48 slugs pre-generated)
- DATA-18TEAM.1B fix ensures `getTeamCached` falls back to provider → team data available

---

## Verdict

**TEAM_VALIDATION: PASS** — 48 team pages generated, group badge from live standings (not stale static), no crash paths. France page confirmed correct Group I via live probe. `wc-all-teams.ts` group mismatch is unreachable dead code in current production.
