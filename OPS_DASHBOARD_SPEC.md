# OPS Dashboard Specification — GoalRadar

Date: 2026-06-18
Version: DATA-18OPS.1
Status: DESIGN ONLY — no implementation

---

## Purpose

A single-page operational dashboard giving the on-call engineer and
TEAM_LEAD an instant read on platform health. Designed for:
- Morning health check (30-second scan)
- Incident investigation (drill-down to source)
- World Cup match-day monitoring (real-time)

No authentication design specified here — reuses existing `CRON_SECRET` pattern.

---

## Layout Overview

```
┌────────────────────────────────────────────────────────────────────┐
│  GoalRadar Ops Dashboard                    [Last updated: HH:MM]  │
│  /ops  (internal route, requires CRON_SECRET)                      │
├─────────────────┬──────────────────────────────────────────────────┤
│                 │                                                    │
│  SYSTEM STATUS  │              OPEN INCIDENTS                       │
│   (top-left)    │              (top-right)                          │
│                 │                                                    │
├─────────────────┴──────────────────────────────────────────────────┤
│                                                                     │
│                     WORLD CUP HEALTH                                │
│                     (full-width band)                               │
│                                                                     │
├──────────────┬────────────────┬──────────────┬─────────────────────┤
│              │                │              │                      │
│  AUTHORITY   │    PROVIDER    │    CACHE     │    TOP RISKS         │
│  HEALTH      │    HEALTH      │  HEALTH      │                      │
│  (quarter)   │    (quarter)   │  (quarter)   │    (quarter)         │
│              │                │              │                      │
└──────────────┴────────────────┴──────────────┴─────────────────────┘
```

---

## Section 1 — System Status

**Position:** Top-left  
**Size:** ~25% width, compact  
**Update:** On page load (no auto-refresh; manual reload)

### Displays

```
┌─────────────────────────────┐
│  SYSTEM STATUS              │
│                             │
│  Overall     🟡 YELLOW      │
│  Automation  ⚫ OFF (flag)  │
│  KV          🟢 Healthy     │
│  FD          🟢 Reachable   │
│  ESPN        🟡 Degraded    │
│  Governance  🟢 Active      │
│                             │
│  Last incident: 0 active    │
│  Since: 2026-06-18 08:14    │
└─────────────────────────────┘
```

### Data Sources
| Field | Source endpoint |
|-------|----------------|
| Overall status | Derived from all other sections |
| Automation | `AUTONOMOUS_RELIABILITY_ENABLED` env var |
| KV | `/api/debug/authority-cache` — response success |
| FD | Implicit from authority cache hit rate |
| ESPN | `/api/debug/prediction-accuracy` — enrichment coverage |
| Governance | `/api/debug/reliability-governance` — any BLOCKED status |

### Status Colours
- 🟢 GREEN — all clear, nominal
- 🟡 YELLOW — degraded but functional
- 🔴 RED — action required
- ⚫ GRAY — disabled / not applicable

---

## Section 2 — Open Incidents

**Position:** Top-right  
**Size:** ~75% width, compact  
**Update:** On page load

### Displays

```
┌──────────────────────────────────────────────────────────────────┐
│  OPEN INCIDENTS                                        [0 active] │
│                                                                    │
│  No active incidents.                                             │
│                                                                    │
│  ─ or, when incidents exist: ──────────────────────────────────── │
│                                                                    │
│  🔴 RF-2  Live score frozen — match #WC-2026-012     3 min ago   │
│           Status: YELLOW → Score stale 7 min          [Runbook]   │
│                                                                    │
│  🟡 RF-3  Cache miss spike — hitRate 58%             12 min ago  │
│           Status: WARNING → ONCALL investigating      [Runbook]   │
└──────────────────────────────────────────────────────────────────┘
```

### Data Sources
| Field | Source |
|-------|--------|
| Active incidents | Repair history: `verificationPassed=false` in last 60 min |
| Incident type | RF classification from `riskFactors` in reliability scoring |
| Duration | `repairAttemptedAt` timestamp |
| Runbook link | OPS_RUNBOOKS.md anchor |

### Incident Row Format
```
[severity icon] [RF-N] [description] — [affected scope]    [age]
                Status: [severity label] → [summary]       [Runbook]
```

---

## Section 3 — World Cup Health

**Position:** Full-width band below System Status + Open Incidents  
**Size:** Full width, medium height  
**Purpose:** Dedicated WC fixture monitoring — most critical section during tournament

### Displays

```
┌──────────────────────────────────────────────────────────────────────────┐
│  WORLD CUP HEALTH                                                         │
│                                                                            │
│  Today's matches (2026-06-18):                                            │
│                                                                            │
│  [15:00] 🟢 Brazil vs Argentina     Cache HIT  Score ✓  Prewarm ✓       │
│  [18:00] 🟢 France vs Germany       Cache HIT  Score ✓  Prewarm ✓       │
│  [21:00] 🟡 Spain vs England        Cache MISS Score ✓  Prewarm ✗       │
│                                                                            │
│  Prewarm coverage: 2/3 (67%) ← below 70% threshold                       │
│  Live right now:  1 match (Brazil vs Argentina — 67')                     │
│  Next kickoff:    France vs Germany in 2h 14m                             │
└──────────────────────────────────────────────────────────────────────────┘
```

### Match Row Format
```
[KO time] [status icon] [Home] vs [Away]    Cache [HIT/MISS]  Score [✓/✗]  Prewarm [✓/✗]
```

### Status Icon Logic
- 🟢 Cache HIT + Score current + Prewarm done
- 🟡 Any single check failing
- 🔴 Score stale (RF-2) or Cache MISS on live match
- ⚫ Match not yet today / completed > 2 hours ago

### Data Sources
| Field | Source |
|-------|--------|
| Today's WC fixtures | Authority Cache — WC match records |
| Cache HIT/MISS | `/api/debug/authority-cache?matchId={}` |
| Score current | `lastUpdated` age < 5 min for live match |
| Prewarm status | KV key presence check for each fixture |

---

## Section 4 — Authority Health

**Position:** Bottom-left quarter  
**Size:** ~25% width

### Displays

```
┌─────────────────────────────────┐
│  AUTHORITY HEALTH               │
│                                 │
│  Hit rate      91.2%  🟢        │
│  Miss rate      8.8%            │
│  Total keys      147            │
│  Stale keys        0            │
│  Avg TTL       742s             │
│                                 │
│  Top miss reasons:              │
│  • New fixture (3)              │
│  • TTL expired (2)              │
│  • Key not found (1)            │
└─────────────────────────────────┘
```

### Data Sources
- `/api/debug/authority-cache` — all fields
- Hit rate threshold: < 80% = YELLOW, < 60% = RED

---

## Section 5 — Provider Health

**Position:** Bottom second quarter  
**Size:** ~25% width

### Displays

```
┌─────────────────────────────────┐
│  PROVIDER HEALTH                │
│                                 │
│  FD API         🟢 Nominal      │
│    Latency      143ms           │
│    Success rate  100%           │
│                                 │
│  ESPN API       🟡 Degraded     │
│    Latency      2,340ms         │
│    Success rate   71%           │
│    Coverage       68%  ← warn   │
│                                 │
│  Last FD fetch   2 min ago      │
│  Last ESPN fetch 6 min ago      │
└─────────────────────────────────┘
```

### Data Sources
| Field | Source |
|-------|--------|
| FD status | Derived from authority cache freshness |
| ESPN status | `/api/debug/prediction-accuracy` enrichment coverage |
| Latency | Vercel function duration logs (p50) |
| Coverage | Enrichment coverage metric |

---

## Section 6 — Cache Health

**Position:** Bottom third quarter  
**Size:** ~25% width

### Displays

```
┌─────────────────────────────────┐
│  CACHE HEALTH                   │
│                                 │
│  KV Status      🟢 Connected    │
│  Hit rate       91.2%           │
│  Live bypass     🟢 Active      │
│                                 │
│  Repair archive                 │
│  Records (90d)      0           │
│  Dry-run           0            │
│  Production        0            │
│                                 │
│  Confidence history             │
│  Records (90d)      0           │
│  Oldest         —               │
└─────────────────────────────────┘
```

### Data Sources
| Field | Source |
|-------|--------|
| KV status | Response to any `/api/debug/` endpoint |
| Hit rate | `/api/debug/authority-cache` |
| Live bypass | Confirm IN_PLAY matches not returning from KV |
| Repair records | `/api/debug/evidence-readiness` `baselines[].productionExecutions` |

---

## Section 7 — Top Risks

**Position:** Bottom-right quarter  
**Size:** ~25% width

### Displays

```
┌─────────────────────────────────┐
│  TOP RISKS                      │
│                                 │
│  Automation readiness: YELLOW   │
│  No READY actions               │
│  0 production executions        │
│                                 │
│  Closest to READY:              │
│  MONITOR_SELF_HEAL              │
│  Progress: 10%                  │
│  ETA: 10–12 days (1/day)        │
│                                 │
│  Blockers:                      │
│  • No production executions     │
│  • Flag is OFF                  │
│  • Confidence at baseline       │
└─────────────────────────────────┘
```

### Data Sources
| Field | Source |
|-------|--------|
| Readiness verdict | `/api/debug/evidence-readiness` `note` field |
| Closest to READY | `/api/debug/evidence-readiness` `closestToReady` |
| Progress % | `progress[0].progressPercent` |
| ETA | `eta[0].etaDaysConservative` / `etaDaysOptimistic` |
| Blockers | `progress[0].progressNote` |

---

## Implementation Notes (for when the page is built)

1. **Route:** `/ops` — Next.js app router, server component
2. **Auth:** Same pattern as debug endpoints: `CRON_SECRET`
3. **Data fetching:** Single server-side fetch per section, parallel via `Promise.all()`
4. **Refresh:** Manual (F5) — no auto-polling to avoid KV cost
5. **Mobile:** Not required — ops dashboard is engineer-only desktop tool
6. **Deployment:** Same Vercel project, no separate infra
7. **Data source precedence:** All data from existing `/api/debug/*` endpoints — no new KV reads
8. **Error handling:** Each section displays its error independently (partial dashboard
   is better than a full-page error)
9. **Colour coding:** Match severity colours in OPS_ESCALATION_MATRIX.md exactly
10. **No charts:** Text/table only for fast load; no D3 or charting libs required
