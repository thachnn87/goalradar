# RES-1 — Provider Dependency Audit

**Date:** 2026-06-08  
**Status:** Evidence-only. No code changes.  
**Trigger:** football-data.org account disabled in production.

---

## 1. External Data Dependencies

| Provider | Role | Endpoints Used | Pages Affected | Criticality |
|----------|------|----------------|----------------|-------------|
| **football-data.org** | Match data (live, fixtures, results, standings, team/match detail) | `/matches?status=IN_PLAY,PAUSED` `/competitions/{code}/matches?status=SCHEDULED,TIMED` `/competitions/{code}/matches?status=FINISHED` `/competitions/{code}/standings` `/competitions/{code}/matches` (all) `/matches/{id}` `/matches/{id}/head2head` `/teams/{id}` `/teams/{id}/matches` | `/live`, `/`, `/world-cup-2026/*`, `/world-cup-2026-*`, `/match/[id]`, `/predict/[id]`, `/teams/[slug]`, `/team/[id]`, `/competition/[code]`, `/standings`, `/schedule`, `/sitemap.ts` | **CRITICAL** — primary data source for all match content |
| **Vercel KV** (Redis) | L2 cache, live-cache L2, snapshot store, disaster-recovery keys, newsletter rate-limit, newsletter lead capture fallback, prewarm record | `goalradar:*`, `goalradar:live:*`, `goalradar:dr:*`, `goalradar:match:*`, `goalradar:prewarm:*`, `newsletter:*` | All pages (cache layer), `/api/newsletter/subscribe`, `/api/debug/*` | **HIGH** — degraded without it but not fatal; all KV calls guarded |
| **Vercel Postgres** | Newsletter subscriber storage (primary) | `newsletter_subscribers` table | `/api/newsletter/subscribe`, `/api/newsletter/confirm/*`, `/api/newsletter/admin` | **MEDIUM** — newsletter feature only; KV fallback in place |
| **Resend** | Transactional email (confirmation + welcome) | `emails.send` | `/api/newsletter/subscribe` | **LOW** — newsletter feature only; confirmation email fails silently |
| **Google Analytics 4** (Data API) | Admin dashboard metrics (7-day summary, top pages) | `https://analyticsdata.googleapis.com/v1beta/properties/{id}:runReport` | `/admin/performance` (admin-only) | **LOW** — admin only, returns `null` on failure |
| **Google OAuth2** | GA4 service account token exchange | `https://oauth2.googleapis.com/token` | `/admin/performance` (transitively) | **LOW** — admin only, returns `null` on failure |

---

## 2. Cache Layer Analysis

### football-data.org (critical path)

```
Request
  └─ L1: in-memory withCache() — sub-ms, per-process, 30 s–6 h TTL
      └─ L2: Vercel KV withKVCache() — ~10 ms, cross-instance, SWR
          ├─ FRESH  → return immediately
          ├─ STALE  → return + bg-revalidate
          └─ MISS   → fetch from API
              ├─ SUCCESS → write L2 normal (SWR TTL) + L2 disaster key (7d)
              └─ FAILURE → try L2 disaster key (7d)
                  ├─ HIT  → [API] FALLBACK — serve up to 7d old data
                  └─ MISS → [STALE] EXPIRED — throw → page error handler
```

**Live matches** (via `live-cache.ts`):
```
Request
  └─ L1: in-memory — 30 s TTL
      └─ L2: KV goalradar:live:matches — 30 s TTL
          └─ MISS → fetch /matches?status=IN_PLAY,PAUSED
              ├─ SUCCESS → write L2 (30 s) + DR key (7d)
              └─ FAILURE → try KV goalradar:dr:live:matches
                  ├─ HIT  → [API] FALLBACK — serve stale
                  └─ MISS → [STALE] EXPIRED — return [] (empty, not throw)
```

**Match snapshot** (via `match-snapshot.ts`):
```
Request
  └─ React.cache() — per-request dedup (generateMetadata + page)
      └─ KV goalradar:match:{id} — 15 min TTL
          ├─ HIT  → return snapshot
          └─ MISS → fetch 4 endpoints in parallel
              ├─ SUCCESS → write KV + return
              └─ FAILURE → throw (no DR key for snapshots)
```

### Per-endpoint cache summary

| Endpoint | L1 TTL | L2 TTL (fresh) | L2 TTL (stale) | DR key (7d) | Live fallback |
|----------|--------|----------------|----------------|-------------|---------------|
| `/matches?status=IN_PLAY,PAUSED` | 30 s | 30 s | 60 s | ✅ `goalradar:dr:live:matches` | `[]` (empty) |
| `/competitions/{code}/matches?status=SCHEDULED,TIMED` | 15 min | 15 min | 30 min | ✅ `goalradar:dr:{endpoint}` | throw |
| `/competitions/{code}/matches?status=FINISHED` | 15 min | 15 min | 30 min | ✅ | throw |
| `/competitions/{code}/standings` | 1 hr | 1 hr | 2 hr | ✅ | throw |
| `/competitions/{code}/matches` (all) | 6 hr | 6 hr | 12 hr | ✅ | throw |
| `/matches/{id}` | 1 min | 1 min | 2 min | ✅ | throw |
| `/matches/{id}/head2head` | 1 min | 1 min | 2 min | ✅ | throw |
| `/teams/{id}` | 1 hr | 1 hr | 2 hr | ✅ | throw |
| `/teams/{id}/matches` | 15 min | 15 min | 30 min | ✅ | throw |
| Match snapshot (composite) | React.cache | 15 min | — | ❌ no DR key | throw |

### Other providers (no cache layer)

| Provider | Cache | Stale Fallback | Hard Failure Behavior |
|----------|-------|----------------|----------------------|
| Vercel KV | N/A (is the cache) | All callers have `KV_ENABLED` guard — falls through to direct fetch | Graceful: callers continue without KV |
| Vercel Postgres | None | KV `newsletter:fallback:leads` set captures emails | Non-fatal: newsletter subscribe returns 200 (KV capture) |
| Resend | None | None | Non-fatal: `sendWelcomeEmail` catches silently; confirmation email failure logged but not rethrown |
| Google Analytics 4 | CDN `s-maxage=1800` on `/api/analytics/summary` | None | Returns `null` → admin page shows static fallback |
| Google OAuth2 | None | None | Returns `null` → no GA4 data |

---

## 3. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      USER REQUEST                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Next.js    │
                    │  Page/Route │
                    └──────┬──────┘
                           │
               ┌───────────▼───────────┐
               │   React.cache()        │  ← per-request dedup
               │   (match pages only)   │     generateMetadata
               └───────────┬───────────┘     + page component
                           │
               ┌───────────▼───────────┐
               │   L1: withCache()      │  ← in-memory Map
               │   cache.ts             │     per Vercel instance
               │   TTL: 30s – 6h        │     resets on cold start
               └───────────┬───────────┘
                           │ miss
               ┌───────────▼───────────┐
               │   L2: withKVCache()    │  ← Vercel KV (Redis)
               │   kv-cache.ts          │     shared cross-instance
               │   SWR: fresh + stale   │     survives cold starts
               ├───────────────────────┤
               │   FRESH → return       │
               │   STALE → return +     │
               │           bg-revalidate│
               │   MISS  → fetch API    │
               └───────────┬───────────┘
                           │ miss/stale
               ┌───────────▼───────────┐
               │   football-data.org    │  ← EXTERNAL DEPENDENCY
               │   api.football-data    │     SINGLE POINT OF FAILURE
               │   .org/v4/*            │     Free tier: 10 req/min
               └───────────┬───────────┘
                    success │       failure (403/429/5xx/timeout)
              ┌─────────────┘              │
              │ write L2 + DR key          ▼
              │                ┌───────────────────────┐
              │                │  DR key (7d TTL)       │
              │                │  goalradar:dr:{key}    │
              │                ├───────────────────────┤
              │                │  HIT  → [API] FALLBACK │
              │                │  MISS → [STALE] EXPIRED│
              │                │         → throw        │
              │                └───────────┬───────────┘
              │                            │ throw
              ▼                            ▼
    ┌─────────────────┐       ┌────────────────────────┐
    │  Serve data      │       │  Page error handler    │
    │  200 OK          │       │  try/catch or          │
    └─────────────────┘       │  Promise.allSettled     │
                              │  → graceful empty state │
                              └────────────────────────┘
```

**Live matches path** (separate `live-cache.ts`):
```
Page → L1 (30s) → KV goalradar:live:matches (30s)
     → /matches?status=IN_PLAY,PAUSED
     → DR key goalradar:dr:live:matches (7d)
     → return [] (never throws)
```

**Match snapshot path** (separate `match-snapshot.ts`):
```
Page → React.cache() → KV goalradar:match:{id} (15 min)
     → 4× parallel API fetches [detail, h2h, standings, related]
     → NO DR key → throw → page error handler
```

---

## 4. Routes Where Provider Failure → Page Failure

These are routes where **both** conditions are true:
- KV disaster-recovery key is absent OR has never been populated
- API call fails

### Gap A — Match Snapshot: no disaster-recovery key

| Route | Failure Path | Impact |
|-------|-------------|--------|
| `/match/[id]` | Snapshot miss → 4× API fail → throw → "Match temporarily unavailable" | Page renders error state |
| `/predict/[id]` | `getMatchDetailCached` fail → throw → "unavailable" render | Page renders error state |

The match page and predict page have `try/catch` so they render gracefully, but the data is gone — not served from stale. On a cold KV (first-ever request or 15 min expiry), the page content is empty until the API recovers.

### Gap B — First-ever request with no DR key seeded

All non-live endpoints use `fetchWithKV` which writes a DR key on every successful fetch. But **if the API was disabled before a single successful fetch ever ran**, the DR key is empty. In that case:

| Route | KV State | Outcome |
|-------|----------|---------|
| Any page | L1 expired, L2 miss, DR empty | `[STALE] EXPIRED` → throw → page error handler |

This is the current production state — the account was disabled before the DR keys populated (or they have since expired in the 7-day window).

### Gap C — `sitemap.ts` has no error handling

```typescript
// src/app/sitemap.ts — no try/catch around API calls
const [wcMatches, ...] = await Promise.all([getWCKnockoutMatches(), ...])
```

If `getWCKnockoutMatches()` throws (DR empty + API down), the sitemap route itself throws a 500. This does not affect users directly but causes Googlebot errors and can affect SEO crawl budget.

### Gap D — `generateStaticParams` on `[alias]/page.tsx`

```typescript
export async function generateStaticParams() {
  const matches = await fetchAllWCMatches(); // no try/catch
  ...
}
```

If this throws during build, the build fails. Currently mitigated by the fact that `fetchAllWCMatches` is `React.cache()` wrapped and the error propagates — if WC matches can't be fetched at build time, all `[alias]` static params fail to generate, and those routes fall back to dynamic rendering (not a build failure per se).

### Gap E — `/competition/[code]` uses `Promise.allSettled` correctly ✅ — no gap

### Summary table

| Route | Cache Hit | Stale Fallback | Hard Failure |
|-------|-----------|----------------|--------------|
| `/live` | L1 → KV | DR key 7d ✅ | `[]` — never throws |
| `/` homepage | L1 → KV / allSettled | DR key 7d ✅ | Per-slot empty render |
| `/world-cup-2026` | L1 → KV / allSettled | DR key 7d ✅ | Per-slot empty render |
| `/world-cup-2026/bracket` | L1 → KV | DR key 7d ✅ | Graceful catch |
| `/world-cup-2026/groups` | L1 → KV | DR key 7d ✅ | Graceful catch |
| `/world-cup-2026/fixtures` | L1 → KV | DR key 7d ✅ | Graceful catch |
| `/world-cup-2026/results` | L1 → KV | DR key 7d ✅ | Graceful catch |
| `/world-cup-2026/watch-live` | L1 → KV / allSettled | DR key 7d ✅ | Per-slot empty render |
| `/world-cup-2026/matches-today` | L1 → KV / allSettled | DR key 7d ✅ | Per-slot empty render |
| `/world-cup-2026-results` | L1 → KV / allSettled | DR key 7d ✅ | Per-slot empty render |
| `/standings` | L1 → KV | DR key 7d ✅ | Graceful catch |
| `/schedule` | L1 → KV | DR key 7d ✅ | Graceful catch |
| `/teams/[slug]` | L1 → KV / allSettled | DR key 7d ✅ | Per-slot empty render |
| `/competition/[code]` | L1 → KV / allSettled | DR key 7d ✅ | Per-slot empty render |
| **`/match/[id]`** | React.cache → KV snapshot | ❌ No DR key | Empty match page |
| **`/predict/[id]`** | React.cache → KV snapshot | ❌ No DR key | Empty predict page |
| **`/sitemap.ts`** | L1 → KV | DR key 7d ✅ | ⚠️ 500 if DR empty |
| `/api/newsletter/subscribe` | KV rate-limit only | KV lead capture ✅ | Non-fatal |
| `/admin/performance` | CDN 30 min | Returns null ✅ | Empty GA4 section |

---

## 5. Remediation Plan

### Priority 1 — Immediate: restore football-data.org access

| Action | Detail |
|--------|--------|
| **Register new account** | Go to football-data.org/client/register — free tier gives 10 req/min, all endpoints used are available on free tier |
| **Update `FOOTBALL_API_KEY`** | Vercel Dashboard → Project Settings → Environment Variables → update all environments (Production, Preview, Development) |
| **Redeploy** | Push a commit or trigger manual redeploy; Vercel will pick up the new env var |
| **Verify** | `curl -si https://www.goalradar.org/api/cron/prewarm-worldcup -H "Authorization: Bearer $CRON_SECRET"` — should return `{"ok":6}` |

Once the key is live, the first successful prewarm will seed all DR keys and the site will be fully resilient for 7 days even if the API goes down again.

### Priority 2 — Code: add DR key to match snapshot

The match snapshot (`src/lib/match-snapshot.ts`) has no disaster-recovery path. On a 15-minute KV miss with the API down, the match page is empty.

**Fix:** After a successful snapshot build, write a separate `goalradar:dr:match:{id}` key (7-day TTL). On snapshot miss + API failure, read the DR key and serve the stale snapshot.

**Effort:** ~30 lines in `match-snapshot.ts`. No page changes required.

### Priority 3 — Code: add try/catch to `sitemap.ts`

The sitemap makes bare `Promise.all` calls with no error handling. An API failure returns a 500 to Googlebot.

**Fix:** Wrap all sitemap API calls in try/catch and return an empty/partial sitemap on failure.

**Effort:** ~10 lines.

### Priority 4 — Architecture: multi-provider strategy

The current architecture is single-provider for all match data. A secondary provider would make the entire site immune to any one provider outage.

| Option | Cost | Coverage |
|--------|------|----------|
| **API-Football (RapidAPI)** | Free: 100 req/day; Paid: $10/mo for 7,500 req/day | WC + all competitions |
| **SportMonks** | Free: 180 req/hour | WC + all competitions |
| **OpenLigaDB** | Free, unlimited | German Bundesliga only |
| **Static fixture JSON** | Zero cost | WC only — build-time static data |

**Recommended approach (minimal effort):**  
Export a static JSON snapshot of all 104 WC fixtures at build time (or manually). Serve from `/public/wc-fixtures.json`. Pages that show WC fixture data fall back to this static JSON when both API and KV DR keys are unavailable.

This eliminates the "first cold start with no DR key" problem entirely for WC pages, which are the primary product surface.

### Priority 5 — Operations: DR key seeding on deploy

Currently DR keys are only written on the first successful API request after a deploy. If the API is down at deploy time, DR keys are empty until the API recovers.

**Fix:** Add a "seed from static" step to the prewarm route — if the API is unavailable, write the static WC JSON into KV as a DR key. This ensures DR keys are always populated regardless of API status.

### Priority 6 — Monitoring: alert on `[STALE] EXPIRED`

`[STALE] EXPIRED` in production logs means a user received empty data (no cache, no DR key, no API). This should trigger an alert.

**Fix:** In Vercel log drains or an external log aggregator (e.g. Axiom, Datadog), create an alert rule for the string `[STALE] EXPIRED` in production. Fire to Slack/email when count > 0 in a 5-minute window.

---

## Dependency map (single-page summary)

```
goalradar.org
├── Match data ──────────────── football-data.org       ← DISABLED
│   ├── Cache: L1 (in-memory) + L2 (Vercel KV)
│   ├── Fallback: DR key (7d) ← works once seeded
│   └── Gaps: match snapshot has no DR key
│
├── Cache store ─────────────── Vercel KV               ← healthy
│   ├── Guarded everywhere (KV_ENABLED check)
│   └── Degrades gracefully to direct fetch
│
├── Newsletter storage ──────── Vercel Postgres          ← unknown
│   └── Fallback: KV lead capture set
│
├── Email delivery ──────────── Resend                   ← unknown
│   └── Welcome email: non-fatal on failure
│   └── Confirmation email: fire-and-forget
│
└── Analytics ───────────────── Google Analytics 4       ← admin only
    └── Returns null on failure; admin page has static fallback
```
