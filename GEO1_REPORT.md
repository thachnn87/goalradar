# GEO-1 Report — Smart Country Prioritization
## GoalRadar · Sprint GEO-1

Generated: 2026-06-10

---

## Country Priority Matrix

16 countries (15 spec + Argentina as a Brazil/Mexico regional neighbour).
Source of truth: `src/lib/geo-countries.ts`.

| # | Country | Code | Tier | Destination (canonical, pre-existing) | Neighbours (boosted when detected) |
|---|---------|------|------|--------------------------------------|-----------------------------------|
| 1 | USA | US | 1 | `/world-cup-2026/watch-live/us` | CA, MX |
| 2 | UK | GB | 1 | `/world-cup-2026/watch-live/uk` | FR, DE, ES |
| 3 | Canada | CA | 1 | `/world-cup-2026/watch-live/canada` | US, MX |
| 4 | Australia | AU | 1 | `/world-cup-2026/watch-live/australia` | — |
| 5 | India | IN | 1 | `/world-cup-2026/watch-live/india` | — |
| 6 | Brazil | BR | 1 | `/world-cup-2026/tv-schedule/brazil` | AR, MX |
| 7 | Mexico | MX | 1 | `/world-cup-2026/tv-schedule/mexico` | US, CA |
| 8 | Germany | DE | 1 | `/world-cup-2026/tv-schedule/germany` | FR, ES, GB |
| 9 | France | FR | 1 | `/world-cup-2026/tv-schedule/france` | GB, DE, ES |
| 10 | Spain | ES | 1 | `/world-cup-2026/tv-schedule/spain` | FR, DE, GB |
| 11 | Vietnam | VN | 2 | `/world-cup-2026/watch-live/vietnam` | TH, SG, MY |
| 12 | Thailand | TH | 2 | `/world-cup-2026/watch-live/thailand` | VN, SG, MY |
| 13 | Singapore | SG | 2 | `/world-cup-2026/watch-live` (hub — no country page exists) | MY, TH, VN |
| 14 | Malaysia | MY | 2 | `/world-cup-2026/watch-live` (hub) | SG, TH, VN |
| 15 | Indonesia | ID | 2 | `/world-cup-2026/tv-schedule/indonesia` | SG, MY, TH |
| 16 | Argentina | AR | 2 | `/world-cup-2026/tv-schedule/argentina` | BR, MX |

---

## Geo-Ordering Logic

`orderCountries(detectedCode)` in `geo-countries.ts`:

1. **No signal / unknown country** → global tier order (rows 1–16 above).
2. **Detected country in matrix** → `[detected, …its neighbours (listed order), …remainder by tier rank]`.
3. `UK` header alias normalised to `GB`.

**Detection without breaking ISR:** match pages stay statically cached
(PERF-8). The visitor country is read client-side from `GET /api/geo`
(echoes Vercel's `x-vercel-ip-country`; `Cache-Control: private, no-store`),
cached in `sessionStorage` (one fetch per session), then the chips reorder
once after hydration. SSR order = tier order, so there is no hydration
mismatch.

**Verified outputs** (unit-executed against the real module, and live in the
browser with a simulated VN session):

| Visitor | First 6 chips | Spec example | Match |
|---------|---------------|--------------|-------|
| US | US, CA, MX, UK, AU, IN | US, CA, MX, UK, AU, IN | ✅ |
| Vietnam | VN, TH, SG, MY, US, UK | VN, TH, SG, MY, US, UK | ✅ (also verified rendered in browser) |
| Brazil | BR, AR, MX, US, UK, CA | BR, AR, MX, US, UK | ✅ |
| Unknown (JP) / none | US, UK, CA, AU, IN, BR | tier order | ✅ |

---

## Mobile Behavior

- **<768 px:** first **6** chips visible + a `+ 10 More` toggle
  (`− Less` when expanded). Verified live: 6 visible → tap → 16 visible.
- **≥768 px (md:):** all 16 chips render (they wrap inside the existing
  How-to-Watch card).
- Pure CSS visibility (`hidden md:inline-flex`) + one `useState` for the
  toggle — no resize listeners, no measurement, no CLS (SSR markup is
  deterministic tier order).

---

## SEO Impact

- **Zero new URLs.** Every chip links to a pre-existing canonical page:
  the 7 watch-live country pages, 8 tv-schedule country pages, or the
  watch-live hub (SG/MY, which have no country page).
- All 16 destinations were already in sitemap/2 — no sitemap changes.
- Geo reordering is client-side only; crawlers always see the stable
  tier-ordered SSR markup (no cloaking, no per-country HTML variants).
- Bonus fix: bare `/match/{id}` URLs previously rendered a
  "Match Details Unavailable" card because `redirect()` was thrown inside a
  `try/catch` that swallowed `NEXT_REDIRECT`. The redirect now executes —
  these URLs reach the canonical slug page again.

---

## Analytics

`country_chip_click` GA4 event (`trackCountryChipClick` in
`src/lib/analytics.ts`), fired on every chip click with:

```json
{ "country": "VN", "match_id": "537327", "page_type": "match" }
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/geo-countries.ts` | NEW — priority matrix + `orderCountries()` |
| `src/components/CountryChips.tsx` | NEW — client chips (geo reorder, 6+More mobile, analytics) |
| `src/app/api/geo/route.ts` | NEW — country header echo (`private, no-store`) |
| `src/lib/analytics.ts` | `trackCountryChipClick` |
| `src/app/match/[id]/page.tsx` | `COUNTRY_PILLS` removed → `<CountryChips matchId pageType="match" />`; redirect-swallowing bug fixed |

---

## Success Criteria

| Criterion | Result |
|-----------|--------|
| Major football markets always visible | ✅ tier-1 (US, UK, CA, AU, IN, BR…) leads the default order; first 6 on mobile are all tier-1 |
| User country appears first | ✅ verified live (VN session → VN first) |
| Mobile UI remains compact | ✅ 6 chips + More; same card, same row height |
| No additional provider calls | ✅ `/api/geo` is a header echo — no KV, no providers |
| No performance regressions | ✅ match pages remain ISR (no `headers()` in the page); geo fetch is one low-priority client request per session |
