# PERF-8 Audit — Match Navigation Paths
## GoalRadar · Sprint PERF-8 · Phase 0 (pre-change audit)

Generated: 2026-06-10

---

## 1. Match Page Entry Points (every navigation path)

Match URLs are produced exclusively by `matchPath()` / `predictPath()` in
`src/lib/url.ts`. No `router.push("/match/…")` exists anywhere (the only
`router.push` in the codebase is the competition selector's query-param update).
No raw `<a href="/match/…">` anchors exist — every entry point renders through
`next/link`.

| # | Entry point | Component | Link mechanism | Pages using it |
|---|------------|-----------|----------------|----------------|
| 1 | **MatchCard** (primary — ~90 % of clicks) | `src/components/MatchCard.tsx` | `<Link>` (default prefetch) | homepage (today/live/upcoming/results sections), `/schedule`, `/live`, `/world-cup-2026` hub, fixtures, matches-today, group pages, team pages, WC round pages (GROWTH-2A), bracket R32 grid |
| 2 | Bracket preview rows | `src/app/page.tsx` `BracketPreview` | `<Link>` | homepage |
| 3 | Visual bracket cards | `src/components/WCBracket.tsx` | `<Link>` | bracket pages |
| 4 | ThirdPlaceCard / FinalCard | `src/app/world-cup-2026/bracket/page.tsx` | `<Link>` | bracket page |
| 5 | Results list rows | `src/app/world-cup-2026-results/page.tsx` | `<Link>` (2 call sites) | flat results page |
| 6 | KickoffRow (matches) | `src/app/world-cup-2026/matches-tomorrow/page.tsx` | `<Link>` | matches-tomorrow |
| 7 | KickoffRow (TV) | `src/app/world-cup-2026/tv-schedule/[country]/page.tsx` | links to TV info, **not** match pages | — (out of scope) |
| 8 | Team page recent/upcoming lists | `WCTeamPageContent`, `teams/[slug]` | `<Link>` / MatchCard | team pages |
| 9 | Alias routes (`-live-score`, `-prediction`) | `[alias]/page.tsx` | 308 server redirect | external/SEO entry |
| 10 | Predict page cross-link | `predict/[id]` ↔ `match/[id]` | `<Link>` | both |

## 2. Prefetch status (BEFORE)

- **Zero** explicit `prefetch=` props in the codebase.
- Next.js App Router default: `<Link>` prefetches **on viewport entry** in
  production. For ISR pages (`/match/[id]` has `revalidate = 60`) the default
  prefetch fetches the cached RSC payload — usually sufficient, BUT:
  - Default prefetch is skipped on slow connections / data-saver;
  - Prefetch only caches the **payload**, it does not warm the **snapshot KV**
    when the page's ISR entry has expired (a prefetch then triggers a server
    render, which DOES warm it — good — but only when Next decides to fetch).
- `prefetch={true}` upgrade: forces full prefetch including TTL-extended client
  cache, making warm navigations render from the router cache (<100 ms).

## 3. Route segment caching (BEFORE)

| Route | Mode | Notes |
|-------|------|-------|
| `/match/[id]` | ISR `revalidate = 60` | server-cached per URL; **no `loading.tsx`** — navigation shows nothing until the full RSC payload arrives → the main *perceived* delay |
| `/predict/[id]` | ISR `revalidate = 3600` | no `loading.tsx` either |
| List pages (schedule, live, WC, results) | ISR 30 s–900 s | fine |

## 4. Snapshot KV before render (BEFORE)

- `getOrBuildMatchSnapshot()` (PERF-7B): React.cache → KV snapshot (~10 ms) →
  build from KV detail → provider last-resort (KV-lock coalesced).
- Prewarm cron seeds all 104 WC snapshots every 30 min with 32-min TTLs
  (PERF-7B) → **WC match KV is effectively always warm**.
- BUT: the *first* user click after an ISR expiry still pays
  server-render + KV read (~50–150 ms TTFB) with **zero visual feedback**
  until complete. League (non-WC) matches are not cron-prewarmed: first click
  may pay a snapshot build (~30–130 ms KV path).

## 5. Bottlenecks identified

1. **No `loading.tsx` on `/match/[id]`** — the single biggest perceived-latency
   issue. Clicking shows a frozen page until the RSC payload lands.
2. **Default-only prefetch** — fine on fast desktop; skipped under data-saver /
   slow 3G heuristics, exactly where the 500 ms budget is hardest.
3. **No hover/touch intent signal used** — a hover precedes a click by
   100–300 ms (desktop), a touchstart by ~80–120 ms (mobile); nothing uses
   this window today.
4. **No client-side telemetry** — `[MATCH_LATENCY]` measures the server
   snapshot fetch, not the user-perceived click→content time.

## 6. Fix plan (Phases 1–4)

| Phase | Change | Mechanism |
|-------|--------|-----------|
| 1 | `prefetch={true}` on all match links | new `MatchLink` client component (MatchCard) + prop added to remaining `<Link>` call sites |
| 1b | `loading.tsx` for `/match/[id]` + `/predict/[id]` | instant skeleton on navigation — eliminates perceived freeze |
| 2 | hover/touch/viewport snapshot prewarm | `match-prewarm.ts` client queue (debounce, dedupe, concurrency 3) → `GET /api/prewarm/match/[id]` → **KV-only** snapshot build (provider path structurally absent) |
| 3 | top-10 viewport seeding on list pages | `SnapshotPrewarmHints` client component on schedule / live / WC hub / results — queues prewarm for the first visible IDs on idle |
| 4 | navigation telemetry | `MatchLink` stamps click time → match page beacon → `recordNavigation()` → `navigationPerf` in `/api/debug/performance` |

PERF-6/7 invariants preserved: prewarm endpoint and hints use KV-only paths;
no provider call sites added; `vercel.json` untouched.
