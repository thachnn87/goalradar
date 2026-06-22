# WC Results CTA Fix

**Task:** WC-RESULTS-CTA-AUDIT Phase 2
**Date:** 2026-06-22
**Status:** COMPLETE

---

## Change Made

**File:** `src/app/world-cup-2026-results/page.tsx:233`

```diff
- View all results with stats →
+ View all results →
```

**Before:**
```tsx
<Link href="/world-cup-2026/results"
  className="inline-block mt-4 text-xs text-yellow-500 hover:text-yellow-300 transition-colors">
  View all results with stats →
</Link>
```

**After:**
```tsx
<Link href="/world-cup-2026/results"
  className="inline-block mt-4 text-xs text-yellow-500 hover:text-yellow-300 transition-colors">
  View all results →
</Link>
```

---

## Rationale

The destination page `/world-cup-2026/results` shows:
- Match scores (home/away goals)
- Match status (FINISHED / ET / PEN)
- Links to individual match pages

It does **not** show statistics. The word "stats" creates an expectation that is not met — users clicking the CTA expecting tables of possession, shots, xG, or team rankings will find only scores.

The new text "View all results →" accurately describes the destination.

---

**Phase 2: COMPLETE. CTA text updated to match destination functionality.**
