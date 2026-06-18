# DATA-18M Phase 1 — Dependency Map

Date: 2026-06-18

`/api/debug/worldcup-health` fans out to 5 subsystems in parallel then aggregates.

---

## Subsystem 1 — authority-freshness

| Field | Value |
|-------|-------|
| Endpoint | `/api/debug/authority-freshness` |
| File | `src/app/api/debug/authority-freshness/route.ts` |
| Verdict key read by aggregator | `data.verdict` |
| Response when absent | `{ verdict: 'RED', source: 'absent', stale: true, … }` |
| Response when present+fresh | `{ verdict: 'GREEN', source: 'primary', ageSec: N, ttlTier: '…' }` |

**Parser logic in worldcup-health:**
```typescript
const raw = (data.verdict ?? data.overallVerdict ?? data.gate) as string | undefined;
```
`data.verdict` is set — reads correctly.

**buildSummary reads:** `source`, `ageSec`, `ttlTier`, `stale` — all fields present in actual response. ✅

**Known issue:** `source=absent` maps to `verdict='RED'` in the endpoint itself. RED cascades through the aggregator to worldcup-health=RED. (FALSE NEGATIVE — see Phase 2.)

---

## Subsystem 2 — authority-drift

| Field | Value |
|-------|-------|
| Endpoint | `/api/debug/authority-drift` |
| File | `src/app/api/debug/authority-drift/route.ts` |
| Verdict key | `data.verdict` — explicitly set: `red>0?'RED':yellow>0?'YELLOW':'GREEN'` |

**Parser logic:** reads `data.verdict` → correct.

**buildSummary reads:** `total`, `green`, `yellow`, `red` — all present. ✅

**Issue:** none. Authority drift calls `readAuthorityCache()` which cold-rebuilds in-memory when KV key is absent (no KV write). Drift result is accurate regardless of cache warm state.

---

## Subsystem 3 — feed-integrity

| Field | Value |
|-------|-------|
| Endpoint | `/api/debug/feed-integrity` |
| File | `src/app/api/debug/feed-integrity/route.ts` |
| Verdict key | `data.verdict` — explicitly set |

**Parser logic:** reads `data.verdict` → correct.

**buildSummary reads:** `issueCount`, `redCount`, `yellowCount` — all present. ✅

**Issue:** none in parsing. Feed staleness issues (>1h old) produce genuine YELLOW. No false negative.

---

## Subsystem 4 — integrity-audit (data18d1-integrity-audit)

| Field | Value |
|-------|-------|
| Endpoint | `/api/debug/data18d1-integrity-audit` |
| File | `src/app/api/debug/data18d1-integrity-audit/route.ts` |
| Verdict key | `data.overallVerdict` — set to `'PASS'/'WARN'/'FAIL'` |

**Parser logic:**
```typescript
const raw = (data.verdict ?? data.overallVerdict ?? data.gate);
// data.verdict is undefined → falls through to data.overallVerdict
// 'PASS' → maps to 'GREEN' via: raw === 'PASS' ? 'GREEN'
```
`overallVerdict='PASS'` → aggregator verdict `GREEN`. ✅

**buildSummary reads:** `totalMatches`, `pass`, `warn`, `fail` — all present. ✅

**Issue:** none.

---

## Subsystem 5 — enrichment-health

| Field | Value |
|-------|-------|
| Endpoint | `/api/debug/enrichment-health` |
| File | `src/app/api/debug/enrichment-health/route.ts` |
| Verdict key | **NONE** — endpoint returns no `verdict`, `overallVerdict`, or `gate` field |

**Actual response shape:**
```json
{
  "checkedAt": "…",
  "feedAgeHours": 1.1,
  "total": 20,
  "ok": 20,
  "unenriched": 0,
  "noSnapshot": 0,
  "matches": […],
  "degradedIds": []
}
```

**Parser logic:**
```typescript
const raw = (data.verdict ?? data.overallVerdict ?? data.gate);
// ALL THREE are undefined → raw = undefined
// undefined falls to the default branch → verdict = 'ERROR'
```
→ **worldcup-health reads enrichment-health as ERROR regardless of actual state.** ❌

**buildSummary mismatch:**
```typescript
// worldcup-health expects:
const m = d as { totalFinished?: number; unenrichedCount?: number; enrichmentRate?: string };
return `totalFinished=${m.totalFinished} unenriched=${m.unenrichedCount} rate=${m.enrichmentRate}`;
// Actual field names: total, ok, unenriched (no enrichmentRate field exists)
// Result: "totalFinished=undefined unenriched=undefined rate=undefined"
```
❌

---

## Aggregation logic

```typescript
function aggregateVerdict(results) {
  if (verdicts.includes('RED') || verdicts.includes('ERROR')) return 'RED';
  if (verdicts.includes('YELLOW'))                             return 'YELLOW';
  return 'GREEN';
}
```

ERROR is treated identically to RED → any ERROR subsystem makes the overall verdict RED.

---

## Summary table

| Subsystem | verdict field | buildSummary fields | Issues |
|-----------|--------------|---------------------|--------|
| authority-freshness | `verdict` ✅ | all correct ✅ | absent→RED is too severe (FALSE RED) |
| authority-drift | `verdict` ✅ | all correct ✅ | none |
| feed-integrity | `verdict` ✅ | all correct ✅ | none |
| integrity-audit | `overallVerdict` ✅ (PASS→GREEN) | all correct ✅ | none |
| enrichment-health | **MISSING** ❌ | wrong field names ❌ | ERROR always; summary always undefined |
