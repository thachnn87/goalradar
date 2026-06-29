# Legacy WC Schedule — Audit
## GoalRadar · Bug Investigation

Audit date: 2026-06-15
Page: `/world-cup-2026-schedule`
Symptoms reported: Mexico vs Spain, United States vs France, Canada vs England, Argentina vs Italy

---

## 1. File Location

```
src/app/world-cup-2026-schedule/page.tsx
```

Standalone page component — not shared with `/world-cup-2026/fixtures` or
`/world-cup-2026/schedule`.

---

## 2. Data Source Identification

The page has a three-branch data loading strategy:

```tsx
if (isStaticMode()) {
  // Branch A — WORLD_CUP_DATA_SOURCE=static env var
  localUpcoming = getStaticGroupFixtures().slice(0, 48);   // ← src/data/worldcup/fixtures.json
} else {
  try {
    const data = await getUpcomingMatchesCached('WC');
    upcoming = data.matches.slice(0, 48);                  // ← API via KV
  } catch { /* swallowed */ }

  if (upcoming.length === 0) {
    localUpcoming = getUpcomingGroupFixtures().slice(0, 48); // ← src/lib/wc-fixtures.ts
  }
}
```

| Branch | Trigger | Data source | Correct? |
|--------|---------|-------------|---------|
| A — Static mode | `WORLD_CUP_DATA_SOURCE=static` set in env | `src/data/worldcup/fixtures.json` | ❌ FAKE |
| B — API live | API returns ≥1 upcoming SCHEDULED/TIMED match | `getUpcomingMatchesCached('WC')` → football-data.org | ✅ Real |
| C — Local fallback | API returns 0 matches or throws | `src/lib/wc-fixtures.ts` COMPACT array | ❌ FAKE |

**Both non-API branches (A and C) serve fabricated data.**

---

## 3. Root Cause

### Primary: fabricated group-stage fixture data

`src/data/worldcup/fixtures.json` and `src/lib/wc-fixtures.ts` contain an
**invented group draw** used as a placeholder before the actual FIFA draw was
known. These files have never been updated with real draw data.

**Confirmed fake fixtures (vs actual WC 2026 draw from API):**

| Fixture in static data | Problem |
|------------------------|---------|
| Mexico vs Spain — Group C (opening match) | Actual opening: Mexico vs South Africa (ID 537327) |
| United States vs France — Group A | Incorrect group assignments |
| Canada vs England — Group B | England is in a different group |
| Argentina vs Italy — Group G | **Italy did not qualify for WC 2026** |
| Sweden vs Tunisia — Group A per API (ID 537358) | Not in static data at all |

`Italy` does not appear in the actual WC 2026 participant list. The static draw
was an educated guess assembled before the real FIFA draw was announced and
never reconciled with the actual results.

The same incorrect data exists in both locations:
- `src/data/worldcup/fixtures.json` (72 GROUP_STAGE entries + 32 knockout slots)
- `src/lib/wc-fixtures.ts` — `COMPACT` array (identical group assignments)

### Secondary: fallback is triggered in production

The API branch (`getUpcomingMatchesCached('WC')`) should return real data during
the group stage. The fact that the fake data is visible on the production page
indicates **at least one of the following triggers is active in Vercel:**

**Trigger 1 — `WORLD_CUP_DATA_SOURCE=static` is set in Vercel env vars.**

`isStaticMode()` returns `process.env.WORLD_CUP_DATA_SOURCE === 'static'`.
If this environment variable was set at any point and is still present on any
Vercel deployment, every ISR render of this page skips the API entirely and
serves Branch A (fixtures.json).

**Trigger 2 — ISR cache poisoning.**

`revalidate = 3600` (1-hour ISR). If `getUpcomingMatchesCached('WC')` returned
0 results during any render (e.g., KV miss, rate-limit burst, or the env var
was briefly set), the page was frozen with fake data. Even after the trigger
clears, the ISR cache serves the poisoned HTML for up to 1 hour.

**Trigger 3 — `getUpcomingMatchesCached('WC')` returns empty post-group-stage.**

The function returns only SCHEDULED/TIMED matches. Once the group stage concludes
and knockout fixtures haven't been confirmed in the API yet (a brief window
between round completion and scheduling), the API returns 0 upcoming WC matches.
The page falls to Branch C (wc-fixtures.ts) with fake data.

---

## 4. Page Linkage

### Internal links (20 pages link to /world-cup-2026-schedule)

| Source page | Context |
|------------|---------|
| `/world-cup-2026` (hub) | WCRelatedLinks footer |
| `/world-cup-2026/bracket` | WCRelatedLinks |
| `/world-cup-2026/fixtures` | WCRelatedLinks |
| `/world-cup-2026/groups` | WCRelatedLinks |
| `/world-cup-2026/host-cities` | WCRelatedLinks |
| `/world-cup-2026/streaming-guide` | WCRelatedLinks |
| `/world-cup-2026/teams` | WCRelatedLinks |
| `/world-cup-2026/teams/[slug]` (×48) | WCRelatedLinks |
| `/world-cup-2026/tv-schedule` | WCRelatedLinks |
| `/world-cup-2026/venues` | WCRelatedLinks |
| `/world-cup-2026/venues/[venue]` (×16) | WCRelatedLinks |
| `/world-cup-2026/watch-live` | WCRelatedLinks |
| `/world-cup-2026/[group]` (×12) | WCRelatedLinks |
| `/world-cup-2026-bracket` | WCRelatedLinks |
| `/world-cup-2026-groups` | WCRelatedLinks |
| `/world-cup-2026-live-stream` | WCRelatedLinks |
| `/world-cup-2026-predictions` | WCRelatedLinks |

This page receives internal link equity from virtually every WC page on the site.

### Sitemap

Included in `wcFlatSeoSitemap()` (sitemap segment 1):

```ts
{
  url: `${BASE_URL}/world-cup-2026-schedule`,
  changeFrequency: 'hourly',
  priority: 0.93,           // ← second-highest WC page after hub (0.95)
}
```

Priority 0.93 with `changeFrequency: hourly` — Google is actively crawling this
page and has likely indexed the fake fixture content.

### Indexing intent

Yes — intentionally indexed. The page was built for the query cluster:
"world cup 2026 schedule", "2026 world cup schedule", "fifa world cup 2026 schedule".

Canonical is `https://goalradar.org/world-cup-2026-schedule` (self-referencing,
no noindex directive).

---

## 5. Comparison with `getWCAuthorityMatchesCached()`

`getWCAuthorityMatchesCached()` (introduced in DATA-4) merges upcoming +
recent feeds and applies the live-cache overlay. It returns:
- Correct team names (Mexico vs South Africa, Sweden vs Tunisia, etc.)
- Real football-data.org match IDs (537327, 537358, ...)
- Correct group assignments (A–L per actual FIFA draw)
- Correct match status (FINISHED / SCHEDULED / TIMED)

The schedule page uses `getUpcomingMatchesCached('WC')` — a subset of the
authority source (SCHEDULED/TIMED only). This is the correct API path but is
vulnerable to returning 0 results (no SCHEDULED matches = triggers fake fallback).

`getWCAuthorityMatchesCached()` merges both feeds (upcoming + recent), making
it much less likely to return 0 matches during an active tournament.

---

## 6. SEO Impact

| Dimension | Assessment |
|-----------|-----------|
| **Misinformation** | CRITICAL — Italy in WC 2026, wrong group draws, wrong opening match |
| **User trust** | HIGH — users who know the real draw will immediately distrust the site |
| **Google index** | HIGH — priority 0.93 sitemap, hourly crawl, page likely indexed with fake data |
| **Ranking damage** | MEDIUM — once Google discovers the schedule is wrong, CTR drops and bounce rate increases |
| **Link equity at risk** | HIGH — 20+ pages link here; a redirect or delete wastes this PageRank |
| **Indexed entity confusion** | HIGH — "Argentina vs Italy" creates a false match entity in Google's knowledge graph |

---

## 7. User Impact

- Any user clicking "WC 2026 Schedule" from the hub, group pages, bracket page,
  or team pages is served matches that don't exist (Italy) and wrong group draws.
- The timezone converter and FAQ are accurate — only the fixture list is wrong.
- Users comparing to the real schedule will immediately lose trust in the site.
- No broken links or crashes — the UI renders correctly, just with wrong data.

---

## 8. Recommendation

### C — Migrate page to authority data

**Do not delete. Do not redirect.**

Rationale:
1. The page has genuine SEO value: timezone converter, FAQs with schema.org
   FAQPage markup, key-dates timeline, JSON-LD ItemList, and strong internal
   link equity (20+ inbound links at priority 0.93).
2. Redirecting to `/world-cup-2026/schedule` would silently discard all of
   this — a different page with a different canonical that Googlebot hasn't
   associated with the "world cup 2026 schedule" query cluster yet.
3. The fix is a one-line data source change.

**Required changes (decision pending):**

1. Replace `getUpcomingMatchesCached('WC')` with `getWCAuthorityMatchesCached()`.
   Authority matches include both upcoming and finished — the schedule page
   currently only shows SCHEDULED matches, which is correct for a "schedule"
   view, but the authority source handles the "no upcoming matches" edge case
   better by including recent results as a signal that data is available.

   Alternative: keep `getUpcomingMatchesCached` but show a "no upcoming
   fixtures" message when empty, rather than falling back to static data.

2. **Remove both static fallback branches entirely** — Branches A and C must
   be deleted. If the API is down, show an empty-state message. Fake data is
   worse than no data.

3. Investigate and clear `WORLD_CUP_DATA_SOURCE=static` from Vercel env vars
   if set. This is likely the active trigger for the current production bug.

4. Force an ISR revalidation via Vercel dashboard after the fix deploys (or
   wait ≤1 hour for the `revalidate = 3600` TTL to expire).

### Why not A (delete)?

Deleting loses priority 0.93 sitemap entry and 20+ pages' internal link equity
to a URL that has active Google indexing. The content on the page (timezone
converter, FAQ, host cities) is accurate — only the fixture data is wrong.

### Why not B (301 redirect)?

Redirecting to `/world-cup-2026/schedule` would consolidate authority there, but
that page already has its own canonical and serves a different UI (match cards
vs. timezone-first schedule table). The redirect would also silently kill the
FAQPage JSON-LD structured data, the ItemList schema, and the timezone table —
features not present on the redirect target. PageRank passes with a 301 but the
content differentiation is lost.

---

## Affected Files

| File | Role | Action required |
|------|------|----------------|
| `src/app/world-cup-2026-schedule/page.tsx` | Page — contains bad fallback logic | Remove Branches A and C; switch data source |
| `src/data/worldcup/fixtures.json` | 72 fake group fixtures + 32 knockout slots | Update with real draw data OR remove usage |
| `src/lib/wc-fixtures.ts` | COMPACT array — same fake group assignments | Update with real draw data OR remove usage |
| Vercel env vars | `WORLD_CUP_DATA_SOURCE=static` possibly set | Check and clear in Vercel dashboard |
