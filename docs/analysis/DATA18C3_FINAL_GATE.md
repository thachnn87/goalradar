# DATA-18C.3 — Final Gate: DATA-18B Migration Readiness

**Question:** Can GoalRadar safely begin DATA-18B authority-cache listing-page migration?

**Verdict: YES — PILOT_READY**  
**Condition:** Start with a single low-traffic page. Full READY after telemetry confirms 0 cold rebuilds.

---

## Evidence Summary

### Authority Cache Subsystem (DATA-18C.1, DATA-18C.2)

| Check | Result | Evidence |
|---|---|---|
| Primary cache populated | ✅ PASS | source=primary, matchCount=104 (DATA-18C.1 AFTER) |
| DR cache populated | ✅ PASS | drPresent=true (DATA-18C.1 AFTER) |
| Write record updated | ✅ PASS | `authority:last-write` written each cycle |
| DR failover works | ✅ PASS | 61m49s DR service confirmed (DATA-18C.2) |
| Cold rebuild eliminated | ✅ PASS | 0 cold rebuilds in steady state (DATA-18C.2) |
| Authority freshness GREEN | ✅ PASS | Stable across 2 orchestrator cycles |
| Drift RED resolved | ✅ PASS | Transient PERF-6 skip self-corrected in Cycle 2 |

### Telemetry Subsystem (DATA-18C.3)

| Check | Result | Evidence |
|---|---|---|
| TypeScript clean | ✅ PASS | `npx tsc --noEmit` exit 0 |
| Next.js build clean | ✅ PASS | `npm run build` exit 0 |
| Call sites instrumented | ✅ PASS | 3 `recordAuthorityRead()` calls added (primary/DR/cold) |
| Fire-and-forget guaranteed | ✅ PASS | `void` return, no `await`, `.catch()` swallows errors |
| Live endpoint evidence | ⚠️ PENDING | Vercel deployment blocked (see DATA18C3_PRODUCTION_VALIDATION.md §4) |

---

## Readiness Score

| Dimension | Score |
|---|---|
| Cache active | 30/30 |
| DR functioning | 20/20 |
| Cold rebuild free | 20/25 (no telemetry yet; 0 cold rebuilds from DATA-18C.2) |
| Telemetry coverage | 0/15 (pending deploy) |
| Write record present | 10/10 |
| **Total** | **80/100 → PILOT_READY** |

Score rises to **95/100 (READY)** once telemetry confirms 0 cold rebuilds in production.

---

## SLO Projection

Based on DATA-18C.2 observations (no live telemetry yet):

| SLO | Target | Projected | Verdict |
|---|---|---|---|
| Availability | ≥ 99.9% | ~100% | PASS |
| Cold rebuild rate | ≤ 1.0% | ~0% | PASS |
| DR usage rate | ≤ 20.0% | ~10-15% | PASS |

---

## DATA-18B Migration Decision

### YES — proceed with PILOT

**Rationale:**

1. The authority cache subsystem has been in active production operation since DATA-18C.1 activation (2 full orchestrator cycles validated in DATA-18C.2).
2. Cold rebuilds are eliminated in steady state. The fallback chain (primary → DR → cold) has been tested end-to-end including DR failover.
3. The telemetry code is clean (TypeScript + build pass). Once Vercel deploys, it will immediately begin accumulating SLO evidence.
4. The PILOT_READY score of 80/100 is above the 60-point threshold with no blockers (cache active, DR functioning, 0 cold rebuilds, write record present).

### Migration start recommendation

| Phase | Action | Gate |
|---|---|---|
| Pilot | Migrate 1 low-traffic page (e.g. `/world-cup-2026/groups`) to use authority cache | authority-telemetry: ≥10 primary hits, 0 cold rebuilds |
| Expand | Migrate high-traffic pages (schedule, standings, match detail) | authority-slo: all PASS over 7d window |
| Complete | Full migration (all WC listing pages) | authority-readiness: READY (≥85 score) |

### Risk assessment

| Risk | Mitigation |
|---|---|
| Cache miss during orchestrator gap | DR fallback confirmed (61m49s coverage). Cold rebuild would serve correct data, just slower. |
| Authority drift (stale score) | PERF-6 root cause identified; Cycle 2 self-corrects. Monitoring via `authority-drift` endpoint. |
| Kill switch | `AUTHORITY_CACHE_ENABLED=false` in Vercel dashboard disables immediately. |

### What NOT to do yet

- Do NOT disable the cold rebuild path (it's a correctness fallback, not just a crutch).
- Do NOT reduce DR TTL (7-day TTL is the safety net for extended orchestrator gaps).
- Do NOT declare READY until telemetry confirms 0 cold rebuilds in live production reads.

---

## Blocking Issues for Full READY

None. The only remaining item before claiming READY is:

1. Vercel deployment goes live (pending external Vercel state)
2. ≥ 1 orchestrator cycle observed through telemetry endpoints
3. `/api/debug/authority-readiness` returns READY (≥85 score)

These are verification steps, not blockers — the authority cache subsystem is proven production-stable by DATA-18C.2.
