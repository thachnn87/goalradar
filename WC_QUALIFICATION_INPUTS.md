# WC_QUALIFICATION_INPUTS.md — Qualification Engine Input Audit
**Sprint:** DATA-18WC.12 | **Date:** 2026-06-25

## Engine Signature

```typescript
// src/lib/wc-qualification.ts
calculateQualificationStatus(tables: StandingTable[]): Map<number, TeamQualification>
```

Input: `StandingTable[]` filtered for `type === 'TOTAL'` — one table per group.

---

## Input Source Trace

```
Page (groups/page.tsx, page.tsx):
  const { standings } = await getStandingsCached('WC')     ← src/lib/api.ts
  const groupTables = standings.filter(s => s.type === 'TOTAL')
  const qualMap = calculateQualificationStatus(groupTables) ← src/lib/wc-qualification.ts
```

`getStandingsCached('WC')` → `readKVOnly('/competitions/WC/standings')`:
- **If KV has data**: merges live data with static skeleton via `toGroupKey()` normalization
- **If KV null** (current production state): returns `getStaticWCGroupTables()` — **all zeros**

---

## Input Validation

| Input Field | Required by Engine | Current Value (production) | Impact of Zero |
|---|---|---|---|
| `entry.playedGames` | Used to compute `gamesRemaining()` | **0** for all teams | `gamesRemaining = 3` → max uncertainty → all UNDECIDED |
| `entry.points` | Used to determine qualified/eliminated | **0** for all teams | No team can be QUALIFIED or ELIMINATED |
| `entry.team.id` | Used as map key | 0 for static skeleton entries | `qualMap.get(teamId)` never matches real FD team IDs (which are non-zero) |
| `entry.won/draw/lost` | Used for tiebreaker logic | **0** | Tiebreakers always tie |
| `entry.goalsFor/goalsAgainst` | Used for GD tiebreaker | **0** | Can't differentiate teams |

---

## Critical Finding: team.id = 0

The static skeleton entries have `team.id = 0` (from `makeEntry()` in wc-static-groups.ts):

```typescript
function makeEntry(position, name, flag): StandingEntry {
  return {
    team: { id: 0, name, shortName: name, tla: name.slice(0,3).toUpperCase(), crest: '' },
    playedGames: 0, ...
  };
}
```

This means even if the qualification engine correctly computes from the static skeleton, `qualMap.get(teamId)` in the page components will never find a match because FD API team IDs are non-zero numeric values (e.g., Mexico = 758). The qualification badges will ALWAYS show undefined/fallback status until live standings with real team IDs are provided.

---

## Does Input Originate from Authority?

**No.** The qualification engine's input comes from `getStandingsCached('WC')` which reads `/competitions/WC/standings` KV — a separate path from the authority cache (`goalradar:wc:authority:v1`). 

The authority cache has all 104 WC matches with scores and statuses. The standings path does NOT derive from the authority cache. These are two independent data paths.

**This is the architectural gap.** The standing data could be computed from authority cache matches (every FINISHED match contributes W/D/L/Pts/GD to each team's standing). However, the current implementation relies on FD API providing standings directly, which is failing.

---

## Proposed Fix (not yet implemented)

Compute WC standings from authority cache:

```typescript
// In api.ts or a new src/lib/wc-standings-compute.ts
export async function computeWCStandingsFromAuthority(): Promise<StandingTable[]> {
  const { matches } = await getWCAuthorityMatchesV2();
  const finishedGroupMatches = matches.filter(
    m => m.stage === 'GROUP_STAGE' && m.state === 'FINISHED'
  );
  // For each match, credit W/D/L/GF/GA/Pts to home and away teams
  // Build StandingTable[] with real team IDs and stats
  // Sort by Pts DESC, GD DESC, GF DESC
}
```

This would eliminate the FD API standings dependency entirely for WC. The authority cache already has the data.
