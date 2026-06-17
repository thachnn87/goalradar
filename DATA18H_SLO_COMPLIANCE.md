# DATA-18H Phase 3 — SLO Compliance Engine

Date: 2026-06-17

---

## Purpose

Turn the recorded health archive into **measured** SLO compliance percentages
over 24h / 7d / 30d windows. This is the evidence that answers "are we meeting
our SLOs?" with a number, not an opinion.

Computation only — no writes, no changes to any data subsystem.

---

## SLOs measured (from DATA18G_SLO.md)

| SLO | Target | Record is compliant when |
|-----|--------|--------------------------|
| Score Accuracy | **99.99%** | `drift.verdict ≠ ERROR` AND `drift.red === 0` |
| Authority Freshness | **< 15 min** (→ 99% of observations fresh) | `freshness.verdict ≠ ERROR` AND `!stale` AND `source === 'primary'` |
| Enrichment Coverage | **> 95%** | `enrichment.rate ≥ 0.95` (records with a known rate) |

### Why freshness target is expressed as 99%

The freshness SLO is a latency bound (<15 min). Each archived observation is
sampled at the cron cadence (15 min) and is either fresh or not. Compliance =
fraction of observations that were fresh. A 99% compliance bar allows < 1% of
observations to catch a mid-rebuild window, consistent with the DATA18G error
budget.

---

## Compliance formula

```
compliancePct = (compliant observations / total observations) × 100   (4 dp)
met           = compliancePct ≥ target
```

- **Zero observations → 100% / met.** A fresh deploy with an empty archive is
  not "failing"; it simply has no evidence yet. Compliance accrues as the cron
  records snapshots.
- **Enrichment uses its own observation count** — only records where
  `enrichment.rate` is known are counted, so a transient `ERROR` from the
  enrichment endpoint does not silently inflate the denominator.

---

## Endpoint

`GET /api/debug/slo-compliance`

```json
{
  "checkedAt": "…",
  "archiveSize": 2880,
  "windows": {
    "24h": {
      "observations": 96,
      "scoreAccuracy": { "target": 99.99, "observations": 96, "compliant": 96, "compliancePct": 100, "met": true },
      "freshness":     { "target": 99,    "observations": 96, "compliant": 96, "compliancePct": 100, "met": true },
      "enrichment":    { "target": 95,    "observations": 96, "compliant": 96, "compliancePct": 100, "met": true },
      "allMet": true
    },
    "7d":  { … },
    "30d": { … }
  }
}
```

---

## Interpreting the windows

| Window | Observations @15min | Use |
|--------|--------------------|-----|
| 24h | ~96 | Operational — did anything break today? |
| 7d | ~672 | Trend — recurring degradation pattern? |
| 30d | ~2,880 | Contractual — full retention SLO proof |

A breach in a longer window that is GREEN in 24h indicates a **past, resolved**
incident — cross-reference `/api/debug/incident-history` for the specific
incident and its auto-recovery.

---

## Worked example

If over 7d (672 observations) Score Accuracy had 1 observation with
`drift.red > 0`:

```
compliancePct = (671 / 672) × 100 = 99.8512%
met (≥ 99.99%) = false  →  7d Score-Accuracy SLO breached
```

This single breached observation surfaces as YELLOW in `/api/debug/reliability`
(7d SLO breach) and as a RED incident in `/api/debug/incident-history`, giving a
full causal chain from SLO % → incident → affected matches.

---

## Compliance review cadence

| Window | Reviewed | Owner action |
|--------|----------|--------------|
| 24h | Daily (or on alert) | Triage open incidents |
| 7d | Weekly | Confirm no recurring pattern |
| 30d | End of tournament phase | Publish SLO compliance report |
