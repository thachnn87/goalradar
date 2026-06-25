# CACHE OWNERSHIP
**Phase:** DATA-18WC.RESET Phase 8  
**Date:** 2026-06-25

---

## Principle

One cache layer owns each dataset. No two caches can be the authoritative source for the same data.

---

## Cache Registry

### L1 — Authority Cache (PRIMARY SOURCE FOR WC)

| Key | Format | TTL | Owner | Readers |
|---|---|---|---|---|
| `goalradar:wc:authority:v1` | `CanonicalMatch[104]` | 30s (live), 300s (today), 900s (default) | `src/lib/authority-cache.ts` | `readAuthorityCache()`, `getWCAuthorityMatchesV2()` |
| `goalradar:dr:wc:authority:v1` | `CanonicalMatch[104]` | 7 days | `src/lib/authority-cache.ts` | `readAuthorityCache()` (DR fallback) |

**Authority:** The ONLY cache that holds the canonical WC match state. All knockout data originates here (pilot=true) or from L2 below.

**Writers:** `src/app/api/cron/orchestrator/route.ts` (cron) — NEVER pages.

---

### L2 — Provider Cache (Legacy KV)

| Key | Format | TTL | Owner | Readers |
|---|---|---|---|---|
| `/competitions/WC/matches` | `Match[104]` | 6h (TTL.WC) | `providerManager` | `getWCKnockoutMatchesCached()` (pilot=false path) |
| `/competitions/WC/matches?status=SCHEDULED,TIMED` | `Match[]` | 15min (TTL.FIXTURES) | `providerManager` | `getUpcomingMatchesCached('WC')` |
| `/competitions/WC/matches?status=FINISHED` | `Match[]` | 15min | `providerManager` | `getWCResultsCached()` |
| `/competitions/WC/standings` | `StandingTable[]` | 1h (TTL.STANDINGS) | `providerManager` | `getStandingsCached('WC')` |
| `/teams/{id}` | `TeamDetail` | 1h | `providerManager` | `getTeamCached(id)` |
| `/teams/{id}/matches?status=FINISHED&limit=10` | `Match[]` | 15min | `providerManager` | `getTeamMatchesCached(id)` |

**Authority:** Secondary source. When `AUTHORITY_CACHE_PILOT=true`, knockout data flows from L1 instead.

---

### L3 — Live Cache (30s TTL)

| Key | Format | TTL | Owner | Readers |
|---|---|---|---|---|
| `goalradar:live:matches` | `Match[]` (IN_PLAY/PAUSED) | 30s | `src/lib/live-cache.ts` | `getCurrentLiveMatches()` |
| `goalradar:dr:live:matches` | `Match[]` | 7 days | `src/lib/live-cache.ts` | DR fallback |

**Authority:** The ONLY source for live match state. Pages must use `getCurrentLiveMatches()` to determine which matches are IN_PLAY/PAUSED.

---

### L4 — Snapshot Cache (Per-match)

| Key | Format | TTL | Owner | Readers |
|---|---|---|---|---|
| `goalradar:match:{id}` | `MatchSnapshot` (EPA, lineup, score) | tier-based (30s to 7d) | `src/lib/match-snapshot.ts` | `overlayMatchStates()` |

**Authority:** Per-match detail data only. NOT used for match lists or standings.

---

### L5 — ISR (Next.js page cache)

| Route | TTL | Triggered by |
|---|---|---|
| `/world-cup-2026` | 30s | ISR |
| `/world-cup-2026/bracket` + round pages | 900s | ISR + `revalidatePath()` from orchestrator |
| `/world-cup-2026-standings` | 3600s | ISR |
| `/world-cup-2026/[group]` | 900s | ISR |

**Authority:** Page-level HTML cache. Layered on top of KV caches.

---

## Ownership Rules

1. **Knockout match data:** Owned by `goalradar:wc:authority:v1` (L1) when pilot=true, by `/competitions/WC/matches` (L2) when pilot=false. `buildKnockoutViewModel()` manages the switch.
2. **Standings:** Owned by `/competitions/WC/standings` (L2). Authority-derived fallback via `computeWCStandingsFromAuthority()` when L2 returns 403.
3. **Live state:** Owned exclusively by `goalradar:live:matches` (L3). `overlayMatchStates()` (L4 snapshot) provides match detail but NOT live state authority.
4. **No page writes to any cache directly.** Pages are read-only consumers.

---

## ISR + KV Interaction

Pages render from KV (fresh data) every ISR cycle. When the orchestrator calls `revalidatePath()`, Next.js discards the ISR cache and the next request hits KV fresh. ISR is therefore a client-side cache layered on top of the KV cache — the KV cache is always the ground truth.
