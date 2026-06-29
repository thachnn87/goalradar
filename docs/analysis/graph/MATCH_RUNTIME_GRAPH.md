# MATCH_RUNTIME_GRAPH.md
## DATA-18WC.RUNTIME.TRUTH — Phase 0: Match Runtime Graph

---

## Full Runtime Graph

```
═══════════════════════════════════════════════════════════════════════════
 EXTERNAL LAYER
═══════════════════════════════════════════════════════════════════════════

  [football-data.org]    [api-football (failover)]    [ESPN (enrichment)]
          │                        │                         │
          └────────────────────────┘                         │
                      │                                      │
                [Orchestrator cron ~30s]                     │
                      │                                      │
═══════════════════════════════════════════════════════════════════════════
 KV LAYER (Vercel KV)
═══════════════════════════════════════════════════════════════════════════

  goalradar:live:matches          goalradar:match:{id}
  TTL: 30s                        TTL: 30s (live) / 7d (finished)
        │                                 │
        ├─────────────────────────────────┘
        │
═══════════════════════════════════════════════════════════════════════════
 SERVER RENDER LAYER (Next.js App Router, ISR revalidate=60)
═══════════════════════════════════════════════════════════════════════════

  getOrBuildMatchSnapshot(id)  ←── React.cache() deduplication
        │
    MatchSnapshot
    { match: MatchDetail,
      headToHead, standings,
      wcGroupMatches, wcAllMatches,
      generatedAt }
        │
        ├── generateMetadata()
        │     └── <head>: title, OG, Twitter
        │
        ├── <JsonLd match={match}>
        │     └── <script>: SportsEvent (score only if FINISHED)
        │
        ├── <MatchFaqJsonLd faqs={buildFaqs(match)}>
        │     └── <script>: FAQPage (score only if FINISHED)
        │
        ├── deriveMatchPageState(match) → pageState
        │
        ├── <ScoreHero match={match} centerSlot={...}>
        │     │
        │     ├── [pageState ≠ LIVE]: static score from match.score
        │     │
        │     └── [pageState = LIVE]: centerSlot → <MatchLiveZone>
        │
        └── <BelowTheFoldDeferred>  ← Suspense boundary
              ├── buildStoryReport(buildStoryContext(match))
              ├── <MatchTimeline match={match}>
              ├── <MatchSummary match={match}>
              ├── <WCGroupSectionDeferred>
              └── <HeadToHeadDeferred>

═══════════════════════════════════════════════════════════════════════════
 CLIENT RUNTIME LAYER (React hydration + polling)
═══════════════════════════════════════════════════════════════════════════

  MatchLiveZone (only when pageState = LIVE)
        │
        │  initialScore = snapshot.match.score  ← starts synced
        │  initialStatus = snapshot.match.status
        │  initialMinute = snapshot.match.minute
        │
        │  setInterval(1s) countdown
        │  → poll() every 30s
        │        │
        │        ↓
        │  GET /api/live-score/{matchId}
        │        │
        │        ├── Step 1: KV goalradar:live:matches (direct)
        │        ├── Step 2: getLiveMatches() (L1 + KV)
        │        └── Step 3: getOrBuildMatchSnapshot() (snapshot)
        │        │
        │        ↓
        │  { status, score, minute, source }
        │        │
        │        ↓
        │  React state update:
        │  setScore(data.score)
        │  setStatus(data.status)
        │  setMinute(data.minute)
        │        │
        │        ↓
        │  Re-render: new score/status/minute displayed
        │
        └── Terminal: TERMINAL_STATUSES → setPolling(false)

═══════════════════════════════════════════════════════════════════════════
 RUNTIME TRUTH (after all flows)
═══════════════════════════════════════════════════════════════════════════

  Score display:      MatchLiveZone (LIVE) / ScoreHero static (other)
  Events display:     MatchTimeline (SSR snapshot — no live update)
  Story:              buildStoryReport (SSR snapshot — no live update)
  Metadata:           generateMetadata (SSR snapshot — ISR lag)
  JSON-LD:            JsonLd (SSR snapshot — score absent for LIVE)
```

---

## Clock Nodes

```
[ISR Clock]                [Poll Clock]             [Orchestrator Clock]
revalidate = 60s           setInterval(1s)          cron ~30s
  │                        countdown = 30s            │
  │                          │                        │
  ↓                          ↓                        ↓
Server re-render         poll()                  revalidatePath()
(on next request)       /api/live-score          (forced ISR)
```

The ISR Clock and Poll Clock have NO coordination mechanism.

---

## Version Nodes

```
[snapshot.generatedAt]   ← only version signal in the system
       │
       ├── embedded in HTML as data attribute (Phase 5 — not yet)
       └── not propagated to MatchLiveZone state
```

**Current state**: No version tracking. MatchLiveZone and server render
can be on different "versions" with no way to detect or reconcile.

---

## Concurrency Model

```
Server render (SSR/ISR):
  ┌─ Single React render pass per ISR revalidation
  │  All server components share the same React.cache() context
  │  No race conditions — sequential within one render
  └─ Suspense boundaries (BelowTheFold, HeadToHead, WCGroup) may stream
     but all share the same React.cache() deduped promise

Client (MatchLiveZone):
  ┌─ One setInterval, one poll() in flight at a time
  │  poll() is gated behind countdown timer (30s minimum)
  └─ Race condition: if poll() takes >30s, next tick fires before result
     (mitigated: poll() only called when prev countdown reaches 0)
```

---

## Failure Modes

| Failure | Effect |
|---------|--------|
| KV unavailable | /api/live-score falls back to getLiveMatches() then snapshot |
| Provider API down | getOrBuildMatchSnapshot() uses last KV snapshot |
| Orchestrator cron not running | ISR 60s + polling 30s still work independently |
| MatchLiveZone network error | Silently ignored — score stays at last known value |
| ISR revalidation failure | Stale ISR page served until next successful revalidation |
