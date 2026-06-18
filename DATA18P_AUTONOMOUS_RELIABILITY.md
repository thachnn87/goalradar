# DATA-18P — Autonomous Reliability & Auto-Remediation

Date: 2026-06-18
Feature flag: `AUTONOMOUS_RELIABILITY_ENABLED=false` (default — dry-run only)

---

## Architecture Overview

```
DATA-18N Predictive Risk
         │
         ▼
src/lib/auto-remediation.ts        ← Phase 1+2: Risk → Action mapping + evaluator
         │
         ├──► src/lib/incident-lifecycle.ts   ← Phase 3: OPEN/MITIGATING/RESOLVED states
         │
         ├──► src/lib/repair-history.ts       ← Phase 4: Repair telemetry archive (ZSET)
         │
         ├──► src/lib/slo-prediction.ts       ← Phase 5: SLO breach prediction
         │
         └──► /api/debug/autonomous-reliability  ← Phase 6: Aggregate endpoint
              /api/debug/repair-telemetry         ← Phase 4: Telemetry endpoint
```

All components are **additive** — no existing files modified.
All operations are **read-only** while `AUTONOMOUS_RELIABILITY_ENABLED=false`.

---

## Phase 1+2 — Risk → Action Mapping

### Mapping Table (`src/lib/auto-remediation.ts`)

| Risk Factor | Condition | Action | Priority | Base P(failure) |
|-------------|-----------|--------|----------|-----------------|
| RF-1 | Snapshot TTL ≤ 24h | `PREWARM_SNAPSHOT` | HIGH | 0.20 |
| RF-2 | DR snapshot absent | `REBUILD_DR` | MEDIUM | 0.15 |
| RF-3 | ESPN event cache ≤ 24h | `REFRESH_ESPN_CACHE` | MEDIUM | 0.15 |
| RF-4 | ESPN lookup absent | `RESOLVE_ESPN_LOOKUP` | MEDIUM | 0.15 |
| RF-5 | Rate-safe mode active | `SUPPRESS_REFRESH` | CRITICAL | 0.92 |
| RF-6 | Feed absent / stale | `TRIGGER_ORCHESTRATOR` | HIGH | 0.40 |
| RF-7 | Repair-lock count ≥ 2 | `MONITOR_SELF_HEAL` | MEDIUM | 0.30 |
| RF-8 | 3+ consecutive YELLOW | `ESCALATE_INCIDENT` | HIGH | 0.70 |
| — | No active RFs | `NO_ACTION` | NONE | 0.00 |

### Compound Escalations

| Combination | Escalated Priority | Escalated P |
|-------------|-------------------|-------------|
| RF-1 + RF-5 | CRITICAL | 0.92 |
| RF-1 + RF-3 | HIGH | 0.60 |
| RF-1 + RF-2 | HIGH | 0.45 |
| RF-3 + RF-4 | HIGH | 0.55 |

### `evaluateAutoRemediation()` output (dry-run example)

```json
{
  "featureEnabled": false,
  "execute": false,
  "dryRun": true,
  "overallRisk": "YELLOW",
  "actions": [
    {
      "action": "PREWARM_SNAPSHOT",
      "priority": "HIGH",
      "matchIds": [537340, 537358],
      "reason": "2 FINISHED snapshot(s) expiring within 24 h — prewarm before eviction.",
      "riskIfSkipped": 0.20,
      "confidence": "low"
    }
  ],
  "escalations": [],
  "compositeRisk": 0.20,
  "note": "DRY-RUN — 1 action(s) recommended. Set AUTONOMOUS_RELIABILITY_ENABLED=true to execute."
}
```

---

## Phase 3 — Incident Lifecycle

### States (`src/lib/incident-lifecycle.ts`)

| State | Condition | `mitigatedAt` | `resolvedAt` |
|-------|-----------|--------------|-------------|
| `OPEN` | Incident active, no repair triggered | null | null |
| `MITIGATING` | Auto-remediation dispatched; awaiting recovery | set | null |
| `RESOLVED` | Returned to GREEN | set (if auto) | set |

### Resolution modes
- `auto-remediated` — repair record found in the incident window, result=success
- `self-healed` — no repair record, but `resolution='auto-recovered'` from deriveIncidents
- `manual` — resolved but no matching repair record
- `ongoing` — not yet resolved

### Lifecycle stats example

```json
{
  "total": 3,
  "open": 0,
  "mitigating": 1,
  "resolved": 2,
  "avgDurationMs": 420000,
  "autoRemediatedPct": 67
}
```

---

## Phase 4 — Repair Telemetry

### `RepairRecord` schema (`src/lib/repair-history.ts`)

| Field | Type | Description |
|-------|------|-------------|
| `ts` | number | Epoch ms (ZSET score) |
| `matchId` | number\|null | Match scoped, or null for system actions |
| `action` | RemediationActionType | What was done |
| `reason` | string | Why it was triggered |
| `result` | `success\|failure\|skipped\|dry-run` | Outcome |
| `durationMs` | number | Execution time |
| `triggeredBy` | string | RF identifier (e.g. 'RF-1', 'RF-1+RF-5') |
| `featureEnabled` | boolean | Flag state at execution time |

### `/api/debug/repair-telemetry` response shape

```json
{
  "archiveSize": 0,
  "windows": {
    "24h": { "total": 0, "success": 0, "successRatePct": 100, "avgDurationMs": null },
    "7d":  { ... },
    "30d": { ... },
    "90d": { ... }
  },
  "topRepairedMatches": [],
  "recentRepairs": [],
  "note": "No repair records yet. Archive populates when AUTONOMOUS_RELIABILITY_ENABLED=true."
}
```

KV key: `goalradar:repair:history` (ZSET, 90-day retention).

---

## Phase 5 — SLO Breach Prediction

### Method (`src/lib/slo-prediction.ts`)

Uses **linear regression** (OLS slope) over the last 48 archive records (≈12 h at 15-min
capture intervals). Extrapolates 96 periods (24 h) ahead. Converts projected compliance
deficit to `breachProbability` (0–1).

### Prediction schema

```json
{
  "scoreAccuracy24h": {
    "name": "Score Accuracy",
    "target": 99.99,
    "currentPct": 100,
    "predictedPct24h": 100,
    "breachProbability": 0.05,
    "trend": "stable",
    "observations": 12,
    "alreadyBreached": false,
    "confidence": "medium"
  },
  "authorityFreshness24h": { ... },
  "enrichmentCoverage24h": { ... },
  "anyPredictedBreach": false
}
```

Confidence levels:
- `high` — ≥12 archive records (≥3 h of data)
- `medium` — 4–11 records
- `low` — <4 records

---

## Phase 6 — `/api/debug/autonomous-reliability`

### Response structure

```json
{
  "featureEnabled": false,
  "checkedAt": "2026-06-18T10:00:00.000Z",
  "risk": {
    "riskLevel": "YELLOW",
    "riskFactorCount": 2,
    "matchesAtRisk": 3,
    "riskFactors": [...]
  },
  "recommendedAction": {
    "action": "PREWARM_SNAPSHOT",
    "priority": "HIGH",
    "reason": "...",
    "matchIds": [537340],
    "confidence": "low",
    "execute": false
  },
  "dryRunPlan": {
    "actions": [...],
    "compositeRisk": 0.20,
    "escalations": [],
    "execute": false,
    "note": "DRY-RUN — ..."
  },
  "predictedBreaches": {
    "scoreAccuracy24h": { "breachProbability": 0.05, "trend": "stable" },
    "authorityFreshness24h": { "breachProbability": 0.25, "trend": "degrading" },
    "enrichmentCoverage24h": { "breachProbability": 0.05, "trend": "stable" },
    "anyPredictedBreach": false
  },
  "openIncidents": [],
  "incidentStats": { "total": 0, "open": 0, "mitigating": 0, "resolved": 0 },
  "repairSuccessRate": { "successRatePct": 100, "total30d": 0, "total24h": 0 }
}
```

---

## Phase 7 — Validation: 5 Dry-Run Scenarios

### Scenario 1 — Rate-Safe Mode (CRITICAL path)

**Setup:** `goalradar:rate-safe:active` present in KV.
**Predictive risk input:** `rateSafeMode.active=true`

**evaluateAutoRemediation() output:**
```
riskFactors: [{ factor: 'rate-safe-mode', severity: 'RED' }]
actions: [{ action: 'SUPPRESS_REFRESH', priority: 'CRITICAL', riskIfSkipped: 0.92 }]
compositeRisk: 0.92
execute: false  ← dry-run; flag=false
```

**Incident lifecycle:** If archive shows open RED incident → state=OPEN → MITIGATING on first repair.
**SLO prediction:** enrichmentCoverage24h breachProbability=0.60 (snapshots expiring + rate-safe).
**No production writes.** ✅

---

### Scenario 2 — Snapshot + DR Absent (compound RF-1 + RF-2)

**Setup:** 2 FINISHED snapshots with TTL ≤ 4h; DR keys absent.
**Predictive risk input:** `matchesAtRisk` has `snapshot-expiry` (severity=RED) + `dr-absent`.

**evaluateAutoRemediation() output:**
```
actions: [
  { action: 'PREWARM_SNAPSHOT', priority: 'HIGH',   riskIfSkipped: 0.45 },  ← escalated
  { action: 'REBUILD_DR',       priority: 'MEDIUM',  riskIfSkipped: 0.15 }
]
escalations: ['Snapshot expiry + DR absent = downgrade guard disabled']
compositeRisk: 0.45
execute: false
```

**Incident lifecycle:** No archive records → incidents=[], lifecycle stats all 0.
**SLO prediction:** enrichmentCoverage24h trend=stable (no historical data yet).
**No production writes.** ✅

---

### Scenario 3 — ESPN Compound (RF-3 + RF-4)

**Setup:** ESPN event caches expiring in 12h; ESPN lookup IDs absent for 3 matches.
**Predictive risk input:** `matchesAtRisk` has both `espn-event-expiry` and `espn-lookup-absent`.

**evaluateAutoRemediation() output:**
```
actions: [
  { action: 'REFRESH_ESPN_CACHE',  priority: 'HIGH',   riskIfSkipped: 0.55 },  ← compound
  { action: 'RESOLVE_ESPN_LOOKUP', priority: 'MEDIUM',  riskIfSkipped: 0.15 }
]
escalations: ['ESPN event expiry + lookup absent = enrichment total block']
compositeRisk: 0.55
execute: false
```

**Recommended action:** `REFRESH_ESPN_CACHE` — re-fetch ESPN events before cache evicts.
**No production writes.** ✅

---

### Scenario 4 — Archive Trajectory (RF-8, persistent degradation)

**Setup:** Health archive has 5 consecutive YELLOW records (archive-trajectory-yellow).
**Predictive risk input:** `riskFactors` includes `archive-trajectory-yellow` with severity=RED (≥5).

**evaluateAutoRemediation() output:**
```
actions: [
  { action: 'ESCALATE_INCIDENT', priority: 'HIGH', riskIfSkipped: 0.70 }
]
compositeRisk: 0.70
execute: false
```

**Incident lifecycle:** `deriveLifecycle()` on those 5 records → 1 open YELLOW incident,
state=OPEN (no repair records exist). incidentStats: `{ open: 1, mitigating: 0 }`.
**SLO prediction:** authorityFreshness24h trend=degrading; breachProbability=0.40.
**No production writes.** ✅

---

### Scenario 5 — Self-Heal Storm (RF-7)

**Setup:** 5 active `goalradar:repair-lock:{id}` keys in KV.
**Predictive risk input:** `repairFrequency.activeRepairLocks=5` → RF-7 → severity=RED.

**evaluateAutoRemediation() output:**
```
riskFactors: [{ factor: 'elevated-repair-frequency', severity: 'RED' }]
actions: [
  { action: 'MONITOR_SELF_HEAL', priority: 'MEDIUM', riskIfSkipped: 0.30 }
]
execute: false
```

**Recommended action:** `MONITOR_SELF_HEAL` — do not intervene while self-heal is in progress.
If self-heal succeeds: repair-locks expire → risk clears → next evaluation → NO_ACTION.
If self-heal fails: enrichment-health → RED → archive records → RF-8 escalation → next cycle → ESCALATE_INCIDENT.

**Incident lifecycle:** If archive shows enrichment.verdict transitioning ERROR→GREEN:
`resolutionMode='self-healed'`, state=RESOLVED.
**No production writes.** ✅

---

## Constraints Verification

| Constraint | Met? |
|-----------|------|
| No Match Detail rendering changes | ✅ no page files touched |
| No Authority Cache schema changes | ✅ authority-cache.ts unmodified |
| No CanonicalMatch changes | ✅ canonical-match.ts unmodified |
| No ESPN/AF provider contract changes | ✅ espn-id-map.ts / af-id-map.ts unmodified |
| Reuses DATA-18K self-heal | ✅ auto-remediation recommends `PREWARM_SNAPSHOT` which triggers it |
| Reuses DATA-18N risk engine | ✅ risk input consumed directly by evaluateAutoRemediation() |
| Additive only | ✅ 6 new files, 0 existing files modified |
| Feature-flagged | ✅ `AUTONOMOUS_RELIABILITY_ENABLED=false` default |
| Dry-run only (this phase) | ✅ `execute=false` always; no KV writes from this code |
| No deployment or activation | ✅ flag is false; endpoints are read-only |

---

## Activation Path (future, not deployed here)

```
1. Set AUTONOMOUS_RELIABILITY_ENABLED=true in Vercel env
2. Wire evaluateAutoRemediation(risk, dryRun=false) into a cron endpoint
3. Execute actions: PREWARM_SNAPSHOT calls prewarmWorldCup() for target matchIds
4. appendRepairRecord() records each outcome
5. /api/debug/repair-telemetry tracks success rate over time
6. deriveLifecycle() reflects MITIGATING → RESOLVED transitions
```

All activation work is future — NOT included in DATA-18P.
