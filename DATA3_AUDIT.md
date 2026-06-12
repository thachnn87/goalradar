# DATA-3 Audit — Homepage Consistency
## GoalRadar · Sprint DATA-3

Generated: 2026-06-12
Production evidence captured before the fix.

---

## Measured production state (homepage)

- **537327 (Mexico vs South Africa, FT 2–0)** appeared **4 times** in the
  homepage HTML, including **inside "Upcoming World Cup Fixtures"** — with an
  **FT badge**. The DATA-2 overlay had correctly advanced its status; the
  match was simply in the wrong *section*.
- FT/LIVE badges were present on the page (7 FT / 4 LIVE markers), proving
  the overlay path executes on the homepage.

## Trace — answers to the audit questions

| Question | Answer |
|----------|--------|
| 1. Cached function used | `getUpcomingMatchesCached('WC')` for the Upcoming section; `getTodayMatchesCached` (today), `getWCLiveMatchesCached` (live), `getRecentMatchesCached('WC')` (results), `getWCKnockoutMatchesCached` (bracket preview) |
| 2. DATA-2 overlay applied? | **Yes** — all of the above are overlaid inside `api.ts` (DATA-2). The bug is NOT a bypass: status was correct (FT badge), **section membership wasn't** |
| 3. ISR interval | homepage `revalidate = 30` — not a factor |
| 4. Stale list path | the upcoming feed payload can contain finished matches for up to L1 TTL (FIXTURES 900 s per lambda instance) after the orchestrator refresh, and indefinitely between refreshes. The overlay fixes their status but they remain *in the feed* |
| 5. L1 cache path | `withCache` L1 (900 s) holds the raw list; overlay runs outside L1 (DATA-2) — again: status fresh, membership stale |

## Root cause

**Section membership followed the feed, not the (overlaid) status.**
The hub filters its sections (`utcDate > today` etc.), so DATA-2 made it
consistent. The homepage rendered `upcoming.matches.sort().slice(0, 6)`
**unfiltered** — an overlay-advanced FINISHED/LIVE match stayed in
"Upcoming". Korea Republic vs Czechia would exhibit the same during its
live window (live stray in Upcoming until the list refresh).

## Sections audit summary

| Homepage section | Source | Membership rule before | Defect |
|------------------|--------|------------------------|--------|
| Today's WC Matches | today list | excludes IN_PLAY/PAUSED | ✅ none (finished show FT — correct) |
| Live WC Matches | live cache (DATA-2-filtered) | as-is | ⚠ misses live strays present only in the stale upcoming feed |
| **Upcoming WC Fixtures** | upcoming feed | **none** | ❌ finished/live strays rendered as upcoming |
| Recent WC Results | recent feed, FINISHED filter | ✅ correct rule | ⚠ cannot show finished strays the recent feed doesn't contain yet |
| Bracket preview | knockout list | stage filter | ✅ status-agnostic display |
