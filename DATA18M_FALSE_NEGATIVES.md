# DATA-18M Phase 2 — False Negatives

Date: 2026-06-18

Two false-negative paths identified. Both cause worldcup-health=RED even when the enrichment
dataset is fully healthy.

---

## FALSE NEGATIVE 1 — enrichment-health always ERROR

**Location:** `src/app/api/debug/worldcup-health/route.ts` lines 76–79 + 108–114

**Root cause:** `enrichment-health` returns no `verdict`/`overallVerdict`/`gate` field.
The aggregator's verdict extractor falls to its default branch and emits `'ERROR'`.

```typescript
// aggregator reads:
const raw = (data.verdict ?? data.overallVerdict ?? data.gate) as string | undefined;
// all three undefined → raw = undefined
// → verdict = 'ERROR'  (the final else branch)
```

**Consequence:** enrichment-health is always ERROR regardless of actual unenriched count.
Even with `unenriched=0 ok=20` the aggregator sees ERROR → worldcup-health=RED.

**Proof:** DATA-18K.2 confirmed `enrichment-health` returns `{total:20, ok:20, unenriched:0}`
with no verdict field. worldcup-health showed `enrichment-health: ERROR` in its subsystems list.

**Fix:** Add `verdict` field to `enrichment-health` response, derived from actual counts:
```
unenriched > 0           → RED
noSnapshot > 0           → YELLOW  (snapshot missing but not goals-unenriched)
both 0                   → GREEN
```

**Companion fix:** `buildSummary` in worldcup-health reads wrong field names for enrichment-health:
- Uses: `totalFinished`, `unenrichedCount`, `enrichmentRate`
- Actual: `total`, `ok`, `unenriched`
- Fix: update buildSummary to read `total`, `ok`, `unenriched`

---

## FALSE NEGATIVE 2 — authority-freshness absent → RED (over-severity)

**Location:** `src/app/api/debug/authority-freshness/route.ts` line 123

**Root cause:** when `source=absent`, the endpoint returns `verdict='RED'`. RED cascades into
worldcup-health=RED.

```typescript
const verdict =
  source === 'absent' ? 'RED'        // ← over-severity
  : stale && source === 'primary' ? 'YELLOW'
  : stale && source === 'dr'      ? 'RED'
  : 'GREEN';
```

**Why this is over-severity:**

1. `readAuthorityCache()` (called by authority-drift and feed-integrity) performs a cold rebuild
   from KV feeds when the KV key is absent. The cold rebuild is in-memory only and returns
   correct data — it does NOT require the KV key to be warm.

2. The Match Detail Page does not consume the Authority Cache at all (proven in DATA-18J).
   Absent cache has zero effect on match page events.

3. `source=absent` means "cache not pre-warmed" — a performance/caching concern, not a data
   correctness failure. The data is still served correctly via cold rebuild on demand.

4. Compare with `source=dr` (serving from DR = primary evicted = orchestrator likely down) which
   is legitimately RED. `source=absent` is a less severe condition: no KV entry at all, but all
   callers fall back to in-memory rebuild.

**The correct severity for absent is YELLOW:**
- Data is still correct (cold rebuild path works)
- No user-visible failure on match pages
- Warrants attention (orchestrator cron should warm it) but not an outage signal

**Fix:** Change `source === 'absent' ? 'RED'` → `source === 'absent' ? 'YELLOW'` and update the
`note` to clarify "cold rebuild will serve — non-critical but warm via orchestrator cron."

---

## False negative impact matrix

| False negative | Triggers on | worldcup-health impact | Actual data state |
|----------------|------------|----------------------|-------------------|
| enrichment-health ERROR | always (no verdict field) | ERROR → aggregate=RED | unenriched=0 (healthy) |
| authority-freshness absent→RED | KV key `goalradar:wc:authority:v1` absent | RED → aggregate=RED | cold rebuild serves correctly |

---

## Genuine YELLOWs (not false negatives)

These remain YELLOW after fixes and are correct:

| Subsystem | YELLOW cause | Genuine? |
|-----------|-------------|---------|
| authority-freshness | absent (downgraded to YELLOW) | YES — cache not pre-warmed |
| feed-integrity | stale feeds (>1h old, 0 RED issues) | YES — feed cross-window anomalies |

After both fixes, worldcup-health=YELLOW is the correct verdict (two genuine YELLOWs remain).
worldcup-health=RED is eliminated (no false RED).
