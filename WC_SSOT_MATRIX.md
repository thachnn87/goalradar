# WC_SSOT_MATRIX.md — Single Source of Truth Audit
**Sprint:** DATA-18WC.12 | **Date:** 2026-06-25

## Ownership by Entity

| Entity | Intended Owner | KV Source | Consumers | Status |
|---|---|---|---|---|
| **Match score** | Authority Cache | `goalradar:wc:authority:v1` → snapshot overlay | Hub, Fixtures, Results, Match detail | OK — results path is healthy |
| **Match status** (SCHEDULED/IN_PLAY/FINISHED/CANCELLED) | Authority Cache | `goalradar:wc:authority:v1` → `classifyMatchState()` | All WC pages | **P0**: Match 537412 has CANCELLED status but DR cache has FINISHED — both diverge |
| **Live status** (is a match live right now?) | Live SSOT | `goalradar:live:matches` | Hub, /live, match cards | OK — `getCurrentLiveMatches()` + `effectiveBucket()` prevents ghost-live |
| **Standing** (P/W/D/L/GF/GA/Pts per team) | Standings KV | `/competitions/WC/standings` | Groups, Group-A-L pages, Hub, Team pages | **BROKEN** — KV key empty/stale, static skeleton (all zeros) served |
| **Qualification status** | Qualification Engine | computed from standings | Hub badges, Groups badges, Team pages | **BROKEN** — engine inputs are all-zero standings → all return UNDECIDED |
| **Group position** (1st/2nd/3rd/4th) | Standings KV | `/competitions/WC/standings` | Qualification engine, bracket slot assignment | **BROKEN** — zero standings → wrong positions |
| **Bracket slot assignment** | Authority / WC_KNOCKOUT_SLOTS | `/competitions/WC/matches` + static slots | Bracket, Round-of-32 pages | OK for TBD slots; will populate from API when knockout data lands |
| **Upcoming fixtures** | Authority Cache | `goalradar:wc:authority:v1` filter SCHEDULED | Hub upcoming, Fixtures page | OK — authority path works |
| **Goals** | Authority Cache | `goalradar:wc:authority:v1` | Match cards, results | OK |
| **Winner / Loser** | Authority Cache | `goalradar:wc:authority:v1` | Knockout bracket | OK when status is FINISHED |
| **Team group assignment** (static editorial) | wc-all-teams.ts | none (static) | Team pages, static skeleton | **CONFLICT** — multiple teams assigned wrong group; Group A=5, G=3 |
| **Match cancellation** | Snapshot KV | `goalradar:match:{id}` → DR fallback | Results, match detail | **P0**: DR key 537412 has wrong status (FINISHED not CANCELLED) |

---

## CONFLICT Entities (Multiple Owners)

| Entity | Owner 1 | Owner 2 | Resolution |
|---|---|---|---|
| Team group assignment | `wc-all-teams.ts` (static pre-draw) | FD API standings (real draw) | **FD API is ground truth**; wc-all-teams.ts must be reconciled with real draw after authoritative data is available |
| Match status for 537412 | Authority cache (CANCELLED from FD API) | DR cache `goalradar:dr:match:537412` (FINISHED — stale) | **Purge DR key**: `GET /api/debug/purge-match-snapshot?id=537412&secret=CRON_SECRET` |

---

## Summary

- **OK**: Score, Goals, Winner/Loser, Upcoming, Live, Bracket slots
- **BROKEN**: Standing, Qualification, Group position (all three share the same root cause: standings KV empty)
- **P0**: Match 537412 status (DR cache poisoned), Cancellation display
- **CONFLICT**: Team group assignments (static vs live draw)
