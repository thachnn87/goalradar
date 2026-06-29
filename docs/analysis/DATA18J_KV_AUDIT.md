# DATA-18J Phase 2 — Live Production KV Audit

Date: 2026-06-17 (captured ~17:00–17:02 UTC)
Source: `https://www.goalradar.org` debug endpoints (Bearer `CRON_SECRET`)

**AUDIT ONLY. No fixes. Values are live production reads.**

---

## Primary snapshot — `goalradar:match:{id}`

(from `/api/debug/espn-enrichment/{id}`, `/api/debug/match-state/{id}`, `/api/debug/enrichment-health`)

| Match | status | score | goals | cards | subs | lineups | enrichmentApplied |
|-------|--------|-------|-------|-------|------|---------|-------------------|
| 537328 SKorea–Czechia | FINISHED | 2–1 | **0** | **0** | **0** | absent | **false** |
| 537351 | FINISHED | 7–1 | **0** | — | — | absent | **false** |
| 537391 | FINISHED | 3–1 | **0** | — | — | absent | **false** |
| 537392 | FINISHED | 1–4 | **0** | — | — | absent | **false** |
| 537397 | FINISHED | 3–0 | **0** | — | — | absent | **false** |

> Score is correct on every snapshot (FD-sourced). Every events array is empty.
> `enrichmentApplied` is the endpoint's derived flag `goals.length > 0`.

---

## DR snapshot — `goalradar:dr:match:{id}`

Not directly dumped, but inferred from the **DR poison guard** (`writeDRSnapshot`, match-snapshot.ts:333):
the guard **refuses to write** a FINISHED snapshot with `score>0 && goals=0`. Therefore the DR key is
either **absent** for these matches or holds a previously-enriched copy. The `match-state/537328`
diagnosis shows no DR rescue occurred. (A dedicated DR dump endpoint does not exist; flagged for Phase 5.)

---

## AF cache — `goalradar:af:events:{id}` + lookup `goalradar:af:lookup:WC:2026`

(from `/api/debug/hybrid-enrichment/{id}`) — **identical for all 5 matches:**

| Field | Value |
|-------|-------|
| `enrichmentEnabled` | true |
| `apiFootballKeySet` | true |
| `lookupTablePresent` | **false** |
| `lookupTableEntries` | **0** |
| `afFixtureId` | **null** |
| `eventsCachePresent` | **false** |
| `source` | **`lookup-miss`** |
| `enrichmentApplied` | false |

➡ **The AF fixture-ID lookup table is absent in production.** AF enrichment can never resolve a fixture ID, so it always returns the match unenriched (`lookup-miss`). The AF events cache was never populated.

---

## ESPN cache — `goalradar:espn:event:{id}`

(from `/api/debug/espn-enrichment/{id}`) — **the events DO exist:**

| Match | eventCacheHit | goals | cards | subs | cache age | snapshotGoals |
|-------|---------------|-------|-------|------|-----------|---------------|
| 537328 | **true** | **3** | **1** | **9** | ~13.9 h | 0 |
| 537351 | **true** | **8** | 0 | **8** | ~13.9 h | 0 |
| 537391 | **true** | **4** | 0 | **7** | ~13.9 h | 0 |
| 537392 | **true** | **5** | **1** | **10** | ~13.9 h | 0 |
| 537397 | **true** | **3** | 0 | **10** | ~13.5 h | 0 |

➡ **ESPN has the complete events for every match, cached ~14 h ago**, yet **none of it is in the primary snapshot** (`snapshotGoalsCount = 0`).

---

## The contradiction

For all 5 matches:

```
ESPN event cache  : goals 3–8 present  (goalradar:espn:event:{id}, ~14h old)
Primary snapshot  : goals 0            (goalradar:match:{id})
```

The enrichment data is **retrievable and already cached** — it simply was never merged into the
persisted snapshot the page renders. See Phase 5 for the per-match side-by-side and root cause.
