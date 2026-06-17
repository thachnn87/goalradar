# DATA-18A Validation
## Current vs Future Data Paths — 4 Benchmark Matches

Date: 2026-06-17
Status: Design document — future paths are targets, not yet implemented.

---

## Benchmark Matches

| fdMatchId | Fixture | Status | Score |
|-----------|---------|--------|-------|
| 537397 | Argentina vs Algeria | FINISHED | 3–0 |
| 537392 | Iraq vs Norway | FINISHED | 1–4 |
| 537391 | France vs Senegal | FINISHED | 3–1 |
| 537351 | Germany vs Curaçao | FINISHED | 7–1 |

All 4 are FINISHED WC 2026 group-stage matches with ESPN enrichment confirmed
(enrichmentApplied=true per DATA-16C production validation).

---

## Match 537397 — Argentina vs Algeria

### Current path (S0, DATA-17 deployed)

```
User visits /world-cup-2026 (Hub)
      ↓
getWCAuthorityMatches()
      → getWCAuthorityMatchesCached()
            ↓
      [1] getUpcomingMatchesCached('WC')
            → kv.get('goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED')
            → Returns 537397 as TIMED (stale pre-kickoff entry OR absent post-tournament)
      [2] getWCResultsCached()
            → kv.get('goalradar:/competitions/WC/matches?status=FINISHED')
            → Returns 537397 as FINISHED, score={3,0}
            → STATE_RANK[FINISHED=3] > STATE_RANK[TIMED=0] → 537397=FINISHED wins
      [3] getWCLiveMatches()
            → kv.get('goalradar:live:matches')
            → 537397 absent (not live)
            ↓
      overlayMatchStates([...byId.values()])
            → kv.mget('goalradar:match:537397', ...)
            → Snapshot present: status=FINISHED, score={3,0}, goals=[Messi 17'/60'/76']
            → STATE_RANK[FINISHED=3] >= STATE_RANK[FINISHED=3] → status unchanged
            → Goals/cards/subs applied from snapshot
            ↓
      Returns Match: id=537397, status=FINISHED, score={3,0}, goals=[...]
            ↓
classifyMatchState(m, today) → 'finished'
            ↓
Hub renders: "Argentina 3 – Algeria 0 FT" in Recent Results
```

**KV reads:** 3 bulk + 104 mget (shared across all matches) = effectively 4 round-trips

### Future path (S4, authority cache active)

```
User visits /world-cup-2026 (Hub)
      ↓
getWCAuthorityMatches()
      → readAuthorityCache()
            → kv.get('goalradar:wc:authority:v1')
            → HIT: CanonicalMatch[] containing id=537397
                  state='finished'
                  score={fullTime:{home:3,away:0}}
                  goals=[{minute:17,scorer:{name:'L. Messi'},...}, ...]
                  enrichmentApplied=true
                  source={fdBulkFeed:'results', snapshot:{enrichedAt:'...', enrichmentSource:'espn'}}
            ↓
      Returns CanonicalMatch: id=537397, state='finished', score={3,0}
            ↓
Hub renders: m.state === 'finished' → "Argentina 3 – Algeria 0 FT" in Recent Results
```

**KV reads:** 1 read — `goalradar:wc:authority:v1`

### Field ownership trace for 537397

| Field | Source in current path | Source in future path |
|-------|----------------------|----------------------|
| `id` | FD bulk feed | FD via `buildCanonicalMatch(fdMatch.id)` |
| `score` | FD results feed (`getWCResultsCached`) | FD results feed via merge engine |
| `goals` | snapshot `goals` (ESPN-enriched) | snapshot `goals` via `buildCanonicalMatch` |
| `state` | `classifyMatchState(m.status, today)` in page | `buildCanonicalMatch` → `deriveState()` stored at cache write time |
| `enrichmentApplied` | not a field on `Match` (implicit) | explicit `CanonicalMatch.enrichmentApplied=true` |

---

## Match 537392 — Iraq vs Norway

### Current path

```
getWCAuthorityMatchesCached()
      ↓
[2] getWCResultsCached() → 537392 FINISHED, score={1,4}
      → STATE_RANK[FINISHED=3] > TIMED: 537392=FINISHED
      ↓
overlayMatchStates()
      → kv.mget('goalradar:match:537392')
      → Snapshot: status=FINISHED, score={1,4}, goals=[Iraq scorer, 4×Norway scorers]
      → Goals applied
      ↓
Match: id=537392, status=FINISHED, score={1,4}, goals=[...]
      ↓
classifyMatchState → 'finished'
```

### Future path

```
readAuthorityCache()
      → kv.get('goalradar:wc:authority:v1')
      → CanonicalMatch: id=537392, state='finished', score={1,4}, goals=[...]
      → enrichmentApplied=true
```

### Notable: no group page dependency

537392 (Iraq vs Norway) is Group E. The current group page `/world-cup-2026/group-e`
uses `getWCAuthorityMatches()` (DATA-17), so it already reads 537392 from the same
source. Future path is identical — one authority cache read, group filter applied.

---

## Match 537391 — France vs Senegal

### Current path

```
getWCAuthorityMatchesCached()
      ↓
[2] getWCResultsCached() → 537391 FINISHED, score={3,1}
      ↓
overlayMatchStates()
      → kv.mget('goalradar:match:537391')
      → Snapshot: status=FINISHED, score={3,1}, goals=[3×France, 1×Senegal]
      ↓
Match: id=537391, status=FINISHED, score={3,1}, goals=[...]
```

### Future path

```
readAuthorityCache()
      → CanonicalMatch: id=537391, state='finished', score={3,1}, goals=[...], enrichmentApplied=true
```

### Consistency note

On the current path, `statusBadge(m)` in the Results page reads `m.status` directly
(not `classifyMatchState`). For this match: `m.status === 'FINISHED'` → label 'FT'. This
will remain correct on the future path: `m.state === 'finished'` → same label.

---

## Match 537351 — Germany vs Curaçao

### Current path

```
getWCAuthorityMatchesCached()
      ↓
[2] getWCResultsCached() → 537351 FINISHED, score={7,1}
      ↓
overlayMatchStates()
      → kv.mget('goalradar:match:537351')
      → Snapshot: status=FINISHED, score={7,1}, goals=[7×Germany, 1×Curaçao]
      ↓
Match: id=537351, status=FINISHED, score={7,1}
```

### Future path

```
readAuthorityCache()
      → CanonicalMatch: id=537351, state='finished', score={7,1}, goals=[...], enrichmentApplied=true
```

### High-score stress test

537351 has 8 goals — the highest-scoring match in the benchmark set. Verifying that
the merge engine correctly populates all 8 `goals[]` entries (ESPN reconciled to FD team
IDs per DATA-14A) is the primary validation point for this match in S2.

---

## Summary Comparison

| Match | Current KV reads | Future KV reads | field `state` | field `goals` |
|-------|-----------------|----------------|--------------|--------------|
| 537397 | 4 (3 bulk + 1 in mget batch) | 1 (authority cache) | implicit (classifyMatchState) | from snapshot.goals |
| 537392 | 4 | 1 | implicit | from snapshot.goals |
| 537391 | 4 | 1 | implicit | from snapshot.goals |
| 537351 | 4 | 1 | implicit | from snapshot.goals |

The "4 KV reads" figure is per-page — all 5 WC pages sharing the same ISR window
would trigger up to 4 reads each if they hit cold. In practice, Vercel caches ISR
responses in the Edge, but the KV reads still happen on the first request per region.

With the authority cache, all 5 pages share a single `kv.get` per region per TTL window.

---

## Validation Gate for Each Stage

### S2 shadow validation (per match)

For all 4 matches, old and new paths must produce identical:
- `score.fullTime.home` and `score.fullTime.away`
- `goals.length`
- `goals[i].scorer.name` (all entries)
- `goals[i].team.id === fdMatch.homeTeam.id || fdMatch.awayTeam.id` (team ID reconciliation)

### S3 Results page opt-in

Visual check: `/world-cup-2026-results` shows all 4 matches with correct scores
and FT badge. Compare against Hub page (still on old path) — must be identical.

### S4 full cutover

All 4 matches visible on Hub, Results, and respective Group pages with correct scores.
Cross-check: Hub "Recent Results" section and Results page must show identical lists
(same source now).
