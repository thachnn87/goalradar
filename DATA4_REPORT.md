# DATA-4 Report — Today Section Consistency
## GoalRadar · Sprint DATA-4

Generated: 2026-06-12
Audit: `DATA4_AUDIT.md`. One file changed: `src/app/page.tsx`.

---

## Change

WC section membership on the homepage is now a single status+day pipeline
over one feed (the DATA-2-overlaid WC upcoming feed — the same authority
the hub uses):

```
wcUpcomingRaw (overlaid)
├─ FINISHED            → Recent Results   (DATA-3)
├─ IN_PLAY / PAUSED    → Live             (DATA-3)
└─ SCHEDULED / TIMED
   ├─ utcDate is today (UTC) → 📅 Today's World Cup Matches   (DATA-4)
   └─ utcDate > today        → 🗓 Upcoming World Cup Fixtures (DATA-4, top 6)
```

`getTodayMatchesCached()` (cross-competition feed) now serves only the
"Other Leagues" section — its WC role is retired.

## Requirements check

| Requirement | Result |
|-------------|--------|
| Today always shows today's WC fixtures | ✅ derived from the same feed that demonstrably contains them |
| No match in both Today and Upcoming | ✅ disjoint day predicates (`=== today` vs `> today`) over one sorted array |
| Kickoff today (UTC) → Today | ✅ `utcDate.startsWith(today)` with UTC `today` |
| Upcoming starts tomorrow | ✅ `utcDate.split('T')[0] > today` |
| Existing cached data only / no provider calls | ✅ zero new fetches — re-bucketing of the already-fetched array |
| No ISR changes | ✅ `revalidate = 30` untouched |
| No SEO changes | ✅ no metadata/routes/sitemap touched |

## Verification

- **Dev render (current fixtures):** Today grid contains only cards with
  `2026-06-12` UTC kickoffs; Upcoming starts at `2026-06-13`
  (Germany–Morocco); the "No World Cup matches today" message is gone; no
  card appears in both sections.
- `tsc --noEmit` 0 errors · production build passes.
- **Post-deploy production check:** Today's section populated with
  Canada–Bosnia / Qatar–Switzerland / Brazil–Morocco etc.; Upcoming begins
  with June 13 fixtures; no duplicates; no contradictory empty-state.
  (Executed after Vercel deploy — see final verification below.)
