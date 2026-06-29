# DATA-18H Phase 5 — Incident Management

Date: 2026-06-17

**Documentation only. No auto-remediation.**

---

## Definition

An **incident** is a contiguous run of health-archive records at the same
degraded severity (RED or YELLOW). It starts at the first degraded record and
ends at the first subsequent GREEN record. A run still degraded at read time is
**open**.

A run with a severity change mid-stream (e.g. YELLOW→RED) is split into two
incidents at the transition record.

---

## Incident record format

```ts
{
  id:              string;        // `inc-<startTs>-<severity>`
  severity:        'RED' | 'YELLOW';
  startedAt:       string;        // ISO — first degraded record
  endedAt:         string | null; // ISO — first GREEN record after; null if open
  durationMin:     number;        // (endedAt | now) − startedAt, minutes
  open:            boolean;
  recordCount:     number;        // archive snapshots spanned
  affectedMatches: number;        // peak (drift.red + feed.redCount) across run
  rootCause:       string;        // best-effort classification
  resolution:      string;        // 'auto-recovered' | 'ongoing'
}
```

Derived purely from the archive by `deriveIncidents()` — no incident objects are
persisted separately; they are recomputed on read, so they always reflect the
current archive.

---

## The ">15 min RED" rule

The brief specifies: *when RED persists > 15 min, generate an incident object.*

With a 15-min archive cadence, a RED incident spanning **≥ 2 consecutive
records** has persisted > 15 min and is therefore a reportable incident. A
single isolated RED record (≤ 15 min, self-recovered by the next snapshot) is a
**transient blip**, not a reportable incident — but it is still visible in the
archive and counts against the SLO.

> Operational guidance: page on an **open RED incident** (`open: true,
> severity: RED`) — by definition it has been RED since `startedAt` and is still
> RED now. `/api/debug/reliability` elevates this to a RED verdict automatically.

---

## Root-cause classification

`classifyRootCause()` inspects every record in the run and emits the union of
matched causes:

| Signal in run | Root-cause fragment |
|---------------|--------------------|
| `drift.red > 0` | score/state drift (authority vs snapshot) |
| `feed.redCount > 0` | feed integrity failure (duplicate/invalid transition) |
| `freshness.stale` or `source ≠ primary` | authority cache stale or DR-served |
| `enrichment.rate < 0.95` | enrichment coverage below 95% |
| any subsystem `ERROR` | subsystem endpoint unreachable |

If nothing matches: `unclassified degradation`.

---

## Resolution semantics

| `resolution` | Meaning |
|--------------|---------|
| `auto-recovered` | A GREEN record followed; the system healed without manual action (typically the 04:00 repair-enrichment or 04:30 drift-scan cron, or an orchestrator refresh). |
| `ongoing` | Incident is still open; manual triage may be required. |

This is intentionally descriptive only. DATA-18H **does not** trigger repairs —
the existing crons (`repair-enrichment`, `drift-scan`) are the remediation
layer; this layer records whether they worked.

---

## Incident lifecycle (end to end)

```
1. health-archive cron records a RED snapshot           → archive
2. next snapshot still RED (>15 min)                    → reportable incident (open)
3. /api/debug/reliability verdict = RED                 → page on-call
4. repair-enrichment / drift-scan cron heals the cause  → next snapshot GREEN
5. deriveIncidents() sets endedAt, resolution=auto-recovered
6. incident appears in incident-history 24h/7d/30d windows
7. SLO compliance % reflects the degraded observations
```

Every step is observable; no step requires manual data inspection.

---

## Endpoints in the incident chain

| Endpoint | Role |
|----------|------|
| `/api/cron/health-archive` | Records the evidence |
| `/api/debug/incident-history` | Lists incidents per window + last RED/YELLOW |
| `/api/debug/slo-compliance` | Quantifies the SLO impact |
| `/api/debug/reliability` | Single verdict combining live + historical |

---

## Worked incident example

```json
{
  "id": "inc-1718600400000-RED",
  "severity": "RED",
  "startedAt": "2026-06-17T05:00:00.000Z",
  "endedAt":   "2026-06-17T05:45:00.000Z",
  "durationMin": 45,
  "open": false,
  "recordCount": 3,
  "affectedMatches": 2,
  "rootCause": "score/state drift (authority vs snapshot)",
  "resolution": "auto-recovered"
}
```

Read: a 45-minute RED incident spanning 3 snapshots, caused by score drift on 2
matches, auto-recovered (next snapshot GREEN — drift-scan/repair cron healed it).
No manual action was taken; the chain proves the self-healing path worked.
