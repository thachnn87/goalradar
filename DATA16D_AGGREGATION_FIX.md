# DATA-16D World Cup Aggregation Fix

Date: 2026-06-17
Commit: 50f72dc

---

## Root Cause

Three separate root causes combined to produce the symptom: "No results yet" on
`/world-cup-2026-results` and finished matches appearing under "Today's Matches"
on `/world-cup-2026`.

### RC-1: Date-scoped cache key with no disaster-recovery fallback

`getRecentMatchesCached('WC')` read a date-scoped KV key that rotates every day
at midnight UTC:

```
goalradar:/competitions/WC/matches?dateFrom=2026-05-18&dateTo=2026-06-17
```

- KV TTL = 1800 s — equal to the cron interval. Any cron delay creates a gap
  where the key is empty and the page falls through to "No results yet".
- `refreshEndpoint()` writes only the main KV key, never a DR key, so there is
  no disaster-recovery fallback for this date-scoped key.
- After midnight UTC the key rotates to a new date range; the new key is empty
  until the next cron run (up to 30 min gap).

### RC-2: Wrong provider method for the date-scoped key

`dispatchToProvider()` matched the date-scoped endpoint with the `allMatchesM`
regex and routed it to `getAllMatches('WC')`, which returns all 104 WC matches
(including SCHEDULED/TIMED future fixtures). The results page did not filter for
`status === 'FINISHED'`, so SCHEDULED matches filled the list — but the
`played === 0` guard counted only non-live non-finished matches, producing "No
results yet" even when the key was populated.

### RC-3: Overlay-only path unreliable for recently-finished matches

The hub's `getWCAuthorityMatchesCached()` used `getRecentMatchesCached('WC')` for
its FINISHED side of the STATE_RANK merge. When that key was empty (gaps above),
the merge had no FINISHED entries. The overlay could theoretically advance
TIMED → FINISHED via per-match snapshots, but UPCOMING snapshot TTL =
`min(6h, time-to-kickoff + 5 min)` — for a match at 22:00 UTC, the snapshot
expires at ~22:05 UTC. If no one visits the match page before expiry, the
overlay has nothing to advance from. Argentina vs Algeria appeared under
"Today's Matches" with no score as a result.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/match-classify.ts` | **New file.** Shared `classifyMatchState(match, todayUTC)` helper returning `MatchBucket = 'live' | 'finished' | 'today' | 'upcoming' | 'other'`. Eliminates duplicated inline status checks across pages. |
| `src/lib/api.ts` | `getWCAuthorityMatchesCached()` now calls `getWCResultsCached()` instead of `getRecentMatchesCached('WC')` for the FINISHED side of the merge. |
| `src/app/world-cup-2026-results/page.tsx` | Import switched to `getWCResultsCached`. FINISHED filter added: `results.filter(m => m.status === 'FINISHED' && !liveIds.has(m.id))`. |
| `src/app/world-cup-2026/page.tsx` | Uses `classifyMatchState()` to bucket matches into live / today / upcoming / finished sections. |
| `src/app/world-cup-2026-schedule/page.tsx` | Uses `classifyMatchState()` for consistent scheduling bucket logic. |
| `src/app/api/cron/orchestrator/route.ts` | `wc-finished` task TTL raised from `FIXTURES_STALE` (1800 s) to `WC_STALE` (43200 s = 12 h). |

---

## Cache Keys Involved

| Cache key | Before fix | After fix |
|-----------|-----------|-----------|
| `goalradar:/competitions/WC/matches?dateFrom=…&dateTo=…` | Read by hub + results pages | No longer read by hub or results pages |
| `goalradar:/competitions/WC/matches?status=FINISHED` | Written by orchestrator at 1800 s TTL; not read by hub/results | Written at 43200 s (12 h) TTL; read by both hub and results via `getWCResultsCached()` |

The stable key `/competitions/WC/matches?status=FINISHED` is:
- Written by `getResults('WC')` (correct provider method — returns only FINISHED matches)
- Populated by the orchestrator `wc-finished` task on every cron run
- Never subject to midnight UTC rollover
- Has a 12 h stale window so one missed cron cycle cannot empty the page

---

## Before / After Behaviour

| Scenario | Before | After |
|----------|--------|-------|
| `/world-cup-2026-results` after midnight UTC | "No results yet" (key rolled over, empty) | Results shown — stable key unaffected by date rollover |
| `/world-cup-2026-results` when cron delayed > 30 min | "No results yet" (key expired, no DR) | Results shown — 12 h TTL covers delay |
| `/world-cup-2026` hub — finished match | Shows as "Today's Matches" with no score | Shows in "Recent Results" with FT score |
| Hub status classification | Duplicated inline checks across pages | Single `classifyMatchState()` helper |

---

## Validation Evidence

Production validation performed on 2026-06-17 after commit `50f72dc` deployed.

### `/world-cup-2026-results` — Recent Results section

All four required matches confirmed present with correct scores and FT badge:

| Match | Score | Status |
|-------|-------|--------|
| Argentina vs Algeria | 3 – 0 | FT ✅ |
| Germany vs Curaçao | 7 – 1 | FT ✅ |
| France vs Senegal | 3 – 1 | FT ✅ |
| Iraq vs Norway | 1 – 4 | FT ✅ |

"No results yet" message: **absent** ✅

Stats strip present (Played / Goals / Avg Goals / Live Now): ✅

### `/world-cup-2026` — Hub page

Argentina vs Algeria: **not** in "Today's Matches" ✅

"Today's Matches" section contains only future fixtures scheduled for 2026-06-17
(Portugal vs Congo DR and others).

Argentina vs Algeria (3 – 0 FT) confirmed in Recent Results section of the hub ✅

Iraq vs Norway (1 – 4 FT) confirmed in Recent Results section of the hub ✅

---

## Constraints Respected

- vercel.json: not touched
- DATA-17: not started
- No new features introduced beyond the proven production blocker fix
- No credentials or sensitive data shared with AI systems
