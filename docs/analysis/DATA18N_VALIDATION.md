# DATA-18N Phase 6 — Validation

Date: 2026-06-18

Requirement: Show ≥5 scenarios where predictive warnings fire BEFORE
authority-drift, enrichment-health, or integrity-audit become RED.

---

## Scenario 1 — Rate-Safe Mode Activates → Snapshots Cannot Rebuild

**Trigger signal (predictive):** `goalradar:rate-safe:active` KV key present
**Lead time:** Immediate — rate-safe mode is active before any snapshot expires

**Timeline:**
```
T+0 min    FD API returns 429 → rate-safe mode activates → KV key written
T+0 min    predictive-risk: riskLevel=RED, RF-5 fires
           early-warning:   overallLevel=CRITICAL, P=0.92
T+X min    FINISHED snapshot expires (X = TTL remaining, up to 7d)
T+X+1 min  Page visit → cold rebuild → provider call fails (rate-safe) → goals=0 snapshot
T+X+2 min  enrichment-health: unenriched > 0 → verdict=RED   ← LATE
           integrity-audit: goalsMatchScore=fail → FAIL         ← LATE
```

**Predictive warning fires at T+0.** Reactive gates fire at T+X+2 (potentially hours/days later).

---

## Scenario 2 — FINISHED Snapshot Approaching 7d Expiry with No DR

**Trigger signals (predictive):**
- RF-1: snapshot TTL ≤ 24 h (YELLOW) or ≤ 4 h (RED)
- RF-2: DR key absent

**Timeline:**
```
T-24h      predictive-risk: snapshotsExpiring24h=N, drAbsentCount=N → YELLOW
T-4h       predictive-risk: snapshotsExpiring4h=N → riskLevel=RED
T+0        Snapshot evicts from KV
T+1 min    Page visit → cold rebuild → ESPN call succeeds (if available)
           If ESPN unavailable: goals=0 snapshot written (DR absent = no guard)
T+2 min    enrichment-health: unenriched > 0 → RED   ← LATE
```

**Predictive warning fires at T-24h.** Reactive gates fire at T+2 (after actual failure).
DR absent makes this a RED compound (RF-1 + RF-2): downgrade guard disabled.

---

## Scenario 3 — ESPN Event Cache Expiry Coincides with Snapshot Eviction

**Trigger signals (predictive):**
- RF-1: snapshot TTL ≤ 24 h
- RF-3: ESPN event cache TTL ≤ 24 h for the same match

**Timeline:**
```
T-24h      predictive-risk detects both RF-1 and RF-3 for match M → compound YELLOW
           P(unenriched rebuild) = 60% (RF-1+RF-3 compound, per risk model)
T+0        Snapshot evicts
T+1 min    Page visit → cold rebuild → espn:event:{M} miss → live ESPN call
           If ESPN live call fails: goals=0 snapshot
T+2 min    enrichment-health: unenriched=1 → RED   ← LATE
```

**Predictive compound warning at T-24h.** Reactive gate fires at T+2.
This scenario is exactly the DATA-18K root cause class: snapshot eviction + ESPN unavailability.

---

## Scenario 4 — Orchestrator Cron Stalled (Feed Going Stale)

**Trigger signal (predictive):** RF-6 — FINISHED feed age > 4 h

**Timeline:**
```
T-0h       Orchestrator cron last ran successfully
T+1h       Feed age = 1 h → feed-integrity: YELLOW (existing monitor, not predictive)
T+4h       predictive-risk: finishedFeedAgeHours=4 → RF-6 YELLOW fires
           early-warning: freshness-slo-falling may also fire
T+6h       feed-integrity: verdict=RED   ← LATE reactive
T+Nh       FINISHED snapshots begin evicting without reseed → RF-1 cascade
T+N+1h     enrichment-health degradation begins   ← VERY LATE
```

**Predictive warning fires at T+4h.** The 4 h threshold gives 2 h lead time before
feed-integrity turns RED, and potentially many hours before enrichment degrades.

---

## Scenario 5 — Self-Heal Storm (Multiple Active Repair-Locks)

**Trigger signal (predictive):** RF-7 — active repair-lock count ≥ 2

**Timeline:**
```
T+0        Orchestrator cron writes unenriched snapshots for N matches (DATA-18K pattern)
T+1 min    First page visits: self-heal triggers on N matches → N repair-locks created
T+2 min    predictive-risk: activeRepairLocks=N → YELLOW (≥2) or RED (≥5)
           early-warning: P rising with N
T+30 min   Repair-locks expire (NX 1800s TTL)
           If self-heal succeeded: gates stay GREEN
           If self-heal failed (ESPN down during those 30 min):
T+31 min   enrichment-health: unenriched=N → RED   ← LATE
           integrity-audit: fail for those matches   ← LATE
```

**Predictive warning fires at T+2 min.** Reactive gates fire at T+31 min (after repair-lock expires).

---

## Scenario 6 — Archive Trajectory: Consecutive YELLOW Records

**Trigger signal (predictive):** RF-8 — ≥3 consecutive non-GREEN archive records

**Timeline:**
```
T-3 periods  Archive record: YELLOW (authority-freshness absent)
T-2 periods  Archive record: YELLOW (feed stale + freshness absent)
T-1 period   Archive record: YELLOW (feed still stale, enrichment ok)
T-0          early-warning: trailing=3 → P=0.70, severity=HIGH
             "Consecutive degradation not self-correcting"
T+N          If orchestrator cron doesn't recover: feed turns RED, then enrichment cascades
             authority-drift: RED   ← LATE reactive
             enrichment-health: RED   ← LATE reactive
```

**Predictive warning fires at T-0 (after 3rd record).** Lead time = archive capture interval
(e.g. 15 min intervals → 45 min of lead time before reactive RED gates).

---

## Summary Table

| Scenario | Predictive signal | Lead time before reactive RED | Gate(s) that would go RED |
|----------|------------------|-------------------------------|--------------------------|
| 1. Rate-safe active | RF-5, P=0.92 | Up to snapshot TTL (hours–days) | enrichment-health, integrity-audit |
| 2. Snapshot expiry + DR absent | RF-1+RF-2, 24h→4h | 4–24 h | enrichment-health, integrity-audit |
| 3. ESPN cache + snapshot co-expiry | RF-1+RF-3, 60% compound | 24 h | enrichment-health |
| 4. Feed stale (cron stalled) | RF-6 at 4h | 2 h before feed-integrity RED | feed-integrity, then enrichment-health |
| 5. Repair-lock storm | RF-7 at ≥2 | 30 min | enrichment-health, integrity-audit |
| 6. Archive trajectory | RF-8 at 3+ | Archive interval × 3 | authority-drift, enrichment-health |

---

## Constraints satisfied

- No production writes ✅
- No cache mutation ✅
- Read-only observability only ✅
- No Authority Cache redesign ✅
- No Snapshot redesign ✅
- No Enrichment redesign ✅
- No Match Page changes ✅
