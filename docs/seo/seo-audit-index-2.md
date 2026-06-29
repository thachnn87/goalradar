# INDEX-2 — Search Console Readiness Audit

**Date:** 2026-06-08  
**Scope:** All primary WC 2026 SEO routes  
**Auditor:** Automated static analysis of page files + sitemap.ts  

---

## Route Audit Table

| Route | Indexable | Canonical | Sitemap | Breadcrumb | FAQ Schema | Internal Links | Issues |
|---|---|---|---|---|---|---|---|
| `/` | ✅ | ✅ | Seg 0 | ⚠️ 1-level | ❌ | 12+ | Breadcrumb has only 1 item; raw `<a>` tags in footer strip |
| `/world-cup-2026` | ✅ | ✅ | Seg 2 | ✅ 2-level | ❌ | 25+ | No FAQPage schema |
| `/world-cup-2026/group-[a-l]` | ✅ | ✅ dynamic | Seg 2 | ✅ 3-level | ✅ 6 Qs | 15+ | Fallback metadata has no canonical (mitigated by `notFound()`) |
| `/world-cup-2026/teams/[slug]` | ✅ | ✅ dynamic | Seg 2 | ✅ 3-level | ✅ 4 Qs | 8+ | Empty `{}` metadata fallback on bad slug; `notFound()` fires before render |
| `/world-cup-2026-predictions` | ✅ | ✅ | Seg 1 | ✅ 3-level | ✅ 8 Qs | 10+ | Pre-tournament: `/predict/{id}` links absent (no API IDs yet) |
| `/world-cup-2026/watch-live/[country]` | ✅ | ✅ dynamic | Seg 2 | ✅ in component | ✅ in component | 12+ | JSON-LD lives in `WCWatchCountryContent`, not route file; empty `{}` fallback on bad slug |
| `/world-cup-2026/tv-schedule/[country]` | ✅ | ✅ dynamic | Seg 2 | ✅ 4-level | ✅ dynamic | 6+ | Empty `{}` fallback on bad slug |
| `/world-cup-2026-standings` | ✅ | ✅ | Seg 1 | ⚠️ 2-level | ✅ 5 Qs | 18+ | Breadcrumb skips `/world-cup-2026` hub; empty-state link uses `/world-cup-2026/groups` (shadowed by redirect) |
| `/world-cup-2026-schedule` | ✅ | ✅ | Seg 1 | ⚠️ 2-level | ✅ 6 Qs | 10+ | `ItemList` schema absent pre-tournament (API-conditional); breadcrumb skips hub |
| `/world-cup-2026-results` | ✅ | ✅ | Seg 1 | ⚠️ 2-level | ✅ 5 Qs | 9+ | WCRelatedLinks card links to `/world-cup-2026/results` which 301s back — redirect loop on self |
| `/world-cup-2026-groups` | ✅ | ✅ | Seg 1 | ⚠️ 2-level | ✅ 6 Qs | 18+ | WCRelatedLinks card links to `/world-cup-2026/groups` (separate page — correct) |
| `/world-cup-2026-bracket` | ✅ | ✅ | Seg 1 | ⚠️ 2-level | ✅ 5 Qs | 9+ | WCRelatedLinks card links to `/world-cup-2026/bracket` — correct, distinct page |

---

## Issues Detail

### CRITICAL

#### C-1 — Redirect shadows real page: `/world-cup-2026/results`

`next.config.ts` contains:
```ts
{ source: '/world-cup-2026/results', destination: '/world-cup-2026-results', permanent: true }
```
`src/app/world-cup-2026/results/page.tsx` **exists** but can never be served — Next.js redirects
take priority over file-system routes. Googlebot will 301 away from this page on every crawl.
The page's content and metadata are completely inaccessible.

**Fix:** Either remove the redirect rule (the flat-URL page `/world-cup-2026-results` is
canonical and distinct in content) or delete the hub results page if it truly is a duplicate.

---

#### C-2 — WCRelatedLinks on `/world-cup-2026-results` links to its own redirect target

`/world-cup-2026-results` → WCRelatedLinks card → `href: '/world-cup-2026/results'`  
→ 301 → `/world-cup-2026-results` (same page).

This wastes a redirect hop, passes diluted PageRank through a 301, and creates a
crawl-budget cost for no reason. The card should link to `/world-cup-2026/results`
(hub results page) only if that page is accessible, or be removed/replaced.

---

### HIGH

#### H-1 — No FAQPage schema on Homepage and WC Hub

`/` and `/world-cup-2026` are the two highest-priority pages yet neither has `FAQPage`
structured data. These pages answer implicit user questions (tournament dates, venues,
how to watch) — adding FAQ schema would unlock rich result eligibility for the most
competitive queries.

---

#### H-2 — BreadcrumbList depth: 5 flat-URL pages only go 2 levels deep

Pages using flat `/world-cup-2026-*` URLs all emit:

```json
[{ "name": "Home" }, { "name": "World Cup 2026 Standings" }]
```

Google's breadcrumb rich results require a logical hierarchy. The missing intermediate
item is the WC Hub (`/world-cup-2026`). Correct breadcrumb chain:

```
Home → World Cup 2026 → [Page Name]
```

Affected routes: `/world-cup-2026-standings`, `/world-cup-2026-schedule`,
`/world-cup-2026-results`, `/world-cup-2026-groups`, `/world-cup-2026-bracket`.

---

#### H-3 — Homepage BreadcrumbList has only 1 item

The homepage JSON-LD `BreadcrumbList` contains only `{ name: "Home", item: BASE_URL }`.
A single-item breadcrumb provides no value to Google and may be skipped by the parser.
Remove it or replace with a `WebSite`-only schema block.

---

#### H-4 — Empty `{}` metadata returned on invalid dynamic slugs

Three dynamic routes return empty metadata objects when the slug is not found:

| Route | File |
|---|---|
| `/world-cup-2026/teams/[slug]` | `teams/[slug]/page.tsx` |
| `/world-cup-2026/watch-live/[country]` | `watch-live/[country]/page.tsx` |
| `/world-cup-2026/tv-schedule/[country]` | `tv-schedule/[country]/page.tsx` |

Next.js serves the metadata response before the page component executes, so a Googlebot
soft-404 window exists where no canonical URL is declared. The fix is to return an
explicit `robots: { index: false }` in the fallback alongside the `notFound()` call.

---

### MEDIUM

#### M-1 — `robots` field absent on all 12 routes

No page sets `robots` in its `generateMetadata` output. Next.js defaults to
`index, follow` when the field is omitted, so **no pages are accidentally noindexed**.
However, explicitly setting `robots: { index: true, follow: true }` on priority pages
is best practice — it signals intent and protects against Next.js version changes in
default behaviour.

---

#### M-2 — `ItemList` schema on Schedule page is API-conditional

`/world-cup-2026-schedule` only emits the `ItemList` JSON-LD block when
`upcoming.length > 0` (live API data). During pre-tournament or API-down states,
the structured data is absent from the rendered HTML. Google crawls this page and
caches the schema-free version. Consider emitting a static `ItemList` from
`WC_ALL_FIXTURES` as a fallback (same two-layer pattern used in the prediction hub).

---

#### M-3 — watch-live JSON-LD lives in component, not route file

`/world-cup-2026/watch-live/[country]/page.tsx` emits no JSON-LD itself.
Both `FAQPage` and `BreadcrumbList` are rendered inside `WCWatchCountryContent`.
This works correctly but makes the route file misleading during audits. Not a bug —
schema is present in the rendered HTML — but consider adding a comment in the route
file pointing to the component.

---

## Orphan Pages

Pages present in the sitemap with **zero or one inbound internal links** from the
12 audited routes:

| Page | Sitemap | Inbound Links (audited routes) | Risk |
|---|---|---|---|
| `/world-cup-2026/host-cities` | Seg 2 | 0 | **Orphan** — no discovery path |
| `/world-cup-2026/matches` | Seg 2 | 0 | **Orphan** — no discovery path |
| `/world-cup-2026/matches-today` | Seg 2 | 0 | **Orphan** — no discovery path |
| `/world-cup-2026/matches-tomorrow` | Seg 2 | 0 | **Orphan** — no discovery path |
| `/world-cup-2026/winner-predictions` | Seg 2 | 1 (from `/world-cup-2026-predictions` only) | Near-orphan |
| `/world-cup-2026/golden-boot-predictions` | Seg 2 | 1 (from `/world-cup-2026-predictions` only) | Near-orphan |
| `/world-cup-2026/streaming-guide` | Seg 2 | 1 (from tv-schedule pages only) | Near-orphan |

Orphan pages are in the sitemap so Googlebot will find them, but with no PageRank flow
they will be crawled infrequently and rank poorly. Add cards to `WCRelatedLinks` on
relevant hub pages.

---

## Title Uniqueness

All 12 audited routes have unique title strings. Dynamic routes (`[group]`, `[slug]`,
`[country]`) generate titles from per-entry data — uniqueness depends on data quality
in source files (`wc-all-teams.ts`, `wc-watch-countries.ts`, `wc-tv-countries.ts`).
No duplicates detected in static pages.

## Description Uniqueness

All 12 static descriptions are unique. Same caveat applies to dynamic routes.

---

## Sitemap Coverage

| Segment | Contents | Status |
|---|---|---|
| `sitemap/0.xml` | Core static (9 URLs) | ✅ Serving |
| `sitemap/1.xml` | WC flat-URL SEO pages (8 URLs) | ✅ Serving — verified in browser |
| `sitemap/2.xml` | WC hub + groups + teams + watch-live + tv-schedule + venues (~150+ URLs) | ✅ Serving |
| `sitemap/3.xml` | Competitions + league schedule/standings (~40 URLs) | ✅ Serving |
| `sitemap/4.xml` | Match pages (dynamic, API-sourced) | ✅ Serving (empty pre-tournament) |
| `sitemap/5.xml` | Team pages (dynamic, standings-sourced) | ✅ Serving |

Note: GSC currently shows "Couldn't fetch" on `goalradar.org/sitemap.xml` — caused by
the now-reverted www redirect loop. Should resolve on next Googlebot crawl post-deploy.

---

## Priority Fix List

| Priority | Issue | Effort |
|---|---|---|
| 🔴 C-1 | Redirect shadows `/world-cup-2026/results` page | Low — remove one redirect rule |
| 🔴 C-2 | `/world-cup-2026-results` WCRelatedLinks card loops through redirect | Low — fix href |
| 🟠 H-1 | No FAQPage on Homepage + WC Hub | Medium |
| 🟠 H-2 | 2-level breadcrumbs on 5 flat-URL pages | Low — add one ListItem per page |
| 🟠 H-3 | Homepage BreadcrumbList single-item | Low — remove or fix |
| 🟠 H-4 | Empty `{}` metadata on dynamic 404 paths | Low — add robots: noindex fallback |
| 🟡 M-1 | Explicit `robots` field absent everywhere | Low — low urgency |
| 🟡 M-2 | Schedule `ItemList` absent pre-tournament | Medium |
| 🟡 M-3 | watch-live schema in component (comment only) | Trivial |
| 🔵 Orphans | host-cities, matches, matches-today, matches-tomorrow | Medium — add to WCRelatedLinks |
