# WC_STANDINGS_ARCHITECTURE.md — DATA-18WC.8C Audit

**Date:** 2026-06-23  
**Audit:** Complete standings sources and architecture review

## Executive Summary

All WC standings consumers converge to single entry point: getStandingsCached('WC').

- ✅ No pipeline duplication
- ✅ Single normalization layer  
- ✅ All 9 pages use same source chain
- ✅ Authority cache properly scoped (matches-only)

## Five Standings Sources

1. **Static Groups** - src/lib/wc-static-groups.ts (fallback only)
2. **Live API** - football-data.org (orchestrator only)
3. **KV Standings Feed** - goalradar:/competitions/WC/standings
4. **Authority Cache** - Matches-only (by design)
5. **Debug Endpoints** - Mirrors production logic

## All 9 Pages Converge

Every page uses: getStandingsCached('WC') → single source consistency achieved.

## Call Graph

User request → Page component → getStandingsCached('WC') → withCache L1 → readKVOnly(primary, dr) → normalize Group A to GROUP_A → return standings

## Duplication Analysis: ZERO

All paths converge. No redundant pipelines exist.

## Authority Cache: Correct Design

Matches-only scope is intentional and optimal. Standings are deterministic from API, don't need enrichment like matches do.

## Conclusion

Architecture is well-consolidated. Proposing optional v2 extension for full unification as documented in consolidation plan.
