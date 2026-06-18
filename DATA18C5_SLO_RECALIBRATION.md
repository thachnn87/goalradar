# DATA-18C.5 Phase 1 — Authority SLO Recalibration

**Collected:** 2026-06-18T15:27–15:32 UTC  
**Evidence basis:** 101 live production reads (90 DR + 5 primary + 0 cold)

---

## 1. Current SLO Targets vs Architectural Reality

| SLO | Current Target | Steady-State Observed | Achievable? |
|---|---|---|---|
| Availability | ≥ 99.9% | 100.00% | ✅ YES |
| Cold Rebuild Rate | ≤ 1.0% | 0.00% | ✅ YES |
| DR Usage Rate | ≤ 20.0% | **95.05%** | ❌ NO |

The DR Usage SLO (≤ 20%) is **architecturally unachievable** with the current cache design.

---

## 2. Why ≤ 20% DR Is Not Achievable

The primary key uses a TTL determined at write time by `deriveTtlTier()`:

| Tier | Condition | TTL |
|---|---|---|
| `live` | Any match IN_PLAY/PAUSED | 30s |
| `today` | Any match kicks off today UTC | 300s |
| `normal` | No live or today matches | 900s |

Orchestrator cron: `*/15` schedule via GitHub Actions, effective cadence ~60-120 minutes (GitHub Actions throttle).

**Steady-state primary hit window calculation:**

```
ttlTier=today  (current WC 2026 group stage):
  primaryHitWindow = 300s
  cycleMin = 60min → primaryHitRatio = 300/3600 = 8.3%
  cycleMax = 120min → primaryHitRatio = 300/7200 = 4.2%
  Expected: 4-8%   DR usage: 92-96%

ttlTier=live   (during a live match):
  primaryHitWindow = 30s → primaryHitRatio ≈ 0.4-0.8%
  DR usage: ~99%

ttlTier=normal (between match days):
  primaryHitWindow = 900s → primaryHitRatio = 12.5-25%
  DR usage: 75-88%
```

**Measured evidence (2026-06-18T15:27-15:32, ttlTier=today):**
```
primaryHits:  5  (4.95%)
drHits:      96  (95.05%)
coldRebuilds: 0  (0.00%)
availability: 100.00%
```

The measured 4.95% primary hit rate confirms the model. DR usage of 95.05% is **correct and expected behavior**.

---

## 3. Recalibrated SLO Targets

### SLOs That Should Be Kept (Unchanged)

| SLO | Target | Rationale |
|---|---|---|
| **Availability** | **≥ 99.9%** | Measures actual health: was any read served? Primary + DR = 100% availability |
| **Cold Rebuild Rate** | **≤ 1.0%** | Measures actual health: did both primary AND DR fail? This is the true risk metric |

### SLO That Requires Recalibration

**DR Usage Rate ≤ 20% → REPLACE with Primary Availability Check**

The DR usage SLO was based on an incorrect model that assumed primary serves 80-90% of reads. The correct model shows DR is the normal serving layer 92-96% of the time. A high DR usage rate is not a problem — it is the system working as designed.

**Proposed replacement SLOs:**

| New SLO | Target | What It Measures |
|---|---|---|
| Cold Rebuild Rate | ≤ 1% | *(retained)* Both KV tiers absent — the only true failure |
| Availability | ≥ 99.9% | *(retained)* Primary-or-DR success rate |
| Write Staleness | ≤ 7 days | Is the DR key within its 7-day TTL? Write record age ≤ 168h |
| Write Cadence | ≤ 4 hours | Is the orchestrator running? `writeAgeMin` ≤ 240 |

Write Staleness and Write Cadence replace the DR usage SLO because they measure the root-cause condition (orchestrator stopped) rather than a symptom (high DR %) that always manifests in normal operation.

---

## 4. Write Cadence SLO Explanation

The one true leading indicator for authority cache degradation is: **how long since the last orchestrator write?**

```
writeAgeMin = minutes since last writeAuthorityCache() call

Normal:       writeAgeMin < 120   (2h)  → GREEN
Extended gap: writeAgeMin 120-240 (4h)  → YELLOW (orchestrator may be delayed)
Stale risk:   writeAgeMin > 240   (4h+) → RED (manual investigation needed)
DR expiry:    writeAgeMin > 10080 (7d)  → CRITICAL (DR will expire, cold rebuild risk)
```

This SLO is directly observable from `/api/debug/authority-readiness` (`evidence.writeAgeMin`).

---

## 5. Corrected SLO Summary

| # | SLO | Target | Direction | Previous? |
|---|---|---|---|---|
| 1 | Availability | ≥ 99.9% | Retain | Yes |
| 2 | Cold Rebuild Rate | ≤ 1.0% | Retain | Yes |
| 3 | DR Usage Rate | ≤ 97% | **Recalibrated** (was ≤ 20%) | Recalibrated |
| 4 | Write Cadence | ≤ 4h stale | **New** | No |

For SLO #3, `≤ 97%` accounts for: normal operation at `today` tier (92-96% DR), with a 1-3% buffer before flagging. DR usage >97% (without cold rebuild) implies both primary AND DR are serving but primary never appears — possible if orchestrator is partially degraded (writes DR but not primary). This is a useful early warning.

---

## 6. Implication for Existing authority-slo Endpoint

The current `authority-slo` endpoint will continue to show DR Usage FAIL. This is a known miscalibration and does not indicate system degradation. The `authority-readiness` endpoint correctly treats DR Usage as WARN (not fail), providing the accurate operational view.

**No code change required.** The miscalibration is documented here; threshold adjustment is a post-WC2026 cleanup task.
