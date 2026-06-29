# WC_STANDINGS_CONSOLIDATION_PLAN.md — DATA-18WC.8C Design

**Date:** 2026-06-23  
**Vision:** Unified standings in authority cache v2

## Current → Target

**Current:** Standings in KV feed + static fallback; authority matches-only  
**Target:** All standings in authority v2; unified refresh point

## Why Consolidate?

- Single refresh point (one write, all read)
- Unified timestamp (matches + standings together)
- Atomic updates (never diverge)
- Easier cold builds
- Simpler fallback

## Authority Cache v2 Structure

`
{
  version: 2,
  builtAt: ISO timestamp,
  expiresAt: ISO timestamp,
  data: {
    matches: CanonicalMatch[],
    standings: StandingTable[]  // NEW
  },
  meta: {
    matchesCount, standingsCount, standingsRefresh, source
  }
}
`

## Five Code Changes Required

1. Create src/lib/standings-normalization.ts
2. Extend src/lib/authority-cache.ts types
3. Implement write path (orchestrator + cold rebuild)
4. Implement read path (fallback chain v2 → v1 → static)
5. Migrate pages to readAuthorityCacheV2()

## Normalization Standard

**Rule:** All internal group keys use "GROUP_A" format (normalized at write time, never at read)

## Fallback Rules

- Authority v2 present: use v2 standings
- v2 missing, v1 present: convert to v2 format
- Both missing, DR v2 present: use DR
- All missing: use static + trigger rebuild

**NEVER render static when live exists** (even if stale)

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| KV size increase | P2 | Both keys expire after 7 weeks |
| Page read failure | P1 | Fallback chain handles all cases |
| Orchestrator crash | P2 | Either key missing acceptable |
| ISR stale cache | P1 | Expires every 3600s, rebuilds get v2 |
| Cold rebuild loops | P2 | Limit attempts, serve DR/static |

## Success Metrics

- ✅ All pages read authority v2
- ✅ No KV standings reads (except fallback)
- ✅ No per-page normalization
- ✅ All keys "GROUP_A" format
- ✅ Static only when all caches miss
- ✅ Atomic match+standings writes

## Recommendation

YES, proceed after migration phases complete. Consolidation eliminates standing-specific logic and guarantees atomicity.
