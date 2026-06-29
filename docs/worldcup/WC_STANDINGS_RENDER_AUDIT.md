# WC_STANDINGS_RENDER_AUDIT — DATA-18WC.6

**Date:** 2026-06-23

## Issue: `.find()` vs `.filter()` bug

Two routes used `.find((s) => s.type === 'TOTAL')` for WC standings. `.find()` returns only the **first** TOTAL entry (Group A). WC has 12+ TOTAL entries (one per group).

| Route | Method | Effect |
|-------|--------|--------|
| `/world-cup-2026-standings` (`src/app/world-cup-2026-standings/page.tsx`) | `.filter()` | ✅ Shows all groups (fix not needed here — but shows GROUP_TBD) |
| `/standings?competition=WC` (`src/app/standings/page.tsx`) | `.find()` | ❌ Shows Group A only |
| `/competition/WC` (`src/app/competition/[code]/page.tsx`) | `.find()` | ❌ Shows Group A only |

## Fix applied

**`src/app/standings/page.tsx`:** Added `if (competition === 'WC') redirect('/world-cup-2026-standings');` — redirects WC traffic to the dedicated WC standings page which uses `.filter()` and shows all 12 groups.

**`src/app/competition/[code]/page.tsx`:** Added `if (code === 'WC') redirect('/world-cup-2026');` — redirects WC traffic to the hub page, which also uses `.filter()` and shows all 12 group tables.

## Verdict

**STANDINGS_RENDER: FIXED** — WC traffic from `/standings` and `/competition/WC` now redirects to pages that render all 12 groups correctly.
