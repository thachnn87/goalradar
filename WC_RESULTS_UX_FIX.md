# WC Results UX Fix

**Task:** WC-LIVE-SSOT-HARDENING Phase 6 (fix)
**Date:** 2026-06-22
**Status:** COMPLETE

---

## Change

**File:** `src/app/world-cup-2026-results/page.tsx:233`

```diff
- View all results →
+ Browse complete results archive →
```

---

## Why This Wording

The source page (`/world-cup-2026-results`) shows a **truncated** list labelled "Recent Results" — the 30 most recent finished matches. The CTA navigates to the **canonical archive** (`/world-cup-2026/results`) which is the dedicated results center under the WC hub, with:
- Full breadcrumb navigation (Home > World Cup 2026 > Results)
- Up to 40 finished matches (all completed games)
- Part of the WC hub page hierarchy

"Browse complete results archive →" signals:
1. **Complete** — the destination has more than the current view
2. **Archive** — it's the canonical, permanent record, not a live feed preview
3. **Browse** — it's navigating into a section, not just loading more rows

This prevents the user from feeling they're refreshing the same page.

---

**Fix: COMPLETE.**
