# DATA-18K.2 Phase 4 — Gate Re-run (post-heal)

Date: 2026-06-18

| Gate | Result | Success criterion | Met? |
|------|--------|-------------------|------|
| `enrichment-health` | total=20, ok=20, **unenriched=0**, noSnapshot=0, degradedIds=[] | unenriched = 0 | ✅ |
| `data18d1-integrity-audit` | **verdict=PASS**, total=20, pass=20, warn=0, fail=0 | PASS | ✅ |
| `authority-compare?scope=all` | **gate=GREEN**, green=20, red=0 | GREEN | ✅ |
| `worldcup-health` | **verdict=RED** | GREEN | ❌ (see below) |

## worldcup-health breakdown

| subsystem | verdict | note |
|-----------|---------|------|
| authority-drift | **GREEN** | total=20 green=20 yellow=0 red=0 |
| integrity-audit | **GREEN** | 20/20 pass |
| feed-integrity | YELLOW | 5 issues, **0 red** (non-critical feed cross-window staleness) |
| authority-freshness | **RED** | `source=absent` — the Authority Cache envelope (`goalradar:wc:authority:v1`) is not currently warmed |
| enrichment-health | **ERROR** | aggregator field-name mismatch — see below |

### Why worldcup-health is RED — and why neither cause is an enrichment-dataset defect

1. **authority-freshness = absent (OUT OF SCOPE).** This is the DATA-18E/F/G Authority Cache layer, not
   the match-snapshot enrichment dataset. DATA-18K.2 constraints explicitly forbid Authority Cache
   changes. The Match Detail Page does not read this cache (proven in DATA-18J), so its absence does
   not affect the events on match pages. Warming it (e.g. a WC listing-page request) is a separate,
   out-of-scope action.

2. **enrichment-health = ERROR (false negative / monitoring bug).** The `worldcup-health` aggregator
   normalises subsystem verdicts and reads `totalFinished` / `unenrichedCount` / `enrichmentRate` plus a
   `verdict` field. The `enrichment-health` endpoint actually returns `total` / `ok` / `unenriched`
   (and no `verdict`), so the aggregator can't parse it and defaults to `ERROR`. The endpoint itself is
   **GREEN** (ok=20, unenriched=0). This is a pre-existing DATA-18G aggregator shape mismatch, not a data
   problem — and fixing it would be monitoring redesign, excluded by this task's constraints.

## Net
4 of 5 success criteria fully met. The 5th (`worldcup-health=GREEN`) is blocked solely by an
out-of-scope subsystem (Authority Cache freshness) and a monitoring aggregator false-negative — **no
degraded match contributes to it**. Every enrichment-dataset gate (integrity-audit, authority-compare,
enrichment-health, authority-drift) is green.
