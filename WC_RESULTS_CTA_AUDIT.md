# WC Results CTA Audit

**Task:** WC-RESULTS-CTA-AUDIT Phase 1
**Date:** 2026-06-22
**Status:** COMPLETE

---

## Issue

**Location:** `src/app/world-cup-2026-results/page.tsx:233`

```tsx
<Link href="/world-cup-2026/results"
  className="inline-block mt-4 text-xs text-yellow-500 hover:text-yellow-300 transition-colors">
  View all results with stats →
</Link>
```

The CTA text promises "results with stats" but the destination (`/world-cup-2026/results`) does not include a statistics section.

---

## Destination Page Audit

**Page:** `src/app/world-cup-2026/results/page.tsx`

Content on the results page:
- Results list: finished WC matches with scores
- Score display: `formatScore(m)` — home/away goals
- Status badges: FINISHED / ET / PEN
- Match links: clicking a result navigates to match detail page
- No statistics tables, no possession/shots/xG
- No player stats, no team performance data

**The word "stats" is not justified by the page content.** Statistics are available on individual match detail pages (`/match/[id]`), not on the results listing page.

---

## Rendering Context

The CTA appears in `src/app/world-cup-2026-results/page.tsx` — the main results hub page. This page shows the first N results and then links to the dedicated `/world-cup-2026/results` listing via this CTA.

The destination `/world-cup-2026/results` is the full paginated results listing — same content as the hub results section, just all matches, no stats.

---

## Fix

Change CTA text from `"View all results with stats →"` to `"View all results →"`.

This accurately describes the destination: a listing of all WC results (scores + match state). No stats claim.

---

**Phase 1: COMPLETE. CTA text is misleading — destination has no statistics section.**
