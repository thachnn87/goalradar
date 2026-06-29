# OPS Escalation Matrix — GoalRadar

Date: 2026-06-18
Version: DATA-18OPS.1

---

## Severity Levels

| Level | Definition |
|-------|-----------|
| **INFO** | Expected operational event; no user impact; logged for awareness |
| **WARNING** | Degraded condition; minor user impact; may self-resolve |
| **YELLOW** | Sustained degradation; measurable user impact; human review required |
| **RED** | Major incident; significant user impact; immediate action required |
| **CRITICAL** | Existential platform impact; World Cup fixture affected; all-hands |

---

## Response Tiers

| Tier | Who | Expectation |
|------|-----|-------------|
| **AUTO** | System (feature flag controlled) | No human needed; system self-heals |
| **ONCALL** | On-call engineer | Monitors situation; executes runbooks |
| **TEAM_LEAD** | Engineering lead | Authorises flag changes; cross-system decisions |
| **EMERGENCY** | All senior engineers + stakeholders | Immediate mobilisation; business escalation |

---

## Escalation Matrix

### By Incident Type

| Incident | INFO | WARNING | YELLOW | RED | CRITICAL |
|----------|------|---------|--------|-----|----------|
| RF-1 Match Not Found | — | ONCALL | ONCALL | TEAM_LEAD | EMERGENCY |
| RF-2 Live Score Frozen | — | ONCALL | TEAM_LEAD | TEAM_LEAD | EMERGENCY |
| RF-3 Cache Miss Spike | AUTO | AUTO | ONCALL | TEAM_LEAD | EMERGENCY |
| RF-4 Match State Error | AUTO | ONCALL | ONCALL | TEAM_LEAD | EMERGENCY |
| RF-5 ESPN Degradation | AUTO | AUTO | ONCALL | TEAM_LEAD | EMERGENCY |
| RF-6 KV Unavailable | — | ONCALL | TEAM_LEAD | TEAM_LEAD | EMERGENCY |
| RF-7 Repair Loop | AUTO | AUTO | ONCALL | TEAM_LEAD | EMERGENCY |
| RF-8 WC Prewarm Fail | — | ONCALL | ONCALL | TEAM_LEAD | EMERGENCY |

### Severity Triggers per Incident

| Incident | WARNING trigger | YELLOW trigger | RED trigger | CRITICAL trigger |
|----------|----------------|----------------|-------------|-----------------|
| RF-1 | 1 match 404 | 3+ matches 404 | WC fixture 404 | WC fixture 404 during live match |
| RF-2 | Score stale 3–5 min | Score stale 5–10 min | Score stale >10 min | WC live match stale >10 min |
| RF-3 | Hit rate 60–80% | Hit rate <60% sustained | Hit rate <40% | Hit rate 0% (KV down) |
| RF-4 | State wrong, match not live | State wrong, non-WC live | State wrong, WC group stage | State wrong, WC knockout |
| RF-5 | Coverage 70–85% | Coverage 50–70% | Coverage <50% sustained | ESPN down, WC live match |
| RF-6 | KV latency >200ms | KV latency >500ms, intermittent | KV latency >1s sustained | KV fully unavailable |
| RF-7 | 3–5 repairs/hour | Same match >5 repairs | Repair loop >30 min | Repair loop, WC live match |
| RF-8 | Coverage 70–90% | Coverage <70% | Prewarm fails for WC match | Prewarm fails, match <30 min away |

---

## SLA Table

| Severity | Response SLA | Resolution SLA | Owner |
|----------|-------------|----------------|-------|
| INFO | No response required | N/A — log only | System |
| WARNING | Acknowledge within 15 min | Resolve within 2 hours | ONCALL |
| YELLOW | Acknowledge within 5 min | Resolve within 30 min | ONCALL |
| RED | Acknowledge within 2 min | Resolve within 15 min | TEAM_LEAD |
| CRITICAL | Immediate (< 1 min) | Resolve within 10 min | EMERGENCY |

---

## Owner Responsibilities

### AUTO (System)
- Executes remediation actions when `AUTONOMOUS_RELIABILITY_ENABLED=true`
- Records RepairRecordV2 to KV
- Writes verification results
- Does NOT self-escalate — hands off to ONCALL if `verificationPassed=false`

**Currently:** Feature flag is OFF. System operates in observation-only mode.

### ONCALL (On-Call Engineer)
- Monitors alerts and Vercel function logs
- Executes runbooks from OPS_RUNBOOKS.md
- Escalates to TEAM_LEAD if runbook does not resolve within SLA
- Does NOT enable/disable feature flags without TEAM_LEAD approval
- Records incident notes (what happened, what was done, outcome)

**Triggers for escalation to TEAM_LEAD:**
- Runbook steps followed but incident persists past 15 minutes
- Incident severity increases from YELLOW to RED
- Flag change required
- Incident affects World Cup fixture

### TEAM_LEAD (Engineering Lead)
- Authorises `AUTONOMOUS_RELIABILITY_ENABLED` flag changes
- Authorises `SUPPRESS_REFRESH` (system-wide action)
- Authorises `TRIGGER_ORCHESTRATOR` (emergency escalation path)
- Coordinates with business stakeholders during RED incidents
- Makes go/no-go decisions on feature flag enable/disable
- Owns post-incident review and root-cause analysis

**Triggers for EMERGENCY mobilisation:**
- World Cup fixture affected during live match
- KV fully unavailable during match day
- Multiple RED incidents simultaneously

### EMERGENCY (All Hands)
- Activated by TEAM_LEAD only
- Scope: World Cup final / semifinal incidents, multi-system failures
- Includes: Engineering lead, PM, business stakeholders
- Communication channel: Slack #incident channel + direct calls
- Resolution authority: All flags, all deployments, rollbacks

---

## Notification Channels

| Severity | Primary Channel | Secondary |
|----------|----------------|-----------|
| INFO | Vercel logs only | — |
| WARNING | Slack #ops-alerts | — |
| YELLOW | Slack #ops-alerts + mention @oncall | PagerDuty (if configured) |
| RED | PagerDuty page @oncall | Slack #incidents + @team-lead |
| CRITICAL | PagerDuty page @team-lead + all engineers | Phone call |

---

## World Cup Special Protocols

During World Cup match windows (T-30 min before kickoff → T+30 min after final whistle):

| Action | Normal | World Cup Window |
|--------|--------|-----------------|
| WARNING threshold | 15 min response | 5 min response |
| YELLOW threshold | 5 min response | 2 min response |
| RED escalation target | TEAM_LEAD | EMERGENCY |
| Flag changes | TEAM_LEAD approves | Pre-approved window |
| PREWARM_SNAPSHOT | On demand | Automated (cron) |
| ONCALL staffing | 1 engineer | 2 engineers |

---

## Decision Tree — What to Do When Paged

```
Incident alert fires
│
├─ Is this a World Cup live match?
│   YES → Immediately notify TEAM_LEAD, begin runbook in parallel
│   NO  → Continue below
│
├─ Check severity level (INFO / WARNING / YELLOW / RED / CRITICAL)
│
├─ Is there a runbook? (OPS_RUNBOOKS.md)
│   YES → Execute runbook
│   │     Did it resolve in <15 minutes?
│   │       YES → Close incident, write log entry
│   │       NO  → Escalate to TEAM_LEAD
│   NO  → Escalate to TEAM_LEAD immediately
│
├─ Does recovery require a flag change?
│   YES → Wait for TEAM_LEAD approval before proceeding
│   NO  → Proceed with runbook
│
└─ Is this a new failure mode not in the catalog?
    YES → Mitigate first, document after
          Add to OPS_INCIDENT_CATALOG.md as RF-9+
    NO  → Follow the catalog entry
```
