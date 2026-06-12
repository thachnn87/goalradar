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
- **Post-deploy production check:** Today's section populated
  (Canada–Bosnia, today 19:00 UTC); Upcoming begins with June-13 fixtures
  (USA–Paraguay 01:00, Qatar–Switzerland 19:00, Brazil–Morocco …); no
  duplicates; the contradictory empty-state is gone.

## Production-found follow-up: prewarm snapshot state regression (fixed)

The post-deploy check exposed a deeper bug: Korea–Czechia (FINISHED 2–1)
rendered in Today as a **scoreless TIMED card**. Timeline: the match
finished at ~03:50 UTC, *after* the 03:41 list refresh; the next prewarm
cycle then **overwrote its FINISHED snapshot with a TIMED one** built from
the still-stale bulk list (the tier was computed from the stale status, so
the hot-tier reseed clobbered it). Once the snapshot itself regresses, the
forward-only DATA-2 overlay has nothing fresher to apply.

**Fix:** `STATE_RANK` exported from `match-state-overlay.ts`; `seedMatch`
in `prewarm/worldcup.ts` now refuses to overwrite a snapshot whose match
status is ahead of the incoming list status (`[Prewarm] STATE-GUARD` log).
The snapshot layer is now forward-only **end to end** — readers (overlay)
and writers (prewarm) both respect SCHEDULED → LIVE → FINISHED. The
regressed 537328 snapshot self-heals on its next match-page visit and can
no longer be clobbered.
