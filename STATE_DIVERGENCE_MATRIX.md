# STATE DIVERGENCE MATRIX — DATA-18B.3D

**Task:** DATA-18B.3D — State Divergence Audit
**Date:** 2026-06-23
**Instrument:** `GET /api/debug/state-divergence` (new, commit `e288af2`)
**Method:** 3 production samples 02:05–02:08 UTC + per-match layer probe + `authority-drift` cross-check.

---

## What was compared

For every one of the 104 WC matches, the display state was read from the three
stores that can each independently decide live / finished / scheduled:

| # | Source | KV key | State field | TTL |
|---|--------|--------|-------------|-----|
| A | Authority cache | `goalradar:wc:authority:v1` (+ DR `goalradar:dr:wc:authority:v1`) | `CanonicalMatch.state` | 30s live / 300s today / 900s normal; DR 7d |
| B | Snapshot KV | `goalradar:match:{id}` | `snapshot.match.status` → bucket | 900s (7d for finished) |
| C | Live cache | `goalradar:live:matches` | presence + `status` IN_PLAY/PAUSED | 30s |

State buckets normalised to: `live | finished | scheduled | cancelled | missing`.

---

## Divergence patterns searched

| Pattern | Meaning | Severity |
|---------|---------|----------|
| `AUTH_LIVE__SNAP_FINISHED` | authority=live, snapshot=finished | RED (page shows LIVE after FT) |
| `AUTH_FINISHED__SNAP_LIVE` | authority=finished, snapshot=live | RED (page shows FT mid-match) |
| `AUTH_SCHEDULED__SNAP_LIVE` | authority=scheduled, snapshot=live | RED (page shows kickoff while live) |
| `AUTH_LIVE__SNAP_SCHEDULED` | authority=live, snapshot=scheduled | RED |
| `LIVECACHE_LIVE__AUTH_NOT_LIVE` | live-cache=live, authority≠live | RED (live-source split) |
| `AUTH_LIVE__LIVECACHE_NOT_LIVE` | authority=live, fresh live-cache=not-live | YELLOW (live-source split) |
| `SNAP_MISSING_FOR_ACTIVE` | live/finished match has no snapshot | YELLOW (data gap) |

---

## Result — three consistent samples

| Sample | checkedAt (UTC) | total | GREEN | YELLOW | RED | verdict |
|--------|-----------------|-------|-------|--------|-----|---------|
| 1 | 02:05:38 | 104 | 103 | 1 | **0** | YELLOW |
| 2 | 02:06:20 | 104 | 103 | 1 | **0** | YELLOW |
| 3 | 02:08:02 | 104 | 103 | 1 | **0** | YELLOW |

**Zero RED state-flip divergences in all samples.**

### State distribution (identical across A and B)

| State | Authority (A) | Snapshot (B) | Live-cache (C) |
|-------|---------------|--------------|----------------|
| live | 1 | — | 1 (sample 1) / 0 (samples 2–3, key expired) |
| finished | 42 | 42 | — |
| scheduled | 61 | 61 | — |
| missing | — | 1 (the live match) | — |
| not-live | — | — | 103–104 |

Authority `finished` count == snapshot `finished` count (42 == 42) and
authority `scheduled` == snapshot `scheduled` (61 == 61) in every sample. The
two stores **agree on the state of all 103 matches that have a snapshot.**

---

## The single divergence

| matchId | match | kickoff | A (authority) | B (snapshot) | C (live-cache) | pattern | severity |
|---------|-------|---------|---------------|--------------|----------------|---------|----------|
| 537394 | Norway vs Senegal | 2026-06-23T00:00Z | **live** | **missing** | live (s1) / not-live (s2–3, expired) | `SNAP_MISSING_FOR_ACTIVE` | YELLOW |

**This is a snapshot *coverage gap*, not a state *flip*.** The match is genuinely
live (authority and live-cache both say live in sample 1). It simply has no
snapshot yet — snapshots are built for finished matches and via prewarm; a
match that has just gone live has not yet been snapshotted. The match detail
page cold-builds the snapshot on demand (`buildSnapshotCalled: true` confirmed
by `/api/debug/match-state/537394`).

There is **no** match anywhere with `snapshot=scheduled` or `snapshot=finished`
while `authority=live`, nor the reverse. The dangerous flips the task targeted
do not exist in production data.

---

## Per-layer probe of the live match (Phase 3 corroboration)

`GET /api/debug/match-state/537394` at 02:08:11:

```json
{ "liveKVStatus": "LIVE_CACHE_EMPTY_OR_EXPIRED",
  "detailStatus": "DETAIL_KEY_MISSING",
  "snapshotStatus": "SNAPSHOT_KEY_MISSING",
  "buildSnapshotCalled": true,
  "diagnosis": "Match is not in live cache (status=LIVE_CACHE_EMPTY_OR_EXPIRED). No overlay needed." }
```

At this instant the live-cache 30s key had expired and the only store still
asserting "live" was the stale DR authority copy. See STATE_FIX_PLAN.md for why
this storage-layer gap does **not** reach users (the read path reconstructs
state).

---

## Out-of-scope finding (score, not state)

`authority-drift` flagged **1 RED score drift** (not a state divergence):

| matchId | match | authority score | snapshot score | note |
|---------|-------|-----------------|----------------|------|
| 537371 | Spain vs Saudi Arabia | 4–0 (4 goals) | 5–0 (4 goals) | snapshot internally inconsistent (5–0 but only 4 goals); snapshot 28.9h old |

Both stores agree the match is `finished` — no state divergence. The score
discrepancy is tracked separately (DATA-18F authority-drift) and noted here for
completeness. Recommend a targeted snapshot repair for 537371.

---

**Matrix verdict: GREEN for state-flip divergence (0 RED). YELLOW overall — one
snapshot coverage gap on an in-progress match.**
