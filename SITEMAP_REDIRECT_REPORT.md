# Sitemap Redirect Report — SITEMAP-3 Phase 1
## GoalRadar · Sprint SITEMAP-3

Generated: 2026-06-10

---

## Summary

One URL was removed from the sitemap because it returns a 301 redirect.
Sitemap entries must resolve to 200 status — Google Search Console flags
redirect URLs as sitemap errors.

---

## Redirect Found

| URL | HTTP Status | Redirects To | Sitemap Location | Action |
|-----|-------------|--------------|------------------|--------|
| `https://goalradar.org/world-cup-2026/results` | 301 (Permanent) | `/world-cup-2026-results` | sitemap/2 (`wcHubSitemap`) | **Removed** |

### Root Cause

`next.config.ts` contains a permanent redirect rule:

```
source:      /world-cup-2026/results
destination: /world-cup-2026-results
permanent:   true
```

The page route `src/app/world-cup-2026/results/page.tsx` exists, but the
Next.js redirect middleware intercepts every request before the page handler
runs. Googlebot receives a 301, not a 200.

The canonical destination `/world-cup-2026-results` is already listed in
`sitemap/1` (`wcFlatSeoSitemap`) at priority 0.92. No URL coverage is lost.

---

## Fix Applied

**File:** `src/app/sitemap.ts` — `wcHubSitemap()` function

Removed the `{ url: .../world-cup-2026/results, ... }` entry and replaced
it with an explanatory comment:

```typescript
// NOTE: /world-cup-2026/results is intentionally omitted — it 301-redirects
// to /world-cup-2026-results (sitemap/1).  Listing a redirect URL in the
// sitemap causes Google Search Console to flag it; the canonical destination
// is already covered in sitemap/1.
```

---

## Verification

- `/world-cup-2026-results` remains in sitemap/1 at priority 0.92 ✅
- sitemap/2 no longer contains any URL returning non-200 ✅
- No content pages modified ✅
