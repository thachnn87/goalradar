# GROWTH-2 Knockout SEO Pages — Audit
## GoalRadar · Sprint GROWTH-2

Audit date: 2026-06-15
Scope: /world-cup-2026/* knockout-stage URL coverage, SEO quality, sitemap, internal links

---

## URL Coverage Audit

| Spec URL | Exists? | Route file | Notes |
|----------|---------|-----------|-------|
| /world-cup-2026/round-of-32 | ✅ | `src/app/world-cup-2026/round-of-32/page.tsx` | Full page |
| /world-cup-2026/round-of-16 | ✅ | `src/app/world-cup-2026/round-of-16/page.tsx` | Full page |
| /world-cup-2026/quarter-finals | ✅ | `src/app/world-cup-2026/quarter-finals/page.tsx` | Full page |
| /world-cup-2026/semi-finals | ✅ | `src/app/world-cup-2026/semi-finals/page.tsx` | Full page |
| /world-cup-2026/third-place-playoff | ⚠️ missing | — | Canonical is `/third-place` |
| /world-cup-2026/final | ✅ | `src/app/world-cup-2026/final/page.tsx` | Full page |

**Third-place note:** The existing slug is `/world-cup-2026/third-place` (configured in
`wc-rounds.ts` as `slug: 'third-place'`). The `/third-place-playoff` variant is a common
search query that has no URL to land on.

---

## SEO Quality Per Page

All 6 round pages are thin wrappers over the shared `WCRoundPage` server component.
Each page exports `metadata = buildRoundMetadata(slug)`.

### Title quality

| Page | Generated title |
|------|----------------|
| round-of-32 | `World Cup 2026 Round of 32 — Fixtures, Results & Dates \| GoalRadar` |
| round-of-16 | `World Cup 2026 Round of 16 — Fixtures, Results & Dates \| GoalRadar` |
| quarter-finals | `World Cup 2026 Quarter-finals — Fixtures, Results & Dates \| GoalRadar` |
| semi-finals | `World Cup 2026 Semi-finals — Fixtures, Results & Dates \| GoalRadar` |
| third-place | `World Cup 2026 Third Place Play-off — Fixtures, Results & Dates \| GoalRadar` |
| final | `FIFA World Cup 2026 Final — Date, Teams & Venue \| GoalRadar` |

All titles are unique and contain the target keyword phrase. The Final title
correctly uses the "FIFA" prefix (highest search intent page).

### Descriptions

Generated dynamically by `buildRoundMetadata()`:
```
"FIFA World Cup 2026 {Round Label} ({dateRange}): fixtures, kick-off times, results
and match details. {round.blurb}"
```

Unique per round — date ranges from `getRoundDateRange()` which derives actual dates
from the bundled `WC_KNOCKOUT_SLOTS` schedule. No hardcoded dates that can drift.

### Canonical URLs

`alternates.canonical` set to `https://goalradar.org/world-cup-2026/{slug}` on all 6 pages.

### OpenGraph + Twitter

Both present via `buildRoundMetadata()`. Card type: `summary_large_image`.

---

## Structured Data Audit

Each round page renders two JSON-LD blocks via `JsonLd({ round, matches })`:

### 1. BreadcrumbList

```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "position": 1, "name": "Home", "item": "https://goalradar.org" },
    { "position": 2, "name": "World Cup 2026", "item": "https://goalradar.org/world-cup-2026" },
    { "position": 3, "name": "{round.label}", "item": "https://goalradar.org/world-cup-2026/{slug}" }
  ]
}
```

3-level breadcrumb — correct hierarchy.

### 2. SportsEvent (round)

```json
{
  "@type": "SportsEvent",
  "name": "FIFA World Cup 2026 {Round Label}",
  "sport": "Football",
  "startDate": "{iso.start}",
  "endDate": "{iso.end}",
  "url": "https://goalradar.org/world-cup-2026/{slug}",
  "location": { "@type": "Place", "name": "United States, Canada & Mexico" },
  "organizer": { "@type": "Organization", "name": "FIFA" },
  "superEvent": {
    "@type": "SportsEvent",
    "name": "FIFA World Cup 2026",
    "url": "https://goalradar.org/world-cup-2026"
  },
  "subEvent": [ ... one SportsEvent per confirmed match ... ]
}
```

`subEvent[]` populates dynamically from `getWCKnockoutMatchesCached()` (KV-only).
Before fixtures are confirmed, `subEvent` is omitted — no empty arrays in the schema.

---

## Sitemap Coverage Audit

File: `src/app/sitemap.ts` — function `wcHubSitemap()` (sitemap segment 2)

| URL | In sitemap? | Priority | changeFrequency |
|-----|-------------|----------|-----------------|
| /world-cup-2026/final | ✅ | 0.93 | hourly |
| /world-cup-2026/round-of-32 | ✅ | 0.90 | hourly |
| /world-cup-2026/round-of-16 | ✅ | 0.90 | hourly |
| /world-cup-2026/quarter-finals | ✅ | 0.90 | hourly |
| /world-cup-2026/semi-finals | ✅ | 0.90 | hourly |
| /world-cup-2026/third-place | ✅ | 0.90 | hourly |
| /world-cup-2026/third-place-playoff | ❌ not listed | — | redirect target is listed |

The Final carries priority 0.93 (highest of the six — correct, it has the highest
search volume). The other five share 0.90.

---

## Internal Link Audit

### From /world-cup-2026 (hub page)

| Link type | Round links present? |
|-----------|---------------------|
| WCBracket component | ✅ Visual bracket — renders match cards but no direct text links to round pages |
| "Full bracket →" link | ✅ Links to `/world-cup-2026/bracket`, not individual rounds |
| WCRelatedLinks footer | ❌ Links to flat-URL pages (`/world-cup-2026-bracket`) not hub round pages |
| Crawler discovery nav | ❌ Had "All Groups" + "All 48 Teams" sections but NO knockout round section |

**Gap confirmed:** The hub page had no static text links to any of the 6 round pages.
Googlebot could discover them only via the bracket SVG (non-crawlable) or the sitemap.

### Internal links within round pages (WCRoundPage)

| Link | Present? |
|------|---------|
| Breadcrumb → /world-cup-2026 | ✅ |
| Round navigation pills (all 6 rounds) | ✅ All 6 linked in `<nav aria-label="Knockout rounds">` |
| Prev/Next round links | ✅ Sequential arrow links |
| "Full bracket →" | ✅ → /world-cup-2026/bracket |
| WCRelatedLinks | ✅ 6 related links (schedule, results, standings, etc.) |

Round pages link to each other well. The gap was only in the inbound hub → round direction.

---

## Gaps Summary

| Gap | Severity | Fix |
|-----|----------|-----|
| Hub page has no text links to knockout round pages | HIGH | Add "Knockout Rounds" nav section to hub page |
| `/third-place-playoff` URL returns 404 | MEDIUM | Add redirect page to `/third-place` |
| `third-place-playoff` not in sitemap | LOW | Not needed — canonical `/third-place` already listed |
