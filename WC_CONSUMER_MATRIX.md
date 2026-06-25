# WC_CONSUMER_MATRIX.md — Consumer Inventory
**Sprint:** DATA-18WC.12 | **Date:** 2026-06-25

| Page | Source Function | KV Key | ISR (s) | Owner | Issues |
|---|---|---|---|---|---|
| `/world-cup-2026` (Hub) | `getWCAuthorityMatchesV2`, `getStandingsCached('WC')`, `getWCKnockoutMatchesCached`, `getCurrentLiveMatches` | `wc:authority:v1`, `/competitions/WC/standings`, `/competitions/WC/matches`, `live:matches` | 30 | Authority | Standings zero-state; hub shows less R32 info than bracket page |
| `/world-cup-2026/groups` | `getStandingsCached('WC')` | `/competitions/WC/standings` | 3600 | Standings | Standings zero-state; stale "Tournament begins" copy (now fixed); wrong group composition in static fallback |
| `/world-cup-2026/group-{a-l}` | `getStandingsCached('WC')` + authority for matches | `/competitions/WC/standings` | 3600 | Standings | Same zero-state; wrong team composition in fallback |
| `/world-cup-2026/fixtures` | `getWCAuthorityMatchesV2` | `wc:authority:v1` | 900 | Authority | OK — results/fixtures path is healthy |
| `/world-cup-2026/results` | `getWCAuthorityMatchesV2` | `wc:authority:v1` | 900 | Authority | P0: Panama vs Croatia 537412 shows FT 0-1 (CANCELLED, DR poisoned) |
| `/world-cup-2026/teams/[slug]` | `getWCTeam()` (static) + `getWCAuthorityMatchesV2` + `getStandingsCached('WC')` | `wc:authority:v1`, `/competitions/WC/standings` | 3600 | Authority + Static | Wrong group on team page; standings zero (0pts shown) |
| `/world-cup-2026/bracket` | `getWCKnockoutMatchesCached` + `WC_KNOCKOUT_SLOTS` | `/competitions/WC/matches` | 900 | Authority | ISR was 21600s (now 900s); R32 M16 label ambiguous ("3rd best vs 3rd best") |
| `/world-cup-2026/round-of-32` | `getWCKnockoutMatchesCached` + `WC_KNOCKOUT_SLOTS` | `/competitions/WC/matches` | 900 | Authority | Same source as bracket; consistent by code |
| `/world-cup-2026/round-of-16` … `/final` | `getWCKnockoutMatchesCached` + slot lookup | `/competitions/WC/matches` | 900 | Authority | No issues |
| `/live` | `getCurrentLiveMatches` + authority | `live:matches` | real-time | Live SSOT | Cannot audit from production snapshot (page blocked in DATA-18WC.11) |
| Match detail `/match/[id]` | `getMatchSnapshotCached(id)` | `goalradar:match:{id}` | 900 | Snapshot | Poisoned key 537412 shows FINISHED; DR key has wrong status |

---

## Source Function Reference

| Function | File | Returns | KV Key Read |
|---|---|---|---|
| `getWCAuthorityMatchesV2` | `src/lib/api.ts` | `CanonicalMatch[]` | `goalradar:wc:authority:v1` |
| `getStandingsCached('WC')` | `src/lib/api.ts` | `StandingTable[]` merged | `/competitions/WC/standings` |
| `getWCKnockoutMatchesCached` | `src/lib/api.ts` | `Match[]` | `/competitions/WC/matches` |
| `getCurrentLiveMatches` | `src/lib/wc-live-ssot.ts` | live match IDs | `goalradar:live:matches` |
| `getMatchSnapshotCached` | `src/lib/match-snapshot.ts` | `CanonicalMatch` | `goalradar:match:{id}` |
| `calculateQualificationStatus` | `src/lib/wc-qualification.ts` | `Map<teamId, TeamQualification>` | (computed from StandingTable[]) |
| `getStaticWCGroupTables` | `src/lib/wc-static-groups.ts` | `StandingTable[]` (zeros) | none (built from wc-all-teams.ts) |
