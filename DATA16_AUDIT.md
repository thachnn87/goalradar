# DATA-16 Audit
## Snapshot Enrichment Reliability — Pre-Implementation Audit

Date: 2026-06-17

---

## Problem Statement

Production evidence (DATA-15C.1) showed that after the 12-hour ESPN event cache TTL expires,
snapshot rebuilds produce unenriched results for scored matches, then pin those 0-goal snapshots
for 7 days. Five root-cause observations:

| # | Observation | Root cause |
|---|-------------|------------|
| 1 | Iran 2-2 shows "goalless" | Event cache expired; unenriched snapshot pinned for 7d |
| 2 | Sweden 5-1 shows "goalless" | Same — 12h TTL too short for stable FINISHED data |
| 3 | LineupsSection shows "not available" | No roster fetch despite ESPN providing them |
| 4 | MatchStatistics shows 0-0 | Team-ID mismatch (DATA-14A fix) + regression from #1 |
| 5 | No automated repair | Once degraded, no mechanism heals without manual revalidation |

---

## Files Audited

| File | Issue |
|------|-------|
| `src/lib/espn-id-map.ts` | `ESPN_EVENT_TTL_SEC = 12 * 3600` — too short; `CachedEspnEvents` has no `lineups` field |
| `src/lib/match-snapshot.ts` | `writeKVSnapshot` has no guard against writing a downgraded snapshot |
| `src/lib/providers/espn.ts` | `getEspnMatchEvents` fetches `keyEvents` but discards the `rosters` array |
| `src/lib/types.ts` | `MatchDetail` has no `lineups` field; no `LineupPlayer`/`Lineup` types |
| `src/app/match/[id]/page.tsx` | `LineupsSection` returns static "not available" message |
| No repair endpoint | No automated detection or healing of unenriched finished matches |

---

## ESPN Roster Data (confirmed available)

From DATA14A_LINEUPS_RESEARCH.md (confirmed on ESPN events 760423, 760427):

- `rosters` top-level key present in all WC 2026 summary responses
- Each team: 11 starters + 14-15 bench players
- Fields: `jersey`, `position.abbreviation`, `formationPlace`, `subbedIn`, `subbedOut`
- No formation string or coach data available

---

## Findings

1. **Event TTL is the regression root.** FINISHED events never change. 12h TTL serves no purpose
   and causes systematic degradation. Correct TTL: 30 days (matches `ESPN_LOOKUP_TTL_SEC`).

2. **No downgrade protection.** `writeKVSnapshot` writes whatever `buildSnapshot` returns.
   If enrichment is temporarily absent (network hiccup, cold start), the unenriched result
   gets pinned for 7 days with no recourse except manual revalidation.

3. **Roster data silently discarded.** `getEspnMatchEvents` already fetches the full summary
   which includes `rosters`, but the response object discards it. All data needed for a
   lineups section is available but unused.

4. **No observability.** No endpoint to scan all WC matches and identify degraded ones.

5. **No automated repair.** No cron job to heal degraded matches proactively.
