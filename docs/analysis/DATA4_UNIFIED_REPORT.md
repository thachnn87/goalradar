# DATA-4 Unified Match State Authority Report
## GoalRadar · Sprint DATA-4 (follow-up)

Generated: 2026-06-15
Audit: `DATA4_UNIFIED_AUDIT.md`

---

## Change

Introduced `getWCAuthorityMatchesCached()` — a single authoritative source for all WC match state that does not rely on per-match snapshots for basic FINISHED detection.

```
getWCAuthorityMatchesCached()
├─ getUpcomingMatchesCached('WC')   → all 104 WC fixtures (SCHEDULED/TIMED)
├─ getRecentMatchesCached('WC')     → last 30 days (includes FINISHED)
├─ merge by ID — STATE_RANK forward-only (FINISHED beats SCHEDULED/TIMED)
└─ overlayMatchStates()             → live score freshness on top
```

All pages that previously read only the SCHEDULED/TIMED upcoming feed now read the authority function. Section membership is assigned by `m.status` after merge, not by feed origin.

---

## Files changed

| File | Change |
|------|--------|
| `src/lib/api.ts` | Added `STATE_RANK` to import; added `getWCAuthorityMatchesCached()` |
| `src/app/world-cup-2026/page.tsx` | Replaced `getUpcomingMatchesCached + getRecentMatchesCached` with authority function; added stray routing (FINISHED→Results, LIVE→Live, SCHEDULED/TIMED→Today/Upcoming) |
| `src/app/world-cup-2026/fixtures/page.tsx` | Replaced `getUpcomingMatchesCached` with authority function; fixed fixture row to show `H–A / FT` for FINISHED matches and `H–A / LIVE` for IN_PLAY |
| `src/app/schedule/page.tsx` | WC competition now uses authority function instead of upcoming-only feed |
| `src/app/page.tsx` | Replaced `getUpcomingMatchesCached + getRecentMatchesCached` with authority function; DATA-3/4 section logic unchanged (now reads from authority instead of raw upcoming) |

---

## Authority layer rules (implemented)

| Status | Section | Display |
|--------|---------|---------|
| SCHEDULED / TIMED | Today (if today UTC) or Upcoming | Kickoff time only |
| IN_PLAY / PAUSED | Live | Live score |
| FINISHED | Recent Results | FT score |

All match cards (`MatchCard`) receive the authoritative `Match` object and render based on `m.status` — no card component independently infers status or score.

---

## Requirements check

| Requirement | Result |
|-------------|--------|
| No provider calls | ✅ authority function composes two existing `*Cached` functions |
| No new caches | ✅ no new `withCache` key; L1 caches of component functions are reused |
| No ISR changes | ✅ `revalidate` values untouched on all pages |
| No SEO changes | ✅ no metadata/routes/sitemap touched |
| No additional KV writes | ✅ zero new KV writes |
| No new cron jobs | ✅ existing orchestrator unchanged |

---

## Match 537327 trace after fix

```
getWCAuthorityMatchesCached():
  upcoming feed:  { id: 537327, status: 'SCHEDULED', score: null/null }
  recent feed:    { id: 537327, status: 'FINISHED',  score: 2/0       }
  merge (FINISHED=3 >= SCHEDULED=0): recent entry wins
  overlay: snapshot advances nothing (already FINISHED)
  output: { id: 537327, status: 'FINISHED', score: { fullTime: { home: 2, away: 0 } } }

All pages:
  homepage       → wcResults (FINISHED filter) → MatchCard shows "FT 2–0" ✅
  WC hub         → recentResults (FINISHED filter) → MatchCard shows "FT 2–0" ✅
  fixtures page  → fixture row shows "2 – 0 / FT"; MatchCard shows "FT 2–0" ✅
  schedule page  → MatchCard shows "FT 2–0" ✅
  results page   → getWCResultsCached (unchanged, was already correct) ✅
  match page     → getOrBuildMatchSnapshot (unchanged, was already correct) ✅
```

---

## Verification

- `tsc --noEmit`: 0 errors
- Production build: passes, all routes emitted
- Section membership: FINISHED matches no longer appear in Today/Upcoming sections
- Fixture row: shows score+FT badge for FINISHED, LIVE score for IN_PLAY, "vs" for SCHEDULED
- MatchCard: unchanged — correctly shows score when `status === 'FINISHED'`

---

## Why this is more reliable than overlay-only

| Approach | Depends on | Failure mode |
|----------|-----------|--------------|
| Overlay only | Per-match snapshot in KV | Snapshot expired (60 s TIMED TTL) or never built |
| **Authority merge** | Bulk results KV feed | Feed stale for max one 15-min cron cycle |

The bulk results feed is refreshed by the cron orchestrator on every cycle (15 min). Per-match snapshots depend on user visits or prewarm, can have short TTLs, and the state guard only works when the snapshot still exists. The authority merge gives FINISHED detection a stable, cron-maintained foundation; the overlay then handles in-flight live score freshness on top.

---

## Side note: WCTeamPageContent

During audit, `src/components/WCTeamPageContent.tsx` was found to import
`getUpcomingMatches`, `getRecentMatches`, `getWCLiveMatches`, `getStandings`
(non-Cached variants that call the provider directly). This is out of scope
for this sprint but is flagged for a future PERF/DATA sprint.
