# WC_FULL_COMPETITION_AUDIT — DATA-18WC.6

**Date:** 2026-06-23

## Issue: "Full competition →" link produces no additional content

`src/app/standings/page.tsx` line 76-79: the "Full competition →" link renders as `<a href="/competition/WC">`. Pre-fix, this landed on `/competition/WC` which used `.find()` and showed only Group A — identical to the standings page (no additional content visible to users).

Post-fix: `/competition/WC` now redirects to `/world-cup-2026`, the full hub page with:
- All 12 group tables (`.filter()`)
- Today's matches
- Upcoming fixtures (once authority cache is rebuilt with all 104 matches)
- Recent results
- WC bracket (LAST_32 + LAST_16 + QF + SF + FINAL)

## Canonical metadata

`competition/[code]/page.tsx` already had `canonical = '/world-cup-2026'` for WC (`normCode === 'WC'`). The redirect aligns navigation with the declared canonical.

## Verdict

**FULL_COMPETITION: FIXED** — `/competition/WC` redirects to `/world-cup-2026` which provides significantly more WC content than the generic competition page.
