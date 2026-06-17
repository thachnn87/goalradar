# DATA-18A Authority Cache Design
## `goalradar:wc:authority:v1` — Cache Strategy

Date: 2026-06-17
Status: Design only — dormant. No production activation.

---

## 1. Problem Statement

The current authority layer (`getWCAuthorityMatchesCached`) reads from 3 bulk
feed caches (SCHEDULED/TIMED, FINISHED, live) and then batch-reads up to 104
per-match snapshot keys to apply the overlay. That is:

- 3 KV reads (bulk feeds) + up to 104 KV reads (mget snapshots) = up to 107 KV
  operations on every cold page load.
- The merged result is recomputed on every ISR revalidation cycle across every
  WC page (Hub: 30s, Results: 300s, Schedule: 300s, Fixtures: 900s, Group: 3600s).
- The merge computation is duplicated — each page recomputes the same 104-match
  authority set independently.

A single canonical authority cache key eliminates both problems:
- One read serves every page — no per-page re-merge.
- The cache is written by one writer (orchestrator/refresh), not by every page's
  ISR revalidation.

---

## 2. Cache Key Design

```
goalradar:wc:authority:v1
```

| Property | Value |
|----------|-------|
| Key | `goalradar:wc:authority:v1` |
| Value type | `CanonicalMatch[]` (JSON, all 104 WC matches) |
| Max payload | ~104 matches × ~3 KB each ≈ 310 KB uncompressed |
| Version suffix | `:v1` — bump to `:v2` on schema break, not key rename |

### Why `:v1` not `:2026`

`:v1` is a schema version, not a season version. If the `CanonicalMatch` schema
changes incompatibly during the tournament, bump to `:v2` and run both keys
briefly during migration. Year-versioned keys require a code change per season
regardless; schema-versioned keys only require a bump when the shape changes.

---

## 3. TTL Design

### TTL Tiers (matching existing WC constants)

| Match state | TTL | Rationale |
|------------|-----|-----------|
| Any LIVE match in payload | 30s | Live matches must propagate within seconds |
| All FINISHED, some SCHEDULED | 300s (5 min) | Matches finishing today; fast revalidation |
| All SCHEDULED, none today | 900s (15 min) | Normal tournament day; align with FIXTURES_FRESH |
| Full tournament pre-kickoff | 1800s (30 min) | No matches today; align with FIXTURES_STALE |

### Tier Selection Rule

The cache writer inspects the merged payload before writing and sets TTL
based on the most urgent tier present:

```typescript
function selectTTL(matches: CanonicalMatch[]): number {
  const hasLive     = matches.some(m => m.state === 'live');
  const hasToday    = matches.some(m => m.state === 'finished' && matchIsToday(m));
  const hasUpcoming = matches.some(m => m.state === 'scheduled' && matchIsToday(m));

  if (hasLive)              return 30;
  if (hasToday || hasUpcoming) return 300;
  return 900;
}
```

### Static DR TTL

The disaster-recovery copy always uses 7d regardless of tier — the DR copy
is only consulted when the primary is absent, so staleness is acceptable.

---

## 4. Refresh Strategy

### Primary writer: Orchestrator cron

The same orchestrator that refreshes the bulk feeds is the sole writer
of `goalradar:wc:authority:v1`. After refreshing:

1. `getFixtures('WC')` → SCHEDULED/TIMED bulk feed
2. `getResults('WC')` → FINISHED bulk feed
3. Live cache is read (already fresh from 30s refresh loop)
4. Per-match snapshots batch-read (mget, 104 keys)
5. `buildAllCanonicalMatches()` called → `CanonicalMatch[]`
6. `kv.set('goalradar:wc:authority:v1', result, ttl)` (TTL selected per §3)
7. `kv.set('goalradar:dr:wc:authority:v1', result, 7d)` (DR copy)

### Live match refresh loop

When a live match is in progress, `refreshLiveMatches()` (30s interval) should
also invalidate and rewrite `goalradar:wc:authority:v1`. This keeps the live
minute and score current without waiting for the orchestrator cron.

The live refresh writer only needs to:
1. Read the current canonical cache (`kv.get('goalradar:wc:authority:v1')`)
2. Apply live entries on top (STATE_RANK merge — same logic as today)
3. Write back with TTL=30s

This is a partial update path — cheaper than a full rebuild.

---

## 5. Read Pattern (page side)

```typescript
async function getWCAuthorityMatches(): Promise<CanonicalMatch[]> {
  // Try primary
  const cached = await kv.get<CanonicalMatch[]>('goalradar:wc:authority:v1');
  if (cached) return cached;

  // Try DR copy
  const dr = await kv.get<CanonicalMatch[]>('goalradar:dr:wc:authority:v1');
  if (dr) return dr;

  // Cold rebuild (orchestrator not yet run, or KV unavailable)
  return buildAndCacheAuthority();
}
```

Pages never call `buildAllCanonicalMatches()` directly — they only read the
pre-built cache key. The cold-rebuild path exists for safety (first deploy,
KV outage) but should be extremely rare in steady state.

---

## 6. Invalidation Strategy

| Trigger | Action |
|---------|--------|
| Orchestrator finishes a bulk feed refresh | Full rebuild + write `:v1` |
| Live refresh loop detects score/status change | Partial update write `:v1` with TTL=30s |
| Per-match snapshot written (match page visit / prewarm) | **No action** — snapshot updates surface at next orchestrator cycle; pages can still read the old canonical until then |
| WC 2026 ends (no more live matches) | TTL naturally expires; orchestrator can stop writing |
| Schema change to `CanonicalMatch` | Write both `:v1` and `:v2` during migration; cut over pages; delete `:v1` |

### Why snapshots don't invalidate the authority cache

Snapshot writes happen per-match, per-page-visit. If each snapshot write
triggered an authority cache rebuild, that would be up to 104 concurrent
rebuilds during a full prewarm. The orchestrator-driven refresh cycle
(15–30 min) is sufficient for event data (goals/cards) because:

1. The match page (`/match/{id}`) always reads directly from the snapshot —
   it does not use the authority cache. Goals appear on the match page immediately.
2. The authority cache is used by listing pages (hub, results, schedule) which
   show scores but not per-event detail. Score comes from the FD results feed,
   not the snapshot.

---

## 7. Disaster Recovery Strategy

| Scenario | Recovery path |
|----------|--------------|
| Primary key `goalradar:wc:authority:v1` expired / missing | Read `goalradar:dr:wc:authority:v1` (7d TTL) |
| DR key also missing | Cold rebuild via `buildAndCacheAuthority()` (reads bulk feeds + snapshots) |
| KV fully unavailable | Pages return empty array; UI shows "No matches found" graceful fallback — same as today |
| Corrupt canonical payload (parse error) | Catch JSON parse, fall through to DR then cold rebuild |

The DR copy is written every time the primary is written. It uses a fixed 7d TTL
so it survives weekend KV outages without configuration changes.

---

## 8. Sizing

| Metric | Estimate |
|--------|---------|
| Matches per payload | 104 |
| Avg CanonicalMatch size (enriched, JSON) | ~3–4 KB |
| Avg CanonicalMatch size (unenriched, no events) | ~0.5 KB |
| Worst-case payload (all enriched) | ~415 KB |
| Typical payload (18 enriched, 86 unenriched) | ~110 KB |
| KV value size limit (Cloudflare Workers KV) | 25 MB |

Well within limits. No chunking required.

---

## 9. Existing Key Impact

No existing cache keys are changed or removed. The authority cache is a new
additive key. Existing keys (`goalradar:/competitions/WC/matches?status=FINISHED`,
`goalradar:live:matches`, `goalradar:match:{id}`) remain as inputs to the
authority cache builder but are not read directly by pages after S4 cutover.
