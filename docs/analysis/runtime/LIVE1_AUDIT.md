# LIVE-1 Real-Time Match Experience Audit
## GoalRadar · Sprint LIVE-1

Generated: 2026-06-15

---

## Current refresh flow

### Match page (`/match/[id]`)

The match page has **no real-time update mechanism**. It is a pure ISR page.

```
User visits /match/537358-sweden-vs-tunisia

1. Vercel serves the ISR-generated HTML (stale up to 60s)
2. A server component revalidation fires in the background when:
   a. Next request comes in after revalidate=60s window, OR
   b. Explicit revalidatePath() is called (no code does this for match pages)
3. Score hero rendered from snapshot.match.score (server-only)
4. No client-side timer, no polling, no WebSocket, no SSE
5. User sees stale score until they manually refresh the browser
```

**`LiveRefresher` is NOT on the match page.** It exists in `src/components/LiveRefresher.tsx` and is imported only by `src/app/live/page.tsx`. The match page (`src/app/match/[id]/page.tsx`) has zero live refresh.

### Live page (`/live`)

The live page DOES have `LiveRefresher`:

```
Every 30s: router.refresh() → full server re-render → HTML diff streamed to client
```

This is a full page re-render, not a surgical score update. All server components re-execute: snapshot reads, match list fetches, etc.

---

## Current cache path

### Score data flow to the match hero

```
getOrBuildMatchSnapshot(matchId)   [React.cache() — deduped across all callers]
  │
  ├─ 1. KV snapshot read  goalradar:match:{id}
  │      │
  │      ├─ HIT (warm):  tier-aware TTL
  │      │    SCHEDULED: min(6h, kickoff+5min)
  │      │    FINISHED:  7 days
  │      │    LIVE:      never written (live write guard)
  │      │    → return snapshot (no provider)
  │      │
  │      └─ MISS (cold or live match):
  │           └─ buildSnapshot(matchId)
  │                ├─ readMatchDetailFromKV()   goalradar:/matches/{id}  60s SWR
  │                │    └─ MISS → getMatchDetail() → L1 → L2 → provider
  │                ├─ getHeadToHeadCached()     KV-only
  │                ├─ getUpcomingMatchesCached() KV-only
  │                ├─ getRecentMatchesCached()   KV-only
  │                └─ getStandingsCached()       KV-only
  │
  └─ snapshot.match.score → <ScoreHero match={match} />
       └─ rendered as static HTML
```

### Live match score specifically

For a match in IN_PLAY status:
- **`readKVSnapshot`** returns `null` — hardcoded guard: `if (isLiveStatus(raw.match.status)) return null`
- **`writeKVSnapshot`** never writes — hardcoded guard: `if (isLiveStatus(snapshot.match.status)) return`
- `buildSnapshot` falls through to `buildSnapshot()` → `readMatchDetailFromKV()` → `getMatchDetail()` → provider
- **Every page load of a live match page calls the provider** (on KV miss) or reads from the 60s `goalradar:/matches/{id}` KV key

The `goalradar:live:matches` key (30s TTL) is populated by the orchestrator but is **not used by the match page snapshot path**. The match page goes through the per-match detail endpoint, not the bulk live list.

---

## Current score latency

| Scenario | Update latency |
|----------|---------------|
| User is on match page, goal scored | **Never** — no refresh mechanism. User must manually refresh. |
| User on match page, ISR fires (next visitor) | Up to 60s ISR window + buildSnapshot time |
| User on `/live` page | Up to 30s (LiveRefresher) + full re-render time |
| User on WC hub / schedule / homepage | Up to 300s (ISR `revalidate = 300`) |

**The match page hero has infinite latency by default for a user already on the page.** The score displayed is frozen from the moment the page was first served.

---

## Provider traffic impact

### Current — match page (live match)

- **Every visit to a live match page** that misses the 60s `goalradar:/matches/{id}` KV window calls `providerManager.getMatch(id)` → one API call per unique match ID per 60s.
- With no client-side polling, this is bounded by visitor count × (1 call / 60s per match ID).
- The ISR revalidation (`revalidate = 60`) triggers the same snapshot rebuild path on background revalidations.

### Current — live page

`router.refresh()` every 30s triggers:
- `getLiveMatches()` → `fetchLiveCached()` → KV `goalradar:live:matches` (30s TTL)
  - If KV fresh (< 30s): 0 provider calls
  - If KV stale: 1 call to `/matches?status=IN_PLAY,PAUSED` per instance
- The orchestrator also calls `refreshLiveMatches()` every 15 min → writes 30s KV
- In practice: on-demand calls from page refreshes fill the gap between orchestrator runs

---

## Component inventory

### Existing — relevant to LIVE-1

| Component/function | File | Role |
|-------------------|------|------|
| `LiveRefresher` | `src/components/LiveRefresher.tsx` | 30s `router.refresh()` timer — live page only |
| `ScoreHero` | `src/app/match/[id]/page.tsx:230` | Renders score + status pill (SSR) |
| `StatusPill` | `src/app/match/[id]/page.tsx:189` | Status badge (IN_PLAY/PAUSED/FT/UPCOMING) |
| `getOrBuildMatchSnapshot` | `src/lib/match-snapshot.ts` | Primary data source for match page |
| `getLiveMatches()` | `src/lib/api.ts` | All-competition live cache read |
| `getWCLiveMatches()` | `src/lib/api.ts` | WC live cache read (filtered) |
| `fetchLiveCached()` | `src/lib/live-cache.ts` | L1→L2→provider live data hierarchy |
| `refreshLiveMatches()` | `src/lib/refresh.ts` | Orchestrator: writes `goalradar:live:matches` |

### Does not exist (LIVE-1 must create)

| Artifact | Purpose |
|----------|---------|
| `GET /api/live-score/[matchId]` | Lightweight score endpoint for client polling |
| `MatchLiveZone` | Client component: polls, updates score/status without full re-render |
| `src/lib/live-telemetry.ts` | In-process metrics store |
| `POST /api/telemetry/live` | Receives client-side poll metrics |
| `GET /api/debug/live-telemetry` | Exposes aggregated metrics |

---

## Score rendering path

```
Server side:
  snapshot.match.score.fullTime.{home,away}
    └─ <ScoreHero match={match} />
         └─ <div className="text-4xl ... tabular-nums">
               {score.fullTime.home ?? 0}
               <span>–</span>
               {score.fullTime.away ?? 0}
            </div>

→ Static HTML, never updates without a page re-render
```

---

## Gap analysis

| Gap | Root cause |
|-----|-----------|
| Match page score never updates during a live match | No polling, no live data source, ISR only |
| Status pill frozen at initial page load | Same — static server render |
| Match page always calls provider for live matches | Snapshot write guard prevents KV caching of live state |
| `LiveRefresher` does full re-render (expensive) | `router.refresh()` → server-side full re-render, not surgical update |
| No visibility into live update reliability | No telemetry for polling latency, score change detection |

---

## Implementation plan

### Phase 1 — Lightweight API endpoint

`GET /api/live-score/[matchId]`

Source order:
1. `getLiveMatches()` → finds match in `goalradar:live:matches` (30s KV, all competitions)
2. `getOrBuildMatchSnapshot(matchId)` → KV-backed, provider only on cold start

Returns: `{ matchId, status, score, lastUpdated, source }`

Rate limit compliance: source 1 reads the existing live cache (no new provider calls). Source 2 uses the existing snapshot path (provider only as last resort). No new KV keys, no new caches.

### Phase 2 — Client-side poller

New `MatchLiveZone` client component replaces the `ScoreHero` center column when the match is IN_PLAY or PAUSED.

- Receives initial score/status from SSR (no flicker)
- Polls `/api/live-score/[matchId]` every 30s
- Updates score, status badge, half-time score in-place
- Shows "Refreshes in Xs" indicator

`ScoreHero` gets a new optional `centerSlot?: React.ReactNode` prop. When provided, it replaces the status pill + score display. Non-live matches are unaffected.

### Phase 3 — Auto-stop

When polled status is `FINISHED`, `POSTPONED`, `CANCELLED`, or `SUSPENDED`:
- `MatchLiveZone` stops the interval
- Indicator disappears
- Final score/status remains in the DOM

### Phase 4 — Telemetry

- `src/lib/live-telemetry.ts`: in-process per-match metrics
- `POST /api/telemetry/live`: receive metrics from client after each poll
- `GET /api/debug/live-telemetry`: expose aggregated metrics

Metrics tracked: `totalPolls`, `successPolls`, `scoreChanges`, `lastLatencyMs`, `avgLatencyMs`, `maxLatencyMs`, `lastPollAt`.
