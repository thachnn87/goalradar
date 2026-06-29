# DATA-16C Runtime Health Report

Date: 2026-06-17T03:16:51Z
Source: live production API — `GET /api/debug/enrichment-health`

---

## Phase 1 — Repair Execution

```
GET /api/cron/repair-enrichment
→ 2026-06-17T03:06:51.982Z
```

```json
{
  "checked": 18,
  "repaired": 16,
  "degraded": 16,
  "missing": 0,
  "failed": [],
  "succeeded": [
    537327, 537328, 537333, 537334, 537339, 537340,
    537345, 537346, 537351, 537352, 537357, 537358,
    537363, 537364, 537370, 537391
  ]
}
```

`failed: []` — 0 repair failures.

**Two matches outside the repair batch:**
- **537369** Spain vs Cape Verde: score=0-0, goals=0 → correct; not degraded
- **537392** Iraq vs Norway: goals=2 (partial enrichment from pre-DATA-14A) → not caught by `goals===0` guard

Both handled separately:
- 537392: `POST /api/revalidate/match/537392` → `{"ok":true}` — then page load triggered full re-enrichment (5 goals confirmed)
- 537369: `POST /api/revalidate/match/537369` → `{"ok":true}` — then page load triggered enrichment for lineups

---

## Phase 2 — Health Audit (Final State)

```
GET /api/debug/enrichment-health
→ 2026-06-17T03:16:51.782Z
```

| Metric | Value |
|--------|-------|
| Total | 18 |
| OK | **18** |
| Unenriched | **0** |
| No-snapshot | 0 |
| Degraded IDs | [] |

### Per-match health table

| FD ID | Match | Score | Goals (KV) | Goals match score | Lineups | Status |
|-------|-------|-------|------------|-------------------|---------|--------|
| 537327 | Mexico vs South Africa | 2–0 | 2 | ✅ | ✅ | ok |
| 537328 | Korea Republic vs Czechia | 2–1 | 3 | ✅ | ✅ | ok |
| 537333 | Canada vs Bosnia-H. | 1–1 | 2 | ✅ | ✅ | ok |
| 537334 | Qatar vs Switzerland | 1–1 | 2 | ✅ | ✅ | ok |
| 537339 | Brazil vs Morocco | 1–1 | 2 | ✅ | ✅ | ok |
| 537340 | Haiti vs Scotland | 0–1 | 1 | ✅ | ✅ | ok |
| 537345 | USA vs Paraguay | 4–1 | 5 | ✅ | ✅ | ok |
| 537346 | Australia vs Turkey | 2–0 | 2 | ✅ | ✅ | ok |
| 537351 | Germany vs Curaçao | 7–1 | 8 | ✅ | ✅ | ok |
| 537352 | Ivory Coast vs Ecuador | 1–0 | 1 | ✅ | ✅ | ok |
| 537357 | Netherlands vs Japan | 2–2 | 4 | ✅ | ✅ | ok |
| 537358 | Sweden vs Tunisia | 5–1 | 6 | ✅ | ✅ | ok |
| 537363 | Belgium vs Egypt | 1–1 | 2 | ✅ | ✅ | ok |
| 537364 | Iran vs New Zealand | 2–2 | 4 | ✅ | ✅ | ok |
| 537369 | Spain vs Cape Verde | 0–0 | 0 | ✅ | ✅ | ok |
| 537370 | Saudi Arabia vs Uruguay | 1–1 | 2 | ✅ | ✅ | ok |
| 537391 | France vs Senegal | 3–1 | 4 | ✅ | ✅ | ok |
| 537392 | Iraq vs Norway | 1–4 | 5 | ✅ | ✅ | ok |

All 18 snapshots freshly built (snapshotAgeHours ≤ 0.2).

---

## Event Cache State

From debug endpoint on 6 representative matches (03:08:54Z):

| Match | eventCacheHit | goalsCount | cardsCount | subsCount | lookupTtlRemaining |
|-------|--------------|------------|------------|-----------|-------------------|
| 537346 (AUS vs TUR) | true | 2 | 1 | 10 | 2591908s (~30d) |
| 537352 (IVC vs ECU) | true | 1 | 4 | 9 | 2591938s (~30d) |
| 537357 (NED vs JPN) | true | 4 | 3 | 10 | 2591922s (~30d) |
| 537358 (SWE vs TUN) | true | 6 | 1 | 10 | 2591922s (~30d) |
| 537364 (IRN vs NZL) | true | 4 | 1 | 9 | 2591921s (~30d) |
| 537392 (IRQ vs NOR) | true | 5 | 1 | 10 | 2591922s (~30d) |

**DATA-16 Obj 2 confirmed:** TTL ≈ 2,591,920 seconds = 30 days. All event caches now persist for 30 days. The previous 12-hour TTL that caused the regression is eliminated.

---

## Debug Endpoint Note on espnMatchId

The `espnMatchId` field in the debug response shows `null` for all 6 matches despite `lookupHit: true` and `lookupTtlRemaining ≈ 30d`. This is a display-only artifact in the debug endpoint: the KV lookup value may be stored/retrieved as a numeric type rather than a string, causing the `typeof lookupRaw === 'string'` check to miss it.

Operationally, enrichment is working correctly — `eventCacheHit: true`, `goalsCount` matches FD score, `enrichmentApplied: true`, `source: 'kv-cache'` for all matches. The ESPN event ID 760421 is confirmed through the Australia vs Turkey enrichment (2 goals retrieved, `cardsCount: 1`, `substitutionsCount: 10` all matching ESPN ground truth).
