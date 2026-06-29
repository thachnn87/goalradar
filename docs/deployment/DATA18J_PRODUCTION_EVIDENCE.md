# DATA-18J Phase 5 — Production Evidence (537328)

Date: 2026-06-17, captured ~17:00–17:03 UTC
Source: live `https://www.goalradar.org`

**AUDIT ONLY. Live production reads.**

---

## Side-by-side — 537328 South Korea vs Czechia

| Layer | Source | status | score | goals | cards | subs | lineups |
|-------|--------|--------|-------|-------|-------|------|---------|
| **FD detail** `goalradar:/matches/537328` | football-data.org | FINISHED | 2–1 (winner HOME) | (FD omits) | (FD omits) | (FD omits) | (FD omits) |
| **Primary snapshot** `goalradar:match:537328` | what page renders | FINISHED | **2–1** | **0** | **0** | **0** | **absent** |
| **ESPN events cache** `goalradar:espn:event:537328` | ESPN | — | — | **3** | **1** | **9** | present |
| **AF events cache** `goalradar:af:events:537328` | api-football | — | — | absent (`lookup-miss`) | absent | absent | absent |
| **Rendered page** `/match/537328` | browser | shows 2–1 | **2–1 ✅** | **none ❌** | **none ❌** | **none ❌** | **none ❌** |

---

## Raw captures

### `/api/debug/match-state/537328`
```
liveKVStatus   : NOT_IN_LIVE_CACHE
detailStatus   : FINISHED   detailScore.fullTime : { home: 2, away: 1 }   detailAgeMs ~1.03M (~17m)
snapshotStatus : FINISHED   snapshotScore.fullTime: { home: 2, away: 1 }   snapshotAgeMs ~1.03M (~17m)
diagnosis      : Match is not in live cache. No overlay needed.
```

### `/api/debug/hybrid-enrichment/537328` (AF)
```
lookupTablePresent: false   lookupTableEntries: 0   afFixtureId: null
eventsCachePresent: false   snapshotGoalsCount: 0   enrichmentApplied: false   source: lookup-miss
```

### `/api/debug/espn-enrichment/537328`
```
lookupHit: true   eventCacheHit: true   eventCacheAgeSeconds: 50078 (~13.9h)
goalsCount: 3   cardsCount: 1   substitutionsCount: 9          ← ESPN cache HAS events
snapshotGoalsCount: 0   enrichmentApplied: false   source: kv-cache   ← snapshot does NOT
```

### Rendered `/match/537328` (initial HTML, 16,868 bytes)
```
"South Korea" present ............ yes
2–1 score present ................ yes
Goals section .................... ABSENT  (GoalsSection returns null on empty goals)
Substitutions section ............ ABSENT
Lineups section .................. ABSENT
```

---

## What the timestamps prove

- ESPN events for 537328 have been **cached ~14 h** (`eventCacheAgeSeconds ≈ 50,078`, lookup TTL remaining ≈ 29.4 d of 30 d → resolved ~14 h ago).
- The primary snapshot was **(re)built ~17 min ago** (`snapshotAgeMs ≈ 1.03M`) and **still has `goals=0`**.

➡ A snapshot build that ran **~14 h after** the ESPN events were already cached **did not merge them**.
The data was sitting in `goalradar:espn:event:537328` (goals=3) and the freshly-written snapshot
remained unenriched. The events are not missing from the platform — they are missing **from the
snapshot the page reads**.

---

## All 5 matches — same pattern

| Match | snapshot score | snapshot goals | ESPN cache goals/cards/subs |
|-------|---------------|----------------|------------------------------|
| 537328 | 2–1 | 0 | 3 / 1 / 9 |
| 537351 | 7–1 | 0 | 8 / 0 / 8 |
| 537391 | 3–1 | 0 | 4 / 0 / 7 |
| 537392 | 1–4 | 0 | 5 / 1 / 10 |
| 537397 | 3–0 | 0 | 3 / 0 / 10 |

Score correct everywhere; events present in ESPN cache everywhere; **snapshot goals=0 everywhere**.
