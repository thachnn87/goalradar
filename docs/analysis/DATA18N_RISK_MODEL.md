# DATA-18N Phase 3 — Risk Model

Date: 2026-06-18

---

## Risk Scoring Philosophy

Predictive risk answers: **"What is the probability that an enrichment-dataset or monitoring gate
will become RED within the next 24 h, given current KV state?"**

Each risk factor is a leading indicator — a condition that precedes actual degradation but does
not yet cause it. The model is conservative: false-positive YELLOWs are acceptable; false-negative
GREENs (missed degradation) are not.

---

## Risk Levels

| Level | Definition |
|-------|-----------|
| GREEN | No known risk factor predicts degradation within 24 h |
| YELLOW | ≥1 risk factor indicates *possible* degradation within 24 h — monitor |
| RED | ≥1 risk factor indicates *high probability* degradation within 24 h — act now |

---

## Risk Factor Catalogue

### RF-1 — Snapshot Expiry (RED: ≤4 h, YELLOW: ≤24 h)

**What it measures:** TTL remaining on FINISHED match snapshots.
**Why it predicts failure:** When a FINISHED snapshot evicts, the next page visit triggers a cold
build via `buildSnapshot()`. If ESPN events are unavailable (rate-limited, network error) at that
moment, the rebuild produces a goals=0 snapshot. If the DR copy is also absent, the downgrade
guard cannot rescue it, and `enrichment-health` turns RED.

**Thresholds:**
- TTL ≤ 4 h → RED (expires this session window)
- TTL ≤ 24 h → YELLOW (expires before next monitoring review)
- TTL > 24 h → no contribution

**False-positive rate:** Low. ESPN is highly available; snapshot expiry usually results in clean
rebuild. Elevated to RED only if combined with RF-5 (rate-safe mode active).

---

### RF-2 — DR Snapshot Absent (YELLOW)

**What it measures:** Whether `goalradar:dr:match:{id}` exists.
**Why it predicts failure:** The DR key is the downgrade guard's safety net. Without it,
an unenriched rebuild (RF-1 + provider issue) writes the goals=0 snapshot directly to the
primary, bypassing all protection. It remains RED for up to 7 days until self-heal fires.

**Threshold:** DR key absent (TTL = -2) → YELLOW always.

---

### RF-3 — ESPN Event Cache Expiry (YELLOW: ≤24 h)

**What it measures:** TTL on `goalradar:espn:event:{id}`.
**Why it predicts failure:** If the event cache expires AND the snapshot also expires (RF-1),
the rebuild must call ESPN live. If ESPN returns an error or the lookup ID is also absent
(RF-4), enrichment fails → goals=0 snapshot.

**Compound risk:** RF-1 + RF-3 together → probability of unenriched rebuild increases to ~60%.
RF-1 + RF-3 + RF-5 (rate-safe) → near-certain unenriched rebuild.

---

### RF-4 — ESPN Lookup ID Absent (YELLOW)

**What it measures:** Whether `goalradar:espn:lookup:{id}` exists.
**Why it predicts failure:** Without the ESPN ID, `enrichMatchWithEspnEvents()` cannot call
the event endpoint. It falls back to AF-only enrichment (goals only, no cards/subs/lineups)
or no enrichment at all.

---

### RF-5 — Rate-Safe Mode Active (RED)

**What it measures:** Presence of `goalradar:rate-safe:active` KV key.
**Why it predicts failure:** All orchestrator refresh operations are blocked. Any snapshot that
expires during this window cannot be reseeded. Snapshots rebuild on user request → provider calls
(which are rate-limited) → likely failure → unenriched rebuild cascade.

**Threshold:** Active → RED immediately regardless of other factors.

---

### RF-6 — Feed Absent or Stale (YELLOW: >4 h, RED: absent)

**What it measures:** Age of FINISHED feed KV entry.
**Why it predicts failure:** If orchestrator cron is stalled (feed age → ∞), snapshot prewarm
also stops. All FINISHED snapshots will eventually evict with no reseed. Additionally,
authority-drift starts using stale canonical match data.

**Thresholds:** absent → RED. Age > 4 h → YELLOW (approaching 6 h feed-integrity RED threshold).

---

### RF-7 — Active Repair-Lock Count (YELLOW: ≥2, RED: ≥5)

**What it measures:** Count of `goalradar:repair-lock:{id}` keys currently set.
**Why it predicts failure:** Each lock indicates a self-heal was triggered within the last 30 min.
Multiple simultaneous self-heals → systematic corruption or a snapshot-eviction wave.
If self-heals fail (ESPN unavailable), the repaired matches will remain degraded.

---

### RF-8 — Archive Trajectory (YELLOW: 3+ consecutive, RED: 5+ consecutive)

**What it measures:** Trailing count of non-GREEN `overall` records in the health archive.
**Why it predicts failure:** Consecutive non-GREEN records indicate the system has not recovered
between monitoring periods — either an ongoing incident or a slow deterioration not yet visible
in individual gate readings.

**Compound signal:** Archive shows enrichment.unenriched rising across the last 3 records → a
DATA-18K class bug is actively writing unenriched snapshots (not yet at full RED count).

---

## Compound Risk Table

| RF combination | Predicted failure | Lead time | Confidence |
|----------------|------------------|-----------|------------|
| RF-1 alone | Snapshot cold-rebuild | ≤24 h | 20% (ESPN usually available) |
| RF-1 + RF-5 | Unenriched rebuild → enrichment-health RED | Immediate | 95% |
| RF-1 + RF-3 | Unenriched rebuild risk | ≤24 h | 60% |
| RF-1 + RF-3 + RF-4 | Enrichment total failure | ≤24 h | 80% |
| RF-5 alone | Stale feeds, snapshot eviction cascade | TTL-bounded | 70% |
| RF-7 ≥5 | Systematic corruption active | Immediate | 85% |
| RF-8 ≥5 | Ongoing unresolved incident | Immediate | 90% |
| RF-2 + RF-1 | Downgrade guard bypassed → 7d unenriched lock | ≤snapshot TTL | 40% |

---

## Risk Level Aggregation

```
riskLevel = max(severity of all active risk factors)
```

A single RED factor → riskLevel=RED. One or more YELLOW, no RED → riskLevel=YELLOW.

This is intentionally conservative: any HIGH-confidence failure path takes priority.

---

## Invariant

> If riskLevel=GREEN then P(any gate becoming RED within 24 h) < 5%.
> If riskLevel=RED then P(any gate becoming RED within 24 h) > 70%.
