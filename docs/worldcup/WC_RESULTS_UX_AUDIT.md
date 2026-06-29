# WC Results UX Audit

**Task:** WC-LIVE-SSOT-HARDENING Phase 6
**Date:** 2026-06-22
**Status:** COMPLETE

---

## Pages Under Review

| Page | URL | File |
|------|-----|------|
| Source | `/world-cup-2026-results` | `src/app/world-cup-2026-results/page.tsx` |
| Destination | `/world-cup-2026/results` | `src/app/world-cup-2026/results/page.tsx` |

---

## Page Content Comparison

| Feature | `/world-cup-2026-results` | `/world-cup-2026/results` |
|---------|--------------------------|--------------------------|
| Purpose | SEO landing page ("world cup 2026 results") | Canonical results center |
| H1 | "World Cup 2026 Results" | "World Cup 2026 Results" |
| Stats strip | ✅ Played / Goals / Avg Goals / Live Now | ✅ Played / Goals / Avg Goals / Live Now |
| Live section | ✅ Pulsing red, live match rows | ✅ Pulsing red, live match rows |
| Results section heading | "Recent Results" | "Results" |
| Results limit | `finishedResults.slice(0, 30)` — 30 matches | `finished.slice(0, 40)` — up to 40 matches |
| Breadcrumb | "World Cup 2026 Results" (top level) | "Home > World Cup 2026 > Results" |
| WCPageNav | ✅ | ✅ |
| WCRelatedLinks | ✅ | ❌ |
| FAQ | ✅ (5 questions) | ❌ |
| Data source | `getWCAuthorityMatches()` (cold rebuild) | `getWCAuthorityMatchesV2()` (authority cache) |

---

## UX Diagnosis

### Problem: navigation is not perceived

A user on `/world-cup-2026-results` sees:
- Stats strip (Played/Goals)
- "Recent Results" section with 30 match rows
- CTA: "View all results →"

After clicking, they land on `/world-cup-2026/results` and see:
- Stats strip (Played/Goals) — **identical**
- "Results" section with up to 40 match rows — **visually the same**
- WCPageNav — **also present on the source page**

**Net perception**: nothing meaningful changed. The user may feel they're looking at the same page.

### Root cause

The CTA text "View all results →" says "all" but:
1. The source page shows 30 of N results
2. The destination shows 40 of N results
3. Both pages have the same layout, same stats strip
4. Both have WCPageNav

The extra 10 results (30→40) is not a meaningful enough difference to justify navigation. The CTA must communicate something the user actually wants: the authoritative archive, not just more rows.

### What makes the destination meaningfully different

- It's the **canonical results center** under the WC hub (`/world-cup-2026/*`)
- It has breadcrumb navigation back to the WC hub
- It's the page linked from official WC hub navigation
- It has the full tournament context (breadcrumb: Home > World Cup 2026 > Results)

---

## CTA Evaluation

| Option | Rationale |
|--------|-----------|
| "View all results →" | ❌ too vague — already on a results page |
| "Browse complete results archive →" | ✅ communicates this is the complete, authoritative archive |
| "See all 104 World Cup matches →" | ⚠️ "104 matches" includes unplayed games; misleading for a results archive |
| "Open full results center →" | ✅ communicates a dedicated section, not just more rows |

**Selected: "Browse complete results archive →"** — accurately signals the destination is the complete, canonical archive, not more of the same.

---

## Fix Applied

`src/app/world-cup-2026-results/page.tsx:233`

```diff
- View all results →
+ Browse complete results archive →
```

---

**Phase 6: COMPLETE. UX divergence documented. CTA updated.**
