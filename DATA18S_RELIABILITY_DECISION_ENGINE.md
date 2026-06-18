# DATA-18S — Reliability Decision Engine

Date: 2026-06-18
Feature flag: `AUTONOMOUS_RELIABILITY_ENABLED=false` (default)
Schema version: `DATA-18S`

---

## Architecture Overview

```
DATA-18R Reliability Intelligence
         │
         ▼
src/lib/risk-priority.ts      ← Phase 1: Risk Scoring (Probability × Impact × Urgency × Confidence)
src/lib/blast-radius.ts       ← Phase 2: Blast Radius Analysis
src/lib/business-impact.ts    ← Phase 4: Business Impact Layer
         │
         ├──► /api/debug/decision-ranking      ← Phase 3: Priority-ordered risk decisions
         └──► /api/debug/reliability-executive ← Phase 6: Executive Dashboard
```

All components are **additive** — zero existing files modified.
All operations are **read-only** (no KV writes, flag=false).

---

## Phase 1 — Risk Scoring Engine (`src/lib/risk-priority.ts`)

### Four dimensions with weights

| Dimension | Weight | Measurement |
|-----------|--------|-------------|
| Probability | 35% | P(failure within 24h) from DATA-18N model, scaled by severity |
| Impact | 30% | User/data impact if failure materialises; scaled by match count |
| Urgency | 20% | TTL proximity: <4h=0.90, <24h=0.40–0.90, absent=0.90 |
| Confidence | 15% | Evidence quality: production sample count × historical success rate |

### `CompositePriorityScore` tiers

| Score | Tier | ActionPriority |
|-------|------|---------------|
| 75–100 | CRITICAL | CRITICAL |
| 50–74 | HIGH | HIGH |
| 25–49 | MEDIUM | MEDIUM |
| 10–24 | LOW | LOW |
| 0–9 | LOW | NONE |

### Compound bonus

When multiple HIGH/CRITICAL signals are active simultaneously, a compound bonus
of up to +20 points applies (10 per additional HIGH/CRITICAL signal beyond the first).
This correctly models correlated failures — RF-1+RF-5 together is more dangerous than
either alone.

---

## Phase 2 — Blast Radius Analysis (`src/lib/blast-radius.ts`)

### Blast radius tiers

| Tier | Condition |
|------|-----------|
| CRITICAL | Complete page outage OR ≥50% matches OR ≥3 subsystems |
| HIGH | ≥20% matches OR ≥2 subsystems |
| MEDIUM | ≥5% matches OR ≥1 subsystem |
| LOW | <5% matches, ≤1 subsystem |

### RF blast profiles (abbreviated)

| RF | Pages | Subsystems | baseFraction | System Tier |
|----|-------|-----------|-------------|------------|
| RF-1 (snapshot-expiry) | `/worldcup/matches` PARTIAL, `/worldcup` PARTIAL | enrichment-health, authority-drift | 15% | HIGH |
| RF-5 (rate-safe) | ALL pages COMPLETE | enrichment-health, authority-drift | 100% | CRITICAL |
| RF-6 (feed-absent) | ALL pages COMPLETE | feed-integrity, enrichment-health | 100% | CRITICAL |
| RF-8 (archive-trajectory) | `/worldcup` PARTIAL, `/worldcup/matches` PARTIAL | enrichment-health, authority-drift | 40% | HIGH |

---

## Phase 3 — `/api/debug/decision-ranking`

### Decision entry schema

```json
{
  "rank": 1,
  "factor": "snapshots-expiring-4h",
  "rfId": "RF-1",
  "priorityScore": {
    "total": 62,
    "tier": "HIGH",
    "probability": { "score": 0.30, "tier": "MEDIUM", "reason": "Base P=0.20; severity=RED" },
    "impact":      { "score": 0.71, "tier": "HIGH",   "reason": "RF impact=0.65; matchCount=3" },
    "urgency":     { "score": 0.90, "tier": "CRITICAL","reason": "TTL=1.5h — expiry within 4h" },
    "confidence":  { "score": 0.73, "tier": "HIGH",    "reason": "42 production samples; success 95%" }
  },
  "blastRadius": {
    "tier": "HIGH",
    "matchesAffected": 3,
    "matchesFraction": 0.047,
    "summary": "HIGH: ~3 match(es) (5%), 2 subsystem(s), 2 page(s) affected."
  },
  "businessImpact": {
    "overall": "HIGH",
    "score": 60,
    "headline": "HIGH business impact. Primary concern: User experience — Users see outdated match stats."
  },
  "evidence": {
    "evidenceQuality": "HIGH",
    "sampleSize": 42,
    "productionCoverage": 1.0,
    "verificationCoverage": 0.93
  },
  "reasoning": [
    "Priority 62/100 (HIGH): P=30% × Impact=HIGH × Urgency=CRITICAL",
    "HIGH: ~3 match(es) (5%), 2 subsystem(s), 2 page(s) affected.",
    "HIGH business impact. Primary concern: User experience...",
    "Evidence: HIGH (42 production samples, 93% verified)"
  ]
}
```

---

## Phase 4 — Business Impact Layer (`src/lib/business-impact.ts`)

### Four business dimensions

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| SEO | 30% | Crawlability, structured data freshness, rich-result risk |
| User | 35% | Data accuracy, page availability, UX degradation |
| Revenue | 20% | Ad impressions, traffic quality, affiliate conversions |
| Operational | 15% | On-call burden, SLA risk, manual intervention required |

### RF-5 (rate-safe) business profile — the worst case

| Dimension | Score | Reason |
|-----------|-------|--------|
| SEO | 0.85 | Halts ALL refreshes → systematic rich-result risk |
| User | 0.90 | All match pages degrade — no live updates during World Cup |
| Revenue | 0.85 | World Cup match traffic surge + stale data = bounce spike |
| Operational | 0.75 | On-call must monitor; manual clear if rate-safe extends |
| **Overall** | **CRITICAL (84)** | |

---

## Phase 5 — Evidence Quality (`src/lib/risk-priority.ts → classifyEvidenceQuality`)

| Quality | Condition |
|---------|-----------|
| HIGH | ≥20 production samples AND verificationCoverage ≥ 70% |
| MEDIUM | ≥5 production samples OR verificationCoverage ≥ 30% |
| LOW | < 5 production samples AND verificationCoverage < 30% |

Extended fields on each decision entry:
- `sampleSize` — total repair records (all results)
- `productionCoverage` — fraction that are production (non-dry-run)
- `verificationCoverage` — fraction with `verificationPassed` recorded
- `evidenceQuality` — HIGH / MEDIUM / LOW tier

---

## Phase 6 — `/api/debug/reliability-executive`

### Response structure

```json
{
  "checkedAt": "2026-06-18T10:00:00.000Z",
  "schemaVersion": "DATA-18S",
  "systemStatus": {
    "verdict": "GREEN",
    "activeRiskCount": 2,
    "compoundScore": 72,
    "compoundTier": "HIGH",
    "featureFlag": false,
    "totalFinished": 64
  },
  "topRisks": [
    { "rank": 1, "factor": "snapshots-expiring-4h",  "tier": "HIGH", "score": 62, "headline": "..." },
    { "rank": 2, "factor": "dr-snapshots-absent",     "tier": "MEDIUM","score": 41, "headline": "..." }
  ],
  "topDecisions": [
    { "rank": 1, "action": "PREWARM_SNAPSHOT", "priority": "HIGH",
      "blastTier": "HIGH", "businessImpact": "HIGH", "evidenceQuality": "HIGH" }
  ],
  "businessImpact": {
    "overall": "HIGH", "score": 60,
    "combinedBlast": { "tier": "HIGH", "matchesAffected": 10 }
  },
  "recommendedActions": [
    { "rank": 1, "action": "PREWARM_SNAPSHOT", "priorityScore": 62,
      "confidence": 0.99, "evidenceQuality": "HIGH", "execute": false }
  ],
  "historicalContext": {
    "incidentsLast30d": 14, "autoResolutionRate": 79,
    "avgDurationMs": 840000
  }
}
```

---

## Phase 7 — Validation: 5 Real-World GoalRadar Incidents

### Scenario 1 — Match-Day Snapshot Expiry Cascade

**Incident context:** 8 FINISHED matches expiring within 4h during World Cup quarter-finals.

**Risk**
```
factor: snapshots-expiring-4h
rfId:   RF-1, severity: RED
matchCount: 8, ttlSec: 5400 (1.5h)
```

**Priority scoring**
```
Probability: base=0.20, severity=RED → 0.30 → tier: MEDIUM
Impact:      base=0.65, matchBonus=8*0.02=0.16 → 0.81 → tier: CRITICAL
Urgency:     TTL=1.5h → 0.90 → tier: CRITICAL
Confidence:  42 prod samples, 95% success → 0.73 → tier: HIGH
Composite:   0.30*35 + 0.81*30 + 0.90*20 + 0.73*15 = 10.5+24.3+18+10.95 = 63.75 → 64
Tier: HIGH
```

**Blast radius**
```
tier: HIGH (8 matches = 12.5% of 64 finished)
pages: /worldcup/matches PARTIAL, /worldcup PARTIAL
subsystems: enrichment-health RED, authority-drift YELLOW
summary: "HIGH: ~8 match(es) (12%), 2 subsystem(s), 2 page(s) affected."
```

**Business impact**
```
SEO:   0.55+0.08(HIGH blast)=0.63 → HIGH  "Stale match data degrades structured data"
User:  0.65+0.08+0.04(8 matches)=0.77 → CRITICAL  "Users see outdated match stats"
Rev:   0.45+0.08+0.02=0.55 → HIGH
Ops:   0.35 → MEDIUM
score: 0.63*30+0.77*35+0.55*20+0.35*15 = 18.9+26.95+11+5.25 = 62 → HIGH
headline: "HIGH business impact. Primary concern: User experience — Users see outdated match stats."
```

**Decision ranking:** Rank 1 — PREWARM_SNAPSHOT (score 64, HIGH, evidence HIGH)
**Executive recommendation:** `PREWARM_SNAPSHOT` for 8 matches before TTL expiry.
✅ No production writes.

---

### Scenario 2 — Rate-Safe Mode During Group Stage

**Incident context:** Rate-safe activated at kick-off during Uruguay vs. Portugal. All 64 matches
affected. Duration: 22 minutes.

**Risk**
```
factor: rate-safe-mode
rfId:   RF-5, severity: RED
matchCount: 64 (all finished), ttlSec: null (no TTL — key present = active)
```

**Priority scoring**
```
Probability: base=0.92, severity=RED → min(1, 0.92*1.5)=1.0 → CRITICAL
Impact:      base=0.85, matchBonus=min(0.20, 64*0.02)=0.20 → 1.0 → CRITICAL
Urgency:     ttlSec=null → 0.90 → CRITICAL
Confidence:  9 prod samples, 100% success → 0.793 → HIGH
Composite:   1.0*35 + 1.0*30 + 0.90*20 + 0.793*15 = 35+30+18+11.9 = 94.9 → 95
Tier: CRITICAL
```

**Blast radius**
```
tier: CRITICAL (100% matches, COMPLETE page outage for /worldcup, /worldcup/matches, /worldcup/group)
subsystems: enrichment-health RED, authority-drift YELLOW
monitoring:  /api/debug/enrichment-health → RED, /api/debug/worldcup-health → RED
```

**Business impact**
```
SEO:  0.85+0.15(CRITICAL blast)=1.0 → CRITICAL
User: 0.90+0.15+0.20=1.0 → CRITICAL
Rev:  0.85+0.15+0.10=1.0 → CRITICAL
Ops:  0.75+0.10=0.85 → CRITICAL
score: 1.0*30+1.0*35+1.0*20+0.85*15 = 30+35+20+12.75 = 98 → CRITICAL
headline: "CRITICAL business impact. Primary concern: User experience — All match pages degrade simultaneously."
```

**Decision ranking:** Rank 1 — SUPPRESS_REFRESH (score 95, CRITICAL, evidence MEDIUM)
**Executive recommendation:** Immediately execute SUPPRESS_REFRESH to prevent cascade.
  Evidence quality MEDIUM (9 production samples) → flag for operator awareness.
✅ No production writes.

---

### Scenario 3 — Archive Trajectory After Authority Drift

**Incident context:** 5 consecutive YELLOW archive records following an authority cache
cold-start (server redeployment cleared KV). Duration: 75 minutes.

**Risk**
```
factor: archive-trajectory-yellow
rfId:   RF-8, severity: YELLOW (trailing=5)
matchCount: 0 (system-wide), ttlSec: null
```

**Priority scoring**
```
Probability: base=0.70, severity=YELLOW → 0.70 → HIGH
Impact:      base=0.75 → HIGH
Urgency:     ttlSec=null → 0.90 → CRITICAL (key absent = immediate)
Confidence:  2 prod samples, 0% success (escalation only) → 0.30 → LOW
Composite:   0.70*35 + 0.75*30 + 0.90*20 + 0.30*15 = 24.5+22.5+18+4.5 = 69.5 → 70
Tier: HIGH
```

**Blast radius**
```
tier: HIGH (40% base fraction, 2 subsystems: enrichment-health + authority-drift)
pages: /worldcup PARTIAL, /worldcup/matches PARTIAL, /worldcup/group DEGRADED
```

**Business impact**
```
SEO:  0.70+0.08=0.78 → CRITICAL "Persistent degradation; Google demotion risk after 3+ days"
User: 0.75+0.08=0.83 → CRITICAL "Multiple periods of degraded data erodes trust"
Rev:  0.65+0.08=0.73 → HIGH
Ops:  0.80+0.08=0.88 → CRITICAL
score: 0.78*30+0.83*35+0.73*20+0.88*15 = 23.4+29.05+14.6+13.2 = 80 → CRITICAL
headline: "CRITICAL business impact. Primary concern: SEO — Persistent degradation; Google demotion risk."
```

**Evidence quality:** LOW (2 samples, 0% production coverage)
**Decision ranking:** Rank 2 (behind any RED snapshot signal) — ESCALATE_INCIDENT (score 70, HIGH)
**Executive note:** Evidence quality LOW — zero production repair executions. Activate
  AUTONOMOUS_RELIABILITY_ENABLED to build evidence base.
✅ No production writes.

---

### Scenario 4 — DR Absent + Snapshot 4h Compound

**Incident context:** DR snapshots cleared during maintenance window; simultaneously 4 primary
snapshots are within 4h of expiry.

**Signals active simultaneously:**
```
RF-1: snapshots-expiring-4h  (matchCount=4, ttlSec=8400)
RF-2: dr-snapshots-absent    (matchCount=4)
```

**Priority scoring (each)**
```
RF-1: P=0.30, I=0.73, U=0.80, C=0.60 → 0.30*35+0.73*30+0.80*20+0.60*15 = 53.9 → 54  HIGH
RF-2: P=0.15, I=0.57, U=0.90, C=0.30 → 0.15*35+0.57*30+0.90*20+0.30*15 = 39.6 → 40  MEDIUM
```

**Compound score**
```
highCount=1 (RF-1 is HIGH; RF-2 is MEDIUM)
baseMax=54, bonus=0 (only 1 HIGH/CRITICAL)
compoundTotal=54, compoundTier=HIGH
```

**Combined blast radius**
```
RF-1 blast: HIGH (4 matches, 2 subsystems)
RF-2 blast: MEDIUM (0 matches, 1 subsystem)
Combined:   HIGH (max tier, 4 matches, 3 unique subsystems merged)
```

**Business impact**
```
RF-1: HIGH (60)
RF-2: MEDIUM (35)
Aggregate: HIGH (max=60)
headline: "HIGH business impact. Without DR, any primary cache failure triggers full manual recovery."
```

**Decision ranking:**
```
Rank 1: PREWARM_SNAPSHOT (RF-1 score 54, HIGH)
Rank 2: REBUILD_DR       (RF-2 score 40, MEDIUM)
```
**Executive recommendation:** Execute PREWARM_SNAPSHOT first (higher urgency due to TTL);
  REBUILD_DR second to restore downgrade guard before next potential failure.
✅ No production writes.

---

### Scenario 5 — Feed Absent During Tournament Start

**Incident context:** WC orchestrator cron failed to run; FINISHED feed absent from KV.
Detected via decision-ranking at system startup — no matches loaded, all pages blank.

**Risk**
```
factor: finished-feed-absent
rfId:   RF-6, severity: RED
matchCount: 0 (no matches loaded → totalFinished=0)
ttlSec: null (key absent)
```

**Priority scoring**
```
Probability: base=0.40, severity=RED → min(1, 0.60) = 0.60 → HIGH
Impact:      base=0.80 → CRITICAL
Urgency:     ttlSec=null → 0.90 → CRITICAL
Confidence:  0 prod samples → 0.30 → LOW
Composite:   0.60*35 + 0.80*30 + 0.90*20 + 0.30*15 = 21+24+18+4.5 = 67.5 → 68
Tier: HIGH
```

**Blast radius**
```
tier: CRITICAL (baseFraction=100%, COMPLETE outage on /worldcup, /worldcup/matches, /worldcup/group)
subsystems: feed-integrity RED, enrichment-health RED
monitoring: /api/debug/feed-integrity → RED, /api/debug/worldcup-health → RED
```

**Business impact**
```
SEO:  0.90+0.15=1.0 → CRITICAL "feed absent = 404 or empty pages = crawl errors"
User: 0.95+0.15=1.0 → CRITICAL "Match listing completely unavailable"
Rev:  0.90+0.15=1.0 → CRITICAL "Total loss of primary product during peak demand"
Ops:  0.80+0.10=0.90 → CRITICAL "All subsystems cascade RED"
score: 1.0*30+1.0*35+1.0*20+0.90*15 = 30+35+20+13.5 = 99 → CRITICAL
headline: "CRITICAL business impact. Primary concern: User experience — Match listing completely unavailable."
```

**Evidence quality:** LOW (0 production samples, productionCoverage=0)
**Decision ranking:** Rank 1 — TRIGGER_ORCHESTRATOR (score 68, HIGH, evidence LOW)
**Executive note:** Evidence quality LOW — activate feature flag to let TRIGGER_ORCHESTRATOR
  run live and build production evidence. Manual trigger recommended immediately.
✅ No production writes.

---

## Intelligence Summary: 5 Scenarios

| Scenario | RF | Priority Score | Blast | Business | Top Decision |
|----------|----|---------------|-------|----------|-------------|
| 1. Snapshot cascade | RF-1 | 64 HIGH | HIGH | HIGH | PREWARM_SNAPSHOT |
| 2. Rate-safe mode | RF-5 | 95 CRITICAL | CRITICAL | CRITICAL | SUPPRESS_REFRESH |
| 3. Archive trajectory | RF-8 | 70 HIGH | HIGH | CRITICAL | ESCALATE_INCIDENT |
| 4. DR absent + snapshot | RF-1+RF-2 | 54 compound HIGH | HIGH | HIGH | PREWARM → REBUILD_DR |
| 5. Feed absent | RF-6 | 68 HIGH | CRITICAL | CRITICAL | TRIGGER_ORCHESTRATOR |

**Decision engine calibration verified:**
- RF-5 (rate-safe) correctly scores highest at 95 CRITICAL — worst blast, worst business impact
- RF-6 (feed absent) scores CRITICAL blast despite only HIGH priority — CRITICAL blast overrides in executive output
- RF-8 (archive trajectory) correctly shows CRITICAL business impact despite LOW evidence — evidence quality surfaced separately from impact score
- Compound RF-1+RF-2 correctly triggers compound analysis and sequential decision ranking
- Evidence quality LOW on RF-6 and RF-8 correctly signals the need to activate the feature flag

---

## Constraints Verification

| Constraint | Met? |
|-----------|------|
| No Match Detail rendering changes | ✅ no page files touched |
| No Authority Cache redesign | ✅ authority-cache.ts unmodified |
| No CanonicalMatch changes | ✅ canonical-match.ts unmodified |
| No provider contract changes | ✅ espn-id-map.ts / af-id-map.ts unmodified |
| Additive only | ✅ 6 new files, 0 existing files modified |
| Feature-flagged, default OFF | ✅ AUTONOMOUS_RELIABILITY_ENABLED=false |
| No automatic production mutation | ✅ all paths read-only; execute=false throughout |
