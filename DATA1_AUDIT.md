# DATA-1 Audit — Live State Consistency
## GoalRadar · Sprint DATA-1

Generated: 2026-06-12
Reproduction case: **Mexico vs South Africa (537327)** — measured in production.

---

## Measured Divergence (production, 2026-06-12)

| Surface | Data source | Observed state for 537327 |
|---------|------------|---------------------------|
| `/match/537327-…` | per-match snapshot (`goalradar:match:537327`) | **FULL TIME, 2–0** ✅ |
| `/schedule?competition=WC` | `getUpcomingMatchesCached` → bulk KV list | listed in 2026-06-11 section, **no score, treated as upcoming** ❌ |
| `/world-cup-2026` hub | `getUpcomingMatchesCached` + `getRecentMatchesCached` | **match absent everywhere** (id 537327 occurs 0 times in HTML) ❌ |
| `/live` | `getLiveMatches` (provider, intentional) | correct (not live) ✅ |

## Source of Truth & Cache Hierarchy

```
provider (football-data / api-football)
   └── refreshed ONLY by /api/cron/orchestrator (30-min external schedule)
        ├── bulk list KV entries  goalradar:/competitions/WC/matches?…   ← schedule, hub, homepage read these via readKVOnly (PERF-7A: never self-refresh)
        ├── live cache            (30 s TTL)                              ← hub live section
        └── prewarm snapshots     goalradar:match:{id}                    ← match pages
   └── on-demand: match-page visit builds goalradar:match:{id} (provider fallback, KV-locked)
```

- **List surfaces have NO self-healing path** — by design (PERF-7A), `readKVOnly`
  never triggers refresh. They are 100 % dependent on the orchestrator.
- **Match pages self-heal** — a visit builds a fresh snapshot.
- Hence the divergence mode: snapshots fresh, lists frozen.

## Root Cause — Orchestrator cron failing on every run

Verified via the public GitHub API:

- The PERF-9 workflow **is scheduled and firing** (runs at 22:07Z, 00:01Z, …)
- Every run: `conclusion: failure`, step "Call orchestrator" fails in **1 second**
- A wrong-secret request to the endpoint takes ~16 s (measured) — so the 1-s
  failure is the workflow's fast-fail path: **the `CRON_SECRET` repository
  secret is not set** (the PERF-9 manual step was never completed)
- Therefore no bulk list / live-cache / prewarm refresh has EVER run.
  Match snapshots exist only where users visited match pages.

## State Transition Verification (SCHEDULED → LIVE → FINISHED)

| Surface | Transition mechanism | With cron running | With cron down (before fix) |
|---------|---------------------|-------------------|------------------------------|
| match page | snapshot tier TTL (live bypass, today 32 min) + on-demand rebuild | ✅ ≤ 60 s ISR | ✅ self-heals |
| schedule | bulk list refresh (15-min interval task) + ISR 300 s | ✅ ≤ ~20 min | ❌ frozen forever |
| hub | same lists + live cache + ISR 30 s | ✅ | ❌ frozen forever |
| homepage | today list + ISR 30 s | ✅ | ❌ frozen forever |
| live page | direct provider (intentional) | ✅ ≤ 30 s | ✅ |

## Fix (two layers)

1. **Operational (requires user action, again):** set the **`CRON_SECRET`**
   GitHub repository secret = the Vercel `CRON_SECRET` env value. The
   workflow is already firing every 30 min; this is the only missing piece.
2. **Code (this sprint): forward-only snapshot state overlay** —
   `overlayMatchStates()` (`src/lib/match-state-overlay.ts`): before
   rendering, list surfaces `kv.mget` the snapshots for the matches they
   display and adopt status/score when the snapshot is **ahead** in the
   state machine (SCHEDULED→LIVE→FINISHED, never backwards). Applied on
   schedule, WC hub (upcoming + live sections) and homepage (today +
   upcoming). One KV mget per ISR regeneration; zero provider calls; ISR
   values untouched. Result: **any surface converges within its ISR window
   (30–300 s) as soon as a fresh snapshot exists anywhere** — match-page
   traffic itself heals the lists, with or without the cron.

## Phase 2 — WC LIVE banner CTA

- `WCCountdownBanner` live state rendered label **"Live scores →"** but
  linked to **`/world-cup-2026`** (the hub — no live scores above the fold).
- Fixed: live-state CTA now links to **`/live`** (the live-scores
  experience; route exists, ISR 30 s, in sitemap/0). Pre-kickoff
  countdown-state CTA ("Explore →" → hub) unchanged.
- Verified in the running app (banner currently in LIVE state):
  `href="/live">Live scores` present in served HTML.
