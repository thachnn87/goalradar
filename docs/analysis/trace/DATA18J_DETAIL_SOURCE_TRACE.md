# DATA-18J Phase 1 — Match Detail Page Source Trace

Date: 2026-06-17
Match traced: **537328 — South Korea vs Czechia (2–1)**

**AUDIT ONLY. No fixes.**

---

## Complete data path

```
src/app/match/[id]/page.tsx
        │  generateMetadata()  → getOrBuildMatchSnapshot(id)   (page.tsx:61)
        │  MatchDetailPage()    → getOrBuildMatchSnapshot(id)   (page.tsx:2107)
        │  BelowTheFoldDeferred → getOrBuildMatchSnapshot(id)   (page.tsx:2274)
        │      (all three share one React.cache() promise)
        ▼
getOrBuildMatchSnapshot(matchId)            src/lib/match-snapshot.ts:602
        │
        ├─ 1. readKVSnapshot(matchId) ──► KV GET goalradar:match:{id}
        │        if HIT → return as-is (NO re-enrichment)        :607-612
        │
        └─ 2. on MISS → buildSnapshot(matchId)                   :386
                 ├─ readMatchDetailFromKV → KV goalradar:/matches/{id}
                 │        else getMatchDetail(id) → football-data.org (FD)
                 │
                 ├─ needsEnrichment = FINISHED && competition.code==='WC'
                 │                    && goals.length===0          :404
                 │   ├─ AF:   enrichMatchWithAFEvents(match)        :410
                 │   │        KV goalradar:af:events:{id}  ← api-football
                 │   └─ ESPN: enrichMatchWithEspnEvents(match)      :415
                 │            KV goalradar:espn:event:{id} ← ESPN
                 │
                 └─ writeKVSnapshot (goalradar:match:{id}, 7d TTL for FINISHED)
                    writeDRSnapshot (goalradar:dr:match:{id}, 30d TTL)
```

---

## Render binding

The page renders **`snapshot.match`** (type `MatchDetail`) — never the authority cache.

| Section | Component | Field read | File:line |
|---------|-----------|-----------|-----------|
| Goals | `GoalsSection` | `match.goals` | match-snapshot render `page.tsx:716` |
| Cards | `BookingsSection` | `match.bookings` | `page.tsx:762` |
| Subs | `SubstitutionsSection` | `match.substitutions` | `page.tsx:801` |
| Lineups | `LineupsSection` | `match.lineups` | `page.tsx:909` |

Each section **returns `null` when its array is empty** (e.g. `if (!goals.length) return null`). `LineupsSection` renders "not available from the current data provider" when `match.lineups` is null.

---

## KV keys on the path

| Key | Purpose | TTL |
|-----|---------|-----|
| `goalradar:match:{id}` | **Primary snapshot** (what the page renders) | FINISHED = 7 days |
| `goalradar:dr:match:{id}` | Disaster-recovery snapshot | 30 days |
| `goalradar:/matches/{id}` | FD match detail (score, no events) | 7 days |
| `goalradar:af:events:{id}` | api-football events cache | 7 days |
| `goalradar:espn:event:{id}` | ESPN events cache | 30 days |
| `goalradar:af:lookup:WC:2026` | AF fixture-ID lookup table | 24 h |
| `goalradar:espn:lookup:{id}` | ESPN event-ID lookup | 30 days |

---

## Providers

- **Score / status / teams / competition** → football-data.org (FD). FD free tier **omits events** (goals/cards/subs/lineups).
- **Events (goals/cards/subs/lineups)** → enrichment layer: **api-football first**, **ESPN fallback**, merged into `MatchDetail` at build time only.

---

## Key structural fact

`getOrBuildMatchSnapshot` **short-circuits on a KV snapshot hit** (match-snapshot.ts:607-612) and returns it verbatim. Enrichment runs **only inside `buildSnapshot`** — i.e. only on a cache MISS. Once a FINISHED snapshot is persisted, it is pinned for 7 days and is **never re-enriched on read**, regardless of whether the AF/ESPN event caches later become populated.

The Match Detail Page does **not** import or call `getWCAuthorityMatchesV2`, `readAuthorityCache`, or `getWCAuthorityMatches`. (`git grep` in `match/[id]/page.tsx` → no matches.)
