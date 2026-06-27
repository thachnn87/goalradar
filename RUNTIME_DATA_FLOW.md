# RUNTIME_DATA_FLOW.md
## DATA-18WC.RUNTIME.TRUTH — Phase 0: Runtime Data Flow

---

## Overview

The match detail page has two data flows that run independently after the initial render:
one server-side (ISR) and one client-side (polling). These two flows are not synchronized.

---

## Flow A — Server-Side (ISR)

```
External Provider (football-data.org / api-football)
  │
  ↓  [orchestrator cron, every ~30s]
KV goalradar:live:matches  (TTL 30s)
KV goalradar:match:{id}    (TTL 30s live / 7d finished)
  │
  ↓  [Next.js ISR request, revalidate=60]
getOrBuildMatchSnapshot(id)  — React.cache() deduped
  │
  ↓
MatchSnapshot = {
  match: MatchDetail,      ← score, status, minute, goals, events
  headToHead: ...,
  standings: ...,
  wcGroupMatches: ...,
  wcAllMatches: ...,
  generatedAt: string
}
  │
  ├─→ generateMetadata()   → <title>, OG, Twitter cards
  ├─→ <JsonLd>             → application/ld+json SportsEvent
  ├─→ <MatchFaqJsonLd>     → FAQPage JSON-LD (score only if FINISHED)
  ├─→ <ScoreHero>          → static score block (excluded during LIVE by centerSlot ??)
  ├─→ <MatchTimeline>      → goals, bookings, substitutions
  ├─→ buildStoryReport()   → narrative sections
  ├─→ <WCGroupSection>     → group table + fixtures
  └─→ <HeadToHead>         → H2H history
```

**Clock**: Next.js ISR. Revalidate = 60s for match page.
**Version**: `snapshot.generatedAt` (ISO timestamp of last build).
**Update trigger**: Either (a) next request after 60s TTL, or (b) `POST /api/revalidate/match/{id}` from orchestrator.

---

## Flow B — Client-Side (Polling)

```
/api/live-score/{matchId}   [hit every 30s by MatchLiveZone]
  │
  Source priority (inside route handler):
  ├─1→ KV goalradar:live:matches  (direct read, bypasses L1)
  ├─2→ getLiveMatches()           (L1 fallback + provider)
  └─3→ getOrBuildMatchSnapshot()  (snapshot fallback)
  │
  ↓  [returns: { status, score, minute, source }]
  │
MatchLiveZone React state
  ├─ [status]   useState<MatchStatus>(initialStatus)
  ├─ [score]    useState<Score>(initialScore)
  └─ [minute]   useState<number | null>(initialMinute)
  │
  ↓ renders
  ├─ StatusBadge (IN_PLAY | PAUSED | FINISHED)
  ├─ score.fullTime.home/away  (the LIVE score display)
  └─ countdown indicator       (next poll in N seconds)
```

**Clock**: `setInterval(1s)` countdown in MatchLiveZone. Calls poll() when countdown reaches 0. Interval = 30s.
**Version**: None. No version tracking on client state updates.
**Update trigger**: Every 30s, unconditionally while `polling === true`.
**Terminal condition**: `TERMINAL_STATUSES.includes(data.status)` → `setPolling(false)`.

---

## Flow C — Orchestrator-Triggered ISR

```
Orchestrator cron (runs every ~30s)
  │
  ↓  [when match state changes]
POST /api/revalidate/match/{id}
  │
  ↓
revalidatePath(`/match/${id}`, 'page')
  │
  ↓  [Next.js invalidates ISR cache]
Next request to /match/{id} → fresh render from KV/provider
```

**Clock**: Orchestrator cron interval.
**Effect**: Forces ISR regeneration without waiting for the 60s TTL.

---

## The Two-Clock Problem

| Clock | Source | Interval | Controls |
|-------|--------|---------|---------|
| ISR Clock | Next.js framework | 60s baseline (can be shorter via orchestrator revalidation) | Server HTML, metadata, story, JSON-LD, events |
| Poll Clock | MatchLiveZone `setInterval` | 30s | Live score, live minute, live status (client state only) |

These two clocks are **completely independent**. There is no synchronization mechanism.

**Divergence scenario:**
```
T+0:   ISR render. Score: 0-0. Story: "Match is live."
T+30:  MatchLiveZone polls. Score: 1-0. MatchLiveZone shows 1-0.
       ISR page still at 0-0 in metadata title, server HTML context.
T+60:  ISR revalidates (if requested). New server render: score 1-0.
       OR orchestrator calls revalidate → immediate new render.
T+60:  MatchLiveZone polls again. Score still 1-0. Consistent with ISR.
```

Between T+30 and T+60: client shows 1-0 (MatchLiveZone), ISR metadata shows 0-0.

---

## /api/live-score Source Priority

The live-score API itself has a 3-source fallback:

| Step | Source | KV Key | Notes |
|------|--------|--------|-------|
| 1 | KV direct | `goalradar:live:matches` | `readKVLiveMatches()` — bypasses L1 |
| 2 | getLiveMatches() | (L1 + KV fallback) | May trigger fresh provider fetch |
| 3 | getOrBuildMatchSnapshot() | `goalradar:match:{id}` | Covers FINISHED / post-match |

The API returns one source value per response (`source: 'kv-live' | 'live' | 'snapshot'`).
A single poll can get data from any of these three sources.

---

## Data Flow for Each Field

| Field | SSR Source | Client Source | Can Diverge? |
|-------|-----------|--------------|-------------|
| `score` | `snapshot.match.score` | MatchLiveZone state (polled) | YES — during LIVE |
| `status` | `snapshot.match.status` | MatchLiveZone state (polled) | YES — during LIVE |
| `minute` | `snapshot.match.minute` | MatchLiveZone state (polled) | YES — during LIVE |
| `goals[]` | `snapshot.match.goals` | None (no client update) | NO (SSR only) |
| `bookings[]` | `snapshot.match.bookings` | None | NO (SSR only) |
| `substitutions[]` | `snapshot.match.substitutions` | None | NO (SSR only) |
| `lineups` | `snapshot.match.lineups` | None | NO (SSR only) |
| `statistics` | `snapshot.match` (computed) | None | NO (SSR only) |
| `venue` | `snapshot.match.venue` | None | NO (SSR only) |
| `referee` | `snapshot.match.referees` | None | NO (SSR only) |
| `attendance` | Not present in MatchDetail | N/A | N/A |
| `formations` | `snapshot.match.lineups` | None | NO (SSR only) |
| `storyContext` | Derived from `snapshot.match` | None | NO (SSR only) |
| `pageState` | `deriveMatchPageState(match)` | None (server-derived) | NO |
| `JSON-LD` | `snapshot.match` (FINISHED only for score) | None | NO |
| `FAQ text` | `snapshot.match` (FINISHED only for score) | None | NO |
| `<title>` | `snapshot.match.score` (snapshot-time) | None | Acceptable ISR lag |

**Three fields diverge during LIVE**: `score`, `status`, `minute`.
All three are owned by MatchLiveZone for LIVE matches (centerSlot ?? pattern).

---

## Summary

```
Server flows (ISR, 60s clock):
  snapshot → all static content (events, story, JSON-LD, metadata)
  
Client flows (polling, 30s clock):
  /api/live-score → MatchLiveZone state → score/status/minute display

Synchronization: NONE (intentional — polling is faster than ISR)

Version tracking: NONE (future: Phase 5 MatchVersion)
```
