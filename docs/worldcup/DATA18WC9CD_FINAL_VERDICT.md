# DATA18WC9CD_FINAL_VERDICT.md — DATA-18WC.9C/D Final Verdict

**Date:** 2026-06-24
**Audit:** DATA-18WC.9C/D — Canonical Data Integrity + Cache Poisoning Audit
**Verdict:** **WC_DATA_INTEGRITY_BLOCKED**

---

## VERDICT

> **WC_DATA_INTEGRITY_BLOCKED**

The WC 2026 data integrity system has two P0 defects proven in production and an active operational incident that prevents self-healing. The system is NOT safe to serve live WC 2026 knockout matches without the Phase 1 remediations in `WC_DATA_INTEGRITY_REMEDIATION.md`.

---

## BLOCKING CONDITIONS

### BLOCK-1: Status Normalization Gap at FD Provider Boundary

**Risk:** P0-1 (WC_DATA_INTEGRITY_RISK_REGISTER.md)
**Confirmed production evidence:** Match 537412 had `snapshotStatus: "LIVE"` (DATA-18WC.9, 2026-06-23)
**Code path:** `football-data.ts:fetchRaw()` → `res.json() as Promise<T>` — zero normalization → "LIVE" enters all cache layers

**What this blocks:**
- Any WC knockout match that goes to IN_PLAY will have `status: "LIVE"` written to the 30-day DR snapshot
- DR snapshot is re-written on every subsequent snapshot build (cycle never terminates)
- User-visible: wrong status badge, wrong metadata title, wrong routing
- Without R1 (`normalizeFDStatus()`), this defect will repeat for every in-play knockout match

**Repair required before unblocking:** `R1 normalizeFDStatus()` deployed AND match 537412 DR keys purged (`R2`)

---

### BLOCK-2: Snapshot DR Self-Poisoning Cycle (30-Day Survival)

**Risk:** P0-1 extension
**Confirmed:** `writeDRSnapshot()` has no status guard; every snapshot build with "LIVE" status resets the 30-day DR clock

**What this blocks:**
- Even if the orchestrator recovers and FD returns the correct status for a match, the DR snapshot remains poisoned
- Primary snapshot expires in 15 minutes; falls to DR → "LIVE" re-served
- No auto-heal path exists for Snapshot DR

**Repair required before unblocking:** DR key purge for affected match IDs (`R2`); `isLiveStatus()` guard extended to include "LIVE" (`R3`)

---

### BLOCK-3: Orchestrator Stall (Active Operational Incident)

**Risk:** P1-2 (CONFIRMED PRODUCTION — verdict: RED at scan time 2026-06-24T02:17Z)
**Evidence:** Authority cache ageSec=7442, source=DR, stale=true; finished feed 3.1h old; live cache absent

**What this blocks:**
- All primary KV keys expire during stall; consumers fall through to DR
- DR keys carry stale data — in the presence of Block-1 and Block-2, this means poisoned data is actively served
- Upcoming knockout matches will not appear in the correct state if they reach IN_PLAY while orchestrator is stalled
- Live cache (30s TTL) cannot be refreshed — live match detection fails

**This block is OPERATIONAL, not a code defect.** However, it must be resolved before any live match. The data integrity code fixes (R1-R3) reduce the damage severity of a stall, but do not eliminate it.

**Repair required before unblocking:** Orchestrator cron must be running and healthy. Root cause of current stall must be identified and fixed.

---

## NON-BLOCKING CONDITIONS (Fix Before Knockout Stage)

| Condition | Risk | Evidence | Self-Heals? |
|-----------|------|---------|------------|
| STATE_RANK["LIVE"] undefined | P1-1 | Proven | No |
| deriveState("LIVE") fallthrough | P0-2 | Proven (resolved by R1 upstream) | No |
| isLive guard misses "LIVE" | P1-3 | Proven (resolved by R1 upstream) | No |
| StatusPill no case for "LIVE" | P1-4 | Proven (resolved by R1 upstream) | No |
| parseRound() missing 3rd-place | P2-3 | Theoretical | No — must fix before 3rd-place match |
| DR purge tooling absent | Operational | Confirmed | N/A |
| match-state debug missing DR fields | Observability | Confirmed | N/A |

---

## WHAT IS HEALTHY

The following components are working correctly and are NOT blocking:

| Component | Status | Evidence |
|-----------|--------|---------|
| Authority cache state resolution | ✅ CORRECT | Match 537412 shows CANCELLED (correct) despite snapshot poison |
| buildCanonicalMatch() score guard | ✅ CORRECT | DATA-18WC.7B fix prevents score drift |
| coldRebuild() all-matches fallback | ✅ CORRECT | DATA-18WC.8B fix handles post-group-stage empty upcoming feed |
| Live cache FD filter (`IN_PLAY,PAUSED`) | ✅ CORRECT | "LIVE" excluded from live feed query |
| Finished feed FD filter (`FINISHED`) | ✅ CORRECT | "LIVE" excluded from finished feed query |
| STATE_RANK forward-only guard | ✅ INCIDENTALLY CORRECT | "LIVE" rank=undefined=0 prevents snapshot from overriding FINISHED in authority |
| WC qualification engine | ✅ UNAFFECTED | DATA-18WC.8B engine reads from authority; authority is correct |
| Bracket rendering | ✅ UNAFFECTED | Reads knockout matches from authority; authority not affected by status poison |
| Group standings | ✅ UNAFFECTED | Reads from standings KV; not affected by match status |

---

## ANSWERS TO 10 SUCCESS CRITERIA QUESTIONS

These are the 10 questions from the DATA-18WC.9C/D specification:

1. **Is every canonical match field normalized at the provider boundary?**
   NO. FD uses `res.json() as Promise<T>` with zero normalization. "LIVE" and "AWARDED" pass through unchallenged.

2. **Is there any confirmed production evidence of field drift?**
   YES. Match 537412 confirmed with `snapshotStatus: "LIVE"` while authority shows CANCELLED (DATA-18WC.9).

3. **Which cache layers carry poisoned data right now?**
   UNKNOWN for match 537412 DR keys (endpoint doesn't inspect DR directly). Known expiry: Snapshot primary expired (confirmed). DR snapshot status is the unknown remaining risk.

4. **How long does poison survive in the worst case?**
   30 days (Snapshot DR TTL) with active cycle reset — effectively perpetual if the orchestrator runs and re-reads from DR Detail.

5. **Which fields auto-heal and in what timeframe?**
   Authority status/state: 15 minutes (auto). Snapshot primary: 15 minutes (re-poisons from DR Detail). Snapshot DR: NEVER without intervention.

6. **Are all P0/P1 risks proven or theoretical?**
   P0-1 (status="LIVE" DR poison): PROVEN. P0-2 (deriveState wrong): PROVEN by code. P1-1 (STATE_RANK gap): PROVEN by code. P1-2 (orchestrator stall): CONFIRMED in production.

7. **Does the authority cache correctly override snapshot poison?**
   YES — authority reads from FD status-filtered feeds, not from the per-match snapshot status. Match 537412 authority shows CANCELLED correctly.

8. **Is there a self-healing path for all defects?**
   NO. Snapshot DR poison has no auto-heal path. Manual DR key deletion is required.

9. **What is the minimum change set to unblock WC knockout matches?**
   R1 (`normalizeFDStatus()`) + R2 (DR key purge for 537412) + R3 (`isLiveStatus()` guard) + orchestrator recovery.

10. **Is the system ready to serve live WC knockout matches?**
    NO. **WC_DATA_INTEGRITY_BLOCKED.**

---

## UNBLOCK CHECKLIST

Before serving any WC knockout match in IN_PLAY status, the following must be completed:

- [ ] **R2**: Delete `goalradar:dr:match:537412` and `goalradar:dr:/matches/537412` from KV
- [ ] **R1**: Deploy `normalizeFDStatus()` in `football-data.ts` (maps "LIVE"→"IN_PLAY", "AWARDED"→"FINISHED")
- [ ] **R3**: Extend `isLiveStatus()` to include "LIVE" in `match-snapshot.ts`
- [ ] **Orchestrator**: Root-cause and fix the current stall; verify cron is running
- [ ] **R7**: Extend match-state debug endpoint to inspect DR snapshot and DR detail keys
- [ ] **Verify**: Hit `/api/debug/wc/match-state/{id}` for match 537412 after R2 — confirm all DR keys show correct status

---

## AUDIT DOCUMENTS PRODUCED

| Phase | Document | Status |
|-------|---------|--------|
| Phase 1 | [WC_CANONICAL_FIELD_MATRIX.md](WC_CANONICAL_FIELD_MATRIX.md) | COMPLETE |
| Phase 2 | [WC_FIELD_NORMALIZATION_AUDIT.md](WC_FIELD_NORMALIZATION_AUDIT.md) | COMPLETE |
| Phase 3 | [WC_CACHE_POISONING_MATRIX.md](WC_CACHE_POISONING_MATRIX.md) | COMPLETE |
| Phase 4 | [WC_PRODUCTION_DRIFT_SCAN.md](WC_PRODUCTION_DRIFT_SCAN.md) | COMPLETE |
| Phase 5 | [WC_POISON_SURVIVABILITY.md](WC_POISON_SURVIVABILITY.md) | COMPLETE |
| Phase 6 | [WC_SELF_HEAL_MATRIX.md](WC_SELF_HEAL_MATRIX.md) | COMPLETE |
| Phase 7 | [WC_DATA_INTEGRITY_RISK_REGISTER.md](WC_DATA_INTEGRITY_RISK_REGISTER.md) | COMPLETE |
| Phase 8 | [WC_DATA_INTEGRITY_REMEDIATION.md](WC_DATA_INTEGRITY_REMEDIATION.md) | COMPLETE |
| Phase 9 | [DATA18WC9CD_FINAL_VERDICT.md](DATA18WC9CD_FINAL_VERDICT.md) | THIS FILE |

**Related documents from earlier phases:**
- [WC_MATCH_STATE_DIVERGENCE.md](WC_MATCH_STATE_DIVERGENCE.md) — DATA-18WC.9 root cause
- [WC_STATUS_ENUM_AUDIT.md](WC_STATUS_ENUM_AUDIT.md) — DATA-18WC.9A status census
- [WC_PROVIDER_NORMALIZATION_AUDIT.md](WC_PROVIDER_NORMALIZATION_AUDIT.md) — DATA-18WC.9B provider architecture

---

*Audit complete. No code was changed. All findings are based on source code analysis and live production endpoint data. Fixes require explicit approval before implementation.*
