# WC_OWNERSHIP_MATRIX.md — Entity Ownership
**Sprint:** DATA-18WC.12 | **Date:** 2026-06-25

| Entity | Owner | Source | KV Key | Status |
|---|---|---|---|---|
| **Match score** (home/away goals) | Authority Cache | FD API → snapshot → authority | `goalradar:wc:authority:v1` | ✅ Single owner |
| **Match status** (SCHEDULED/IN_PLAY/FINISHED/CANCELLED) | Authority Cache | FD API → snapshot → authority + DR fallback | `goalradar:wc:authority:v1` → `goalradar:match:{id}` → `goalradar:dr:match:{id}` | ⚠️ DR key 537412 diverges |
| **Live status** (is match live right now?) | Live SSOT | FD API today-matches → live:matches | `goalradar:live:matches` | ✅ Single owner |
| **Standing** (P/W/D/L/GF/GA/Pts) | Standings KV (intended) | FD API → `/competitions/WC/standings` KV | `goalradar:/competitions/WC/standings` | ❌ KV empty — static zeros served |
| **Qualification status** | Qualification Engine | Computed from standings | derived | ❌ Broken (inputs zero) |
| **Group position** (1st/2nd/3rd/4th) | Standings KV (intended) | FD API → standings | `goalradar:/competitions/WC/standings` | ❌ KV empty |
| **Bracket slot assignment** | Authority + Static slots | FD API knockout matches + WC_KNOCKOUT_SLOTS | `/competitions/WC/matches` | ✅ Single owner |
| **Upcoming fixtures** | Authority Cache | FD API SCHEDULED/TIMED → authority | `goalradar:wc:authority:v1` | ✅ Single owner |
| **Winner / Loser** | Authority Cache | FD API → snapshot → authority | `goalradar:wc:authority:v1` | ✅ Single owner |
| **Goals scored** | Authority Cache | FD API → snapshot → authority | `goalradar:wc:authority:v1` | ✅ Single owner |
| **Team group assignment** (static editorial) | `wc-all-teams.ts` | Manual editorial data | none (build-time static) | ⚠️ CONFLICT with real FIFA draw |
| **Match cancellation** | Authority Cache / Snapshot | FD API → snapshot → DR fallback | `goalradar:match:{id}` / `goalradar:dr:match:{id}` | ⚠️ DR key 537412 shows wrong status |

---

## Ownership Conflicts

| Entity | Conflict | Resolution |
|---|---|---|
| **Standing** | FD API standings (intended owner) vs Static skeleton (actual production owner due to empty KV) | Fix standings pipeline. Static skeleton is only a fallback, not an owner. |
| **Team group assignment** | `wc-all-teams.ts` (pre-draw editorial) vs FD API real draw | FD API is ground truth. `wc-all-teams.ts` must be updated from official FIFA draw data. |
| **Match 537412 status** | Authority cache (CANCELLED — correct) vs DR cache (FINISHED — stale) | Purge DR key. DR cache has no authority; primary/authority always wins. |

---

## Clean Owners (no conflict)

Authority cache owns: Score, Live status, Bracket slots, Upcoming, Goals, Winner/Loser.  
These 6 entities have a single well-functioning owner and produce correct production output.

The broken entities (Standing, Qualification, Group position) all share the same root cause: standings KV empty.
