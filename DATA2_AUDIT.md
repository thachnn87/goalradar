# DATA-2 Audit — Single Source of Truth
## GoalRadar · Sprint DATA-2

Generated: 2026-06-12

---

## 1. Every place that renders match status

Match status/score reaches the UI through exactly three data families:

| Family | Functions | Consumers (pages) |
|--------|-----------|-------------------|
| **Bulk list KV** | `getUpcomingMatchesCached`, `getRecentMatchesCached`, `getTodayMatchesCached`, `getWCKnockoutMatchesCached`, `getWCResultsCached` | homepage, `/schedule`, WC hub, group pages (`[group]`), fixtures, matches-today/-tomorrow, all 6 GROWTH-2A round pages, both bracket pages, both results pages, predictions pages, team pages, watch-live, `[alias]`, sitemap — **20 page files** |
| **Live cache** (30 s KV) | `getWCLiveMatchesCached`, `getLiveMatchesCached`, `getLiveMatches` | WC hub live section, watch-live, `/live` (intentional provider path) |
| **Per-match snapshot** | `getOrBuildMatchSnapshot` | `/match/[id]`, `/predict/[id]` — the only self-healing family (visits rebuild it) |

The **live banner** (`WCCountdownBanner`) renders no per-match status — its
live/countdown mode derives from wall-clock vs tournament dates. No
divergence risk (CTA fixed in DATA-1).

## 2. Cache layers involved

```
L1 in-memory (withCache, TTL 60 s–6 h)
  └─ L2 Vercel KV bulk list entries          ← refresh: orchestrator ONLY
       └─ static bundled fixtures (fallback)
goalradar:match:{id} snapshots               ← refresh: orchestrator prewarm
                                                + every match-page visit (self-healing)
live cache (30 s KV)                         ← refresh: orchestrator
```

## 3. Remaining divergence risks (after DATA-1)

| Risk | Status before DATA-2 |
|------|---------------------|
| 17 of 20 list consumers had NO overlay (only homepage/schedule/hub were patched in DATA-1) — group pages, round pages, fixtures, brackets, results, matches-today/-tomorrow, teams, watch-live all still rendered raw stale lists | ❌ |
| `getWCKnockoutMatchesCached` has a **6 h L1 TTL** — bracket/round pages could lag a transition by hours even with the cron healthy | ❌ |
| Stale-live window: live cache lists a match as IN_PLAY after it finished | ❌ |
| Per-page overlay pattern is opt-in — every future page is a new divergence risk | ❌ |
| Snapshot lists inside match pages (`wcAllMatches`/`wcGroupMatches`, built from the same bulk lists) showed stale sibling-match statuses | ❌ |

## 4. DATA-2 design — snapshot state is authoritative at the API layer

- **`mergeSnapshotState(listMatch, snapshotMatch)`** (exported from
  `match-state-overlay.ts`) — the single merge rule:
  - snapshot wins when **ahead** in the forward-only state machine
    `SCHEDULED/TIMED → IN_PLAY/PAUSED → FINISHED` (never backwards);
  - while both agree the match is live, the snapshot supplies the fresher
    score;
  - otherwise the list entry passes through unchanged.
- `overlayMatchStates(matches)` batches the rule over one `kv.mget`.
- **Applied at the exit of every `*Cached` list function** in `api.ts`
  (upcoming, recent, today, WC-knockout, WC-results, WC-live), **outside**
  `withCache` so snapshot freshness is never pinned to an L1 TTL.
  `getWCLiveMatchesCached` additionally filters out matches the snapshot says
  have FINISHED (kills the stale-live window).

**Consequences**

- All 20 consumer pages — including group pages, round pages, brackets,
  fixtures and any page added in the future — converge automatically; the
  DATA-1 per-page overlay calls were removed (no double mget).
- Match-page sibling lists (snapshot `wcAllMatches`) converge too, because
  `buildSnapshot` consumes the same overlaid functions.
- Cost: one KV `mget` (≤120 keys) per list-function call per ISR
  regeneration; zero provider calls; ISR values untouched.
- The 6 h knockout L1 TTL is now harmless for state: payload structure may
  be 6 h old, but status/score are snapshot-fresh on every call.
