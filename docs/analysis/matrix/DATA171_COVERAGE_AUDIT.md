# DATA-17.1 Phase 2 — Coverage Audit
## Finished WC Matches: Visibility, Snapshot, and Enrichment Status

Date: 2026-06-17  
Status: Static code audit — live KV state not readable from this environment.

---

## 1. Audit Methodology

This audit derives which finished matches are visible on each page by tracing the data path
from KV keys through to display filters. It cannot enumerate live KV state; the matrix below
documents the CODE CONDITIONS under which each field can be populated.

**Coverage is determined by:**
1. Whether the match appears in `goalradar:/competitions/WC/matches?status=FINISHED` (FINISHED feed)
2. Whether a snapshot exists at `goalradar:match:{id}` (7-day TTL, 30-day DR)
3. Whether that snapshot has `goals.length > 0` (enrichment applied)
4. Whether the match passes `classifyMatchState(m, today) === 'finished'` on each page

---

## 2. Visibility Gate per Page

### Gate 1 — Results page (`/world-cup-2026-results`, revalidate 300 s)
```
getWCAuthorityMatchesCached()
  └─ getWCResultsCached()
       └─ readKVOnly('goalradar:/competitions/WC/matches?status=FINISHED')
            ├─ KV HIT  → returns all matches in the FINISHED feed at last cron write
            └─ KV MISS → returns { matches: [] }  ← no SWR trigger, no fallback
```

**A match appears on the Results page if and only if:**
- It is present in `goalradar:/competitions/WC/matches?status=FINISHED` at the time the
  Results page ISR fires, AND
- `classifyMatchState(m, today) === 'finished'` — i.e., status is FINISHED/FT/AET/PEN
  (these always return `'finished'` regardless of date)

**A match is ABSENT if:**
- The FINISHED KV key has not been updated since the match finished (cron delay ≤ 30 min)
- The FINISHED KV key has a stale-window hit but the SWR triggered by `getWCResults()` (the
  non-Cached variant) hasn't yet completed
- The KV key is entirely missing (first deploy, KV flush, or key expiry at stale window end
  12 h after last cron write)

---

### Gate 2 — Hub "Recent Results" section (revalidate 30 s)
Same FINISHED feed path as Results page; additionally filtered:
```
allAuthority.filter(m => classify(m) === 'finished').sort(...).slice(0, 10)
```
**A match is ABSENT if:**
- Same conditions as Results page, OR
- More than 10 matches are in the FINISHED feed and the match fell outside `slice(0, 10)`

---

### Gate 3 — Hub "Today's Matches" section
```
allAuthority.filter(m => classify(m) === 'today')
```
**A FINISHED match appears here if:**
- Its status in the authority merge is still SCHEDULED or TIMED (stale upcoming feed), AND
- Its `utcDate` is ≤ today (past kickoff), AND  
- No snapshot exists at `goalradar:match:{id}` with status FINISHED to override it

This is the root cause of Symptom #2 (see Phase 3 and Phase 4 documents).

---

### Gate 4 — Match Detail `/match/[id]` (revalidate 60 s)
```
getOrBuildMatchSnapshot(id)
  └─ reads goalradar:match:{id}
       ├─ HIT  → serve cached snapshot (may be up to 7 days old)
       └─ MISS → buildSnapshot()
```
**Score is correct if:**
- Snapshot exists AND was built after the match finished, OR
- Snapshot is missing (build triggered) AND FD match detail returns correct score

**Enrichment (goals/cards/subs) is present if:**
- Snapshot was built when `goals.length === 0` (triggering ESPN enrichment), AND
- `goalradar:espn:event:{espnId}` was populated at build time (12-h TTL)

---

## 3. Finished Match Coverage Matrix (Code-Derived)

The following columns are derivable from the code path. Actual match IDs and scores require
live KV inspection.

| Column | Source | Populated When |
|--------|--------|----------------|
| `inFinishedFeed` | `goalradar:/competitions/WC/matches?status=FINISHED` | Cron last wrote this key after match finished |
| `snapshotExists` | `goalradar:match:{id}` | Someone visited `/match/{id}` after match finished |
| `snapshotHasGoals` | snapshot.goals.length > 0 | ESPN enrichment succeeded at build time |
| `drSnapshotExists` | `goalradar:dr:match:{id}` | Written alongside snapshot, 30-day TTL |
| `drHasGoals` | dr snapshot.goals.length > 0 | DR written when enriched snapshot existed |
| `visibleOnResults` | `inFinishedFeed` = true AND classify = 'finished' | — |
| `visibleOnHub` | `inFinishedFeed` AND sort rank ≤ 10 | — |

---

## 4. Known Coverage Gaps

### Gap A — FINISHED feed incomplete (Symptom #3, #4)
The FINISHED feed at `goalradar:/competitions/WC/matches?status=FINISHED` is written by the
`wc-finished` orchestrator task. It has a **12-hour stale window** (DATA-16D intentional fix).

If the orchestrator ran when only 4 matches had finished, the KV key persists with 4 matches
for up to 12 h after subsequent matches finish. The `getWCResultsCached()` function uses
`readKVOnly` — it does NOT trigger SWR revalidation. Only the `getWCResults()` (non-Cached)
variant triggers SWR, and that variant is only called from the orchestrator itself (not pages).

**Practical gap window:** 0 to 30 minutes per match (time between match completion and next
cron run). With a 12-hour stale TTL and no page-triggered SWR, the gap is bounded by the
cron cadence, not the stale window. However if the cron fails or is delayed, the window grows.

### Gap B — Snapshot absent for bulk-feed pages
Authority-path pages (Hub, Results, etc.) use snapshot overlay to advance states. If no
snapshot exists for a FINISHED match, it relies purely on the FINISHED feed being populated.
There is no page-triggered snapshot build on these pages — only `/match/[id]` builds snapshots.

**Consequence:** A match that finished but has never been opened on its detail page may show
incorrect state on Hub/Results until the FINISHED feed is updated by cron.

### Gap C — Enrichment absent on older matches (Symptom #5)
Snapshots with 7-day TTL may be rebuilt when their TTL expires. The ESPN event cache
(`goalradar:espn:event:{espnId}`) has a 12-hour TTL. If both expire simultaneously:
- Snapshot rebuild runs
- ESPN event cache is cold → provider call for ESPN event data
- If ESPN provider returns empty (common for matches >72 h old) → `goals.length = 0`
- Downgrade guard checks `goalradar:dr:match:{id}` — if DR also unenriched → snapshot
  written with 0 goals, 7-day TTL

The DR copy may be unenriched if:
1. The match was first snapshotted before enrichment was possible (before ESPN ID mapping
   was populated), or
2. The DR was written at the same time as a 0-goal snapshot (bug: DR written before
   enrichment was attempted, or enrichment failed silently on first write)

### Gap D — `getRecentMatchesCached` vs `getWCResultsCached` in snapshot builds
Match Detail builds its snapshot using `getRecentMatchesCached('WC')` (date-scoped key
`/competitions/WC/matches?dateFrom=…&dateTo=…`) for `wcGroupMatches`, NOT `getWCResultsCached()`.

This date-scoped key:
- Rotates daily (key changes at midnight UTC)
- Has no DR fallback
- Only covers a 30-day window

**Consequence:** For the Match Detail page, group context (group standings within the
snapshot) may be incorrect if the date-scoped key is stale or crosses midnight, even when
the FINISHED feed is correct.

---

## 5. Enrichment Dependency Chain

```
Match finishes
    │
    ▼
getOrBuildMatchSnapshot(id) triggered (first /match/{id} visit)
    │
    ├─ 1. Read goalradar:match:{id}
    │       └─ HIT: return cached snapshot (enrichment state frozen at build time)
    │       └─ MISS: → buildSnapshot()
    │
    ├─ 2. Read goalradar:/matches/{id} (FD match detail)
    │       └─ Returns score from FD API (e.g., 3-1)
    │
    ├─ 3. needsEnrichment = (status=FINISHED && code=WC && goals.length===0)
    │
    ├─ 4. enrichMatchWithEspnEvents()
    │       ├─ Read goalradar:espn:lookup:{fdId}         [persistent]
    │       ├─ If found: read goalradar:espn:event:{espnId}  [12-h TTL]
    │       │     └─ HIT: apply goals/cards/subs from cached event
    │       │     └─ MISS: fetch from ESPN API
    │       │           └─ SUCCESS: cache event 12h, apply to snapshot
    │       │           └─ FAIL/EMPTY: goals remain []
    │       └─ If not found: skip enrichment
    │
    └─ 5. writeKVSnapshot()
            ├─ If goals.length > 0: write with 7-d TTL + DR (30 d)
            └─ If goals.length = 0 AND score.fullTime.home > 0:
                    └─ Downgrade guard: read goalradar:dr:match:{id}
                            ├─ DR has goals: ABORT write (protect enriched DR)
                            └─ DR empty/missing: WRITE 0-goal snapshot (gap!)
```

---

## 6. Summary of Observable Coverage Issues

| Symptom | Coverage dimension | Affected pages |
|---------|--------------------|----------------|
| Only 4 matches on Results | `inFinishedFeed` incomplete | Results, Hub recent results |
| Austria vs Jordan in "Today" | `classifyMatchState` incorrect for stale SCHEDULED | Hub |
| Older matches no enrichment | `snapshotHasGoals = false`, `drHasGoals = false` | Match Detail |
| Incorrect aggregate stats | `played = finishedResults.length` from incomplete feed | Results |
