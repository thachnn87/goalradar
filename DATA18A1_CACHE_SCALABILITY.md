# DATA-18A.1 Canonical Cache Scalability Review

Date: 2026-06-17
Reviewer: Architecture review — no code changes.
Verdict: Option A **GREEN** for WC 2026 scope; **YELLOW** for future-expansion scope.

---

## 1. Payload Growth Model

### Current WC 2026 state (after tournament ends)

| Category | Count | Size per match (enriched) | Size per match (unenriched) | Total |
|----------|-------|--------------------------|----------------------------|-------|
| Group stage | 72 | ~4 KB (goals + cards + subs + lineups) | ~0.5 KB | ~100–288 KB |
| Knockout stage | 32 | ~3 KB | ~0.5 KB | ~48–96 KB |
| **Total** | **104** | — | — | **~150–384 KB typical** |

KV limit: Cloudflare Workers KV — 25 MB per value. Headroom: 65–165×. **No size risk for WC 2026.**

### Payload growth over the tournament

The payload starts small (104 SCHEDULED matches, ~52 KB) and grows as ESPN
enrichment fills in events. By the Final, with all 104 matches enriched, expect
~300–400 KB. Still well within limits.

### Concern: lineups add significant bulk

Each lineup entry for 11+11 players per team × 2 teams = 44 `LineupPlayer` objects
per match. At ~200 bytes per player JSON object, that is ~8.8 KB in lineups alone per
enriched match. For 104 enriched matches: ~915 KB from lineups.

If ALL 104 matches are enriched with full lineups, the payload could reach **~1.1 MB**.
Still well under 25 MB but notable for future competitions with >104 matches.

---

## 2. Option Comparison

### Option A — Single authority object `goalradar:wc:authority:v1`

```
CanonicalMatch[]  (all 104 matches in one JSON array)
```

| Metric | Value |
|--------|-------|
| KV reads per page load | 1 |
| KV writes per refresh cycle | 1 (full rebuild) |
| Rebuild cost | Read 3 bulk feeds + 104-key mget + build all 104 → 1 write |
| Partial update (live) | Read + modify matching entries + write full array |
| Cold miss fallback | Read 3 bulk feeds + 104 mget (same as current path) |
| Failure granularity | Single key miss = all 104 matches affected |
| KV read amplification vs current | **1 vs 107** (3 bulk + 104 mget) |
| Future: 1000 matches (extended) | 1 read, payload grows linearly |

**Strength:** Minimal read amplification. One round-trip for all listing pages.

**Weakness:** A single atomic write-of-104 means any write failure leaves the
entire authority stale (not just one match). And a single key TTL controls
freshness for all 104 — no per-match freshness granularity.

### Option B — Index + per-match authority objects

```
goalradar:wc:authority:index    → string[] (104 match IDs)
goalradar:wc:authority:{id}     → CanonicalMatch (1 per match)
```

| Metric | Value |
|--------|-------|
| KV reads per page load (all 104) | 1 index + 1 mget(104 IDs) = **2 round-trips** |
| KV reads per page load (5 matches subset) | 1 index + 1 mget(5) |
| KV writes per refresh cycle | **104 + 1 index = 105 writes** |
| Rebuild cost | 105 writes vs 1 — **105× write amplification** |
| Partial update (live, 1 match changes) | 1 write (only the changed match) |
| Cold miss fallback | Per-match misses — degraded gracefully |
| Failure granularity | Per-match — 1 write failure = 1 stale match |
| Future: 1000 matches | 1001 writes per cycle — write pressure concern |

**Strength:** Granular freshness, partial updates cheap, failure blast radius = 1 match.

**Weakness:** 105 writes per cron cycle is significant KV write pressure. Cloudflare
Workers KV write limits are 1 write/key/second on the free tier, higher on paid —
but a burst of 105 writes on every cron tick is wasteful. More importantly, the
pattern adds no value for the page-read path (listing pages still need ALL 104).

### Option C — Hybrid: single bulk key + per-match event sidecar

```
goalradar:wc:authority:v1           → CanonicalMatch[] (all 104, events stripped)
goalradar:wc:authority:events:{id}  → { goals, cards, subs, lineups } per match
```

The bulk key contains score + state + teams (small, fast refresh). Event data
is read on-demand (match detail pages only).

| Metric | Value |
|--------|-------|
| KV reads per listing page | 1 (bulk key, no events) |
| KV reads per match detail page | 1 bulk key + 1 events key = 2 |
| KV writes per refresh (bulk) | 1 |
| KV writes per enrichment (events) | 1 per match (fire-and-forget, on snapshot build) |
| Bulk key payload | ~52 KB (no events, all 104 matches) |
| Failure granularity | Bulk miss = all stale; event miss = match detail events missing |

**Strength:** Listing pages are fast and small. Event data is lazy-loaded.

**Weakness:** Introduces a new data model split. Listing pages currently don't show
events (Hub, Results, Schedule, Fixtures pages only show scores), so this is
premature optimisation for a problem that doesn't exist within WC 2026 scope.

---

## 3. Write Amplification Analysis

### Current path (no authority cache)

Each WC page ISR revalidation:
- 3 KV reads (bulk feeds) + 104-key mget = ~107 KV ops
- Across 5 WC pages at different ISR intervals (30s, 300s, 300s, 900s, 3600s):
  - Worst case active window (live match): ~5 pages × 107 ops = ~535 KV ops/cycle
  - Typical (post-match day): ~5 pages × (revalidate once in interval) much less

### Option A (single authority key)

The orchestrator writes once, and ALL pages benefit:
- 1 write per cron cycle (orchestrator-driven)
- 1 read per page ISR revalidation
- Live partial update: 1 read + 1 write per 30s live tick
- Total KV ops vs current: **~10× reduction** during active windows

---

## 4. Rebuild Cost Analysis

### Option A full rebuild

Steps at S2/S3/S4:
1. `getUpcomingMatchesCached('WC')` → 1 KV read
2. `getWCResultsCached()` → 1 KV read
3. `getWCLiveMatches()` → 1 KV read
4. `kv.mget(...104 snapshot keys)` → 1 batch read
5. `buildAllCanonicalMatches()` → CPU (pure, ~10ms for 104 matches)
6. `kv.set('goalradar:wc:authority:v1', ..., ttl)` → 1 write
7. `kv.set('goalradar:dr:wc:authority:v1', ...)` → 1 write (fire-and-forget)

**Total: 6 KV operations.** No network calls to FD or ESPN.

This is cheaper than the current per-page path (107 ops per page × 5 pages).

---

## 5. ISR Impact

### Current ISR behaviour

Hub (`revalidate=30`) triggers `getWCAuthorityMatchesCached()` which does 3 reads + 104 mget.
During a live match this is ~107 KV ops every 30 seconds from the Hub page alone.
Results page (`revalidate=300`) and Schedule page (`revalidate=300`) each add another 107 ops.

### With authority cache (Option A)

Hub ISR: 1 KV read (`goalradar:wc:authority:v1`). If TTL=30s (live), the cache is
refreshed by the live refresh loop — not by ISR. ISR just reads the pre-built object.

**ISR impact reduction: >100× for KV reads during live matches.**

---

## 6. Future Expansion (beyond WC 2026)

The key `goalradar:wc:authority:v1` is WC-specific by name. If the system were
extended to serve:

| Scenario | Impact on Option A |
|----------|-------------------|
| Champions League 2026/27 (125+ matches) | New key `goalradar:ucl:authority:v1` — Option A scales, same pattern |
| Two concurrent active competitions | Two separate authority keys — no conflict |
| FIFA Club World Cup (32 teams, ~63 matches) | New key — fine |
| World Cup 2030 (all 104 matches) | Increment to `:v1` key (no schema change needed) OR use `goalradar:wc:2030:authority:v1` |

**Option A is extensible by convention.** Each competition gets its own authority key.
No refactoring of the cache strategy is needed to add competitions.

**One latent risk:** The cache strategy document does not specify the full key
convention for future competitions. Suggest: `goalradar:{competition}:authority:{version}`.

---

## 7. Failure Recovery

### Option A

| Failure | Behaviour |
|---------|-----------|
| Primary key miss (TTL expired, write failed) | `readAuthorityCache()` reads DR copy (7d TTL) |
| DR copy also missing | Cold rebuild (reads bulk feeds + 104 mget) — same as current path |
| Partial write failure (network error mid-write) | Cloudflare KV writes are atomic — key is either written or not; old value remains until replaced |
| Corrupt payload (JSON parse error) | Catch parse error, fall through to DR then cold rebuild |
| Orchestrator cron stopped | Primary TTL expires; DR serves stale data for 7 days |

**Assessment:** Option A failure recovery is robust. The 7-day DR copy provides a
longer survival window than Option B (per-match DR becomes scattered) or Option C
(two keys to recover instead of one).

---

## 8. Recommendation

**Use Option A for WC 2026.** 

The single-object approach is correct at this scale (104 matches, <400 KB typical).
The read amplification reduction (107 KV ops/page → 1 KV op/page) is the dominant
benefit and directly addresses a known operational concern from DATA-16D.

**One enhancement before DATA-18B:** 

The authority cache design should specify that listings pages strip `lineups` from
the cached object (or store lineups only in the per-match snapshot). Lineups add
~8.8 KB per enriched match and are only consumed by the match detail page, not by
any listing page. Storing them in the authority bulk key inflates the payload
without providing value to listing consumers.

**Revised payload without lineups:** ~52–180 KB (vs 150–1100 KB with lineups).

| Option | Verdict |
|--------|---------|
| Option A (current design, with lineups) | GREEN for WC 2026; YELLOW for 500+ match tournaments |
| Option A (lineups excluded from bulk) | **GREEN** for WC 2026 and future competitions up to ~2000 matches |
| Option B | Not recommended (105× write amplification, no read benefit) |
| Option C | Premature; defer until listing pages need to show events |
