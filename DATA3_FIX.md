# DATA-3 Fix — Homepage Section Membership Follows Match State
## GoalRadar · Sprint DATA-3

Generated: 2026-06-12
Audit: `DATA3_AUDIT.md`. One file changed: `src/app/page.tsx`.

---

## Fix — status-driven section routing (same authority as the Hub)

The homepage now routes every match from the (overlaid) upcoming feed by its
**snapshot-authoritative status**, exactly like the hub:

```
wcUpcomingRaw = getUpcomingMatchesCached('WC')        ← DATA-2 overlaid
├─ status SCHEDULED/TIMED → Upcoming section (sorted, top 6)
├─ status IN_PLAY/PAUSED  → merged into Live section (deduped with live cache)
└─ status FINISHED        → merged into Recent Results (deduped with recent feed, newest first)
```

| Requirement | How it's met |
|-------------|--------------|
| Same match-state authority as Hub | identical DATA-2 overlaid functions + status-based membership |
| Finished never in Upcoming | explicit `SCHEDULED/TIMED` filter |
| Live never in Upcoming | same filter |
| Live appears in Live | live strays merged into the live-cache list (deduped) |
| Finished appears in Results | finished strays merged into the recent-results list (deduped) — works even while the recent feed is stale |

## Verification

- **Before (production):** 537327 rendered inside "Upcoming World Cup
  Fixtures" (4 occurrences on the page) despite its FT badge.
- **After (local build + dev render):** Upcoming contains zero
  finished/live entries; page renders cleanly; `tsc` 0 errors; production
  build passes.
- **Post-deploy check (run after Vercel deploy):**
  1. Homepage: 537327 absent from Upcoming, present in Recent Results as FT 2–0.
  2. Cross-surface: Homepage vs Hub vs Schedule vs Results all show
     FT 2–0 for 537327; any in-play match (e.g. the next kickoff) shows
     LIVE on homepage Live section, hub, /live, and its match page.

## Constraints

- **No provider calls added** — pure post-fetch filtering of already-fetched
  arrays; the stray merges reuse existing list data.
- **No SEO regressions** — no metadata/route/sitemap changes; section
  content is more accurate.
- **No ISR regressions** — `revalidate = 30` untouched.
