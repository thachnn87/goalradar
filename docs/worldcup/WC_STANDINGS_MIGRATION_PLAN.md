# WC_STANDINGS_MIGRATION_PLAN.md — DATA-18WC.8C Execution

**Date:** 2026-06-23  
**Duration:** 8 weeks (July 1 — August 26)  
**Risk:** LOW (rollback available at every phase)

## Phase 1: Foundation (Week 1)

- Create src/lib/standings-normalization.ts
- Extend authority-cache.ts types with v2
- Implement readAuthorityCacheV2 (v2 → v1 fallback)
- Dual-write begins (both v1 + v2 keys written)
- Unit tests: 8+ cases
- **Rollback:** Disable v2 writes, keep v1

## Phase 2: Dual-Write Validation (Weeks 2–3)

- Deploy Phase 1 to production
- Verify both KV keys exist (v1 + v2)
- Monitor: no latency increase, both writes succeed
- **Rollback:** Disable v2 writes

## Phase 3: Page Migration (Weeks 4–6)

- Modify getStandingsCached('WC') to read from v2
- Test all 9 pages: verify standings display
- Remove duplicate normalization from pages
- Update debug endpoints
- **Rollback:** Revert getStandingsCached code

## Phase 4: Cleanup (Weeks 7–8)

- Stop writing v1 keys (after 7-day TTL)
- Remove dead code
- Update documentation
- Performance validation
- **Rollback:** Restore v1 writes

## Timeline

`
Week 1        Phase 1: Build foundation, dual-write begins
Weeks 2–3     Phase 2: Monitor dual-write stability
Weeks 4–6     Phase 3: Migrate pages to readAuthorityCacheV2
Weeks 7–8     Phase 4: Cleanup, remove v1 writes, validation
Sept 1        COMPLETE: Authority v2 is single source
`

## Rollback at Any Phase

All phases safe to rollback:
- Phase 1: Revert, disable v2 writes (pages unchanged)
- Phase 2: Revert, stop dual-write (pages unchanged)
- Phase 3: Revert getStandingsCached code
- Phase 4: Restore v1 writes

**No data loss. No user impact. Always safe.**

## Monitoring

Track:
- authority_cache_v1_writes_total
- authority_cache_v2_writes_total
- v2 envelope size
- getStandingsCached latency
- cold_rebuild duration

## Success Criteria

- ✅ All standings from authority v2
- ✅ Zero direct KV standings reads
- ✅ All group keys "GROUP_A" format
- ✅ All 9 pages working
- ✅ Atomic match+standings writes
- ✅ Zero regressions

## Decision Gate

Before Phase 1, confirm:
- [ ] Design approved
- [ ] Pages identified (9 total)
- [ ] Rollback tested
- [ ] On-call briefed

**Status:** __________ (PM approval)
