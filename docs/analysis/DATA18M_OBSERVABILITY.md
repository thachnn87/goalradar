# DATA-18M Phase 4 — Observability / Source Attribution

Date: 2026-06-18

## worldcup-health response shape (post DATA-18M)

Each subsystem entry in the `subsystems` array now exposes:

```json
{
  "name":       "enrichment-health",
  "source":     "/api/debug/enrichment-health",
  "verdict":    "GREEN",
  "timestamp":  "2026-06-18T10:00:00.000Z",
  "reason":     "All 20 finished matches enriched.",
  "durationMs": 312,
  "summary":    "total=20 ok=20 unenriched=0 noSnapshot=0"
}
```

| Field | Source | Description |
|-------|--------|-------------|
| `name` | worldcup-health | Subsystem identifier |
| `source` | worldcup-health | Endpoint path called (e.g. `/api/debug/enrichment-health`) |
| `verdict` | subsystem response | Normalised GREEN/YELLOW/RED/ERROR |
| `timestamp` | `checkedAt` or `auditedAt` from subsystem response | When the subsystem ran its checks |
| `reason` | `note` field from subsystem response | Human-readable verdict explanation from the subsystem |
| `durationMs` | worldcup-health | Round-trip fetch duration |
| `summary` | worldcup-health | Compact scalar summary (subsystem-specific format) |

## Subsystem timestamp / reason field mapping

| Subsystem | timestamp field | reason field |
|-----------|----------------|-------------|
| authority-freshness | `checkedAt` | `note` |
| authority-drift | `checkedAt` | `note` |
| feed-integrity | `checkedAt` | `note` |
| integrity-audit | `auditedAt` | `note` (not present — null) |
| enrichment-health | `checkedAt` | `note` (not present — null) |

`data18d1-integrity-audit` and `enrichment-health` do not return a `note` field; `reason` will be
null for those subsystems. Their verdict and summary provide sufficient context.

## Full example worldcup-health response (post DATA-18M, healthy state)

```json
{
  "checkedAt": "2026-06-18T10:00:00.000Z",
  "verdict": "YELLOW",
  "subsystems": [
    {
      "name": "authority-freshness",
      "source": "/api/debug/authority-freshness",
      "verdict": "YELLOW",
      "timestamp": "2026-06-18T10:00:00.000Z",
      "reason": "Authority cache absent — cold rebuild serves on demand. Run orchestrator cron to pre-warm.",
      "durationMs": 45,
      "summary": "source=absent ageSec=null ttlTier=null stale=true"
    },
    {
      "name": "authority-drift",
      "source": "/api/debug/authority-drift",
      "verdict": "GREEN",
      "timestamp": "2026-06-18T10:00:00.000Z",
      "reason": "All 20 finished matches GREEN. No drift detected.",
      "durationMs": 820,
      "summary": "total=20 green=20 yellow=0 red=0"
    },
    {
      "name": "feed-integrity",
      "source": "/api/debug/feed-integrity",
      "verdict": "YELLOW",
      "timestamp": "2026-06-18T10:00:00.000Z",
      "reason": "0 RED + 5 YELLOW issues detected.",
      "durationMs": 340,
      "summary": "issues=5 red=0 yellow=5"
    },
    {
      "name": "integrity-audit",
      "source": "/api/debug/data18d1-integrity-audit",
      "verdict": "GREEN",
      "timestamp": "2026-06-18T10:00:00.000Z",
      "reason": null,
      "durationMs": 280,
      "summary": "total=20 pass=20 warn=0 fail=0"
    },
    {
      "name": "enrichment-health",
      "source": "/api/debug/enrichment-health",
      "verdict": "GREEN",
      "timestamp": "2026-06-18T10:00:00.000Z",
      "reason": null,
      "durationMs": 310,
      "summary": "total=20 ok=20 unenriched=0 noSnapshot=0"
    }
  ],
  "redSystems": [],
  "yellowSystems": ["authority-freshness", "feed-integrity"],
  "note": "Non-critical issues: authority-freshness, feed-integrity. Monitor."
}
```

## Why YELLOW is the correct verdict (not RED)

| Subsystem | Verdict | Cause | Real problem? |
|-----------|---------|-------|---------------|
| authority-freshness | YELLOW | KV key absent | Non-critical — cold rebuild serves correctly |
| authority-drift | GREEN | 20/20 match | ✓ |
| feed-integrity | YELLOW | 5 stale-feed issues, 0 RED | Non-critical — feed cross-window anomalies |
| integrity-audit | GREEN | 20/20 PASS | ✓ |
| enrichment-health | GREEN | unenriched=0, ok=20 | ✓ |

No RED subsystem → worldcup-health=YELLOW. This accurately reflects the state:
enrichment dataset is fully healthy; two non-critical monitoring gaps remain (cache cold, stale feeds).
