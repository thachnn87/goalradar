# DATA-17.1 Phase 3 — Event Enrichment Regression Root Cause
## Why Older Finished Matches Lost Goals / Cards / Subs / Lineups

Date: 2026-06-17  
Status: Root cause identified — design only, no code changes.

---

## 1. Affected Symptom

**Symptom #5:** Older finished WC matches show no goals, cards, substitutions, or lineups on
their `/match/[id]` pages, even though the score (e.g., 3-1) is correct.

**Symptom #6 (contrast):** Austria vs Jordan (recent) still has scorer enrichment. This
confirms the regression is time-dependent, not structural.

---

## 2. Enrichment Guard (code reference)

`src/lib/match-snapshot.ts` — `assembleSnapshot()`:

```typescript
const needsEnrichment =
  status === 'FINISHED' &&
  competition.code === 'WC' &&
  (match.goals?.length ?? 0) === 0;
```

Enrichment is only attempted when `goals.length === 0` in the FD match data. Once a snapshot
is written WITH goals, subsequent snapshot reads return it cached — no re-enrichment ever runs.
This is correct by design (idempotency). The problem is when a snapshot is written WITHOUT
goals and then pinned.

---

## 3. Full Overwrite Path — Regression Scenario

### Step-by-step for an older group stage match (e.g., kicked off 8+ days ago):

```
Day 0 (match day)
──────────────────
① Match finishes (e.g., 3-1). FD API returns status=FINISHED.
② Cron writes FINISHED feed to KV within 30 min.
③ First visitor opens /match/{id}.
   → buildSnapshot() runs.
   → needsEnrichment = true (goals.length=0 in FD data).
   → enrichMatchWithEspnEvents() called.
   → goalradar:espn:event:{espnId} is cold.
   → ESPN API called: event data EXISTS (match just finished, data available).
   → Goals, cards, subs applied. goals.length = 3.
   → writeKVSnapshot():
       - Writes goalradar:match:{id}        with 7-day TTL   ← primary snapshot
       - Writes goalradar:dr:match:{id}     with 30-day TTL  ← DR key, goals.length=3

Day 7 (snapshot TTL expires)
──────────────────────────────
④ goalradar:match:{id} TTL expires. KV returns null on next read.
⑤ goalradar:espn:event:{espnId} expired 6 times already (12-h TTL × 6 = 3 days).
   Current state: cold (no cached event data).

⑥ Visitor opens /match/{id}.
   → buildSnapshot() runs (KV miss).
   → needsEnrichment = true (FD match data still has goals.length=0).
   → enrichMatchWithEspnEvents() called.
   → ESPN API called: event data NOW EMPTY or unavailable.
      (ESPN stops serving detailed timeline data for group stage matches
       after ~72h, or returns a trimmed event with lineups only, no goals)
   → goals remain []. goals.length = 0.
   → writeKVSnapshot():
       Downgrade guard fires:
       → checks goalradar:dr:match:{id}
       → DR EXISTS and HAS goals (written on Day 0) ← DR TTL is 30 days
       → ABORT write → does not overwrite with 0-goal snapshot

Result: DR copy served as fallback. Should protect the match.
```

### BUT: The downgrade guard is only effective if the DR key has goals.

The regression occurs via a DIFFERENT path:

---

## 4. Regression Path — First Build Without Enrichment

```
Day 0 (match day, alternate scenario)
──────────────────────────────────────
① Match finishes. Cron writes FINISHED feed.
② First visitor opens /match/{id}.
   → buildSnapshot() runs.
   → needsEnrichment = true.
   → enrichMatchWithEspnEvents() called.
   → ESPN ID lookup: goalradar:espn:lookup:{fdId} — MISSING.
      (ESPN ID mapping not yet populated for this match; mapping cron runs separately)
   → enrichment SKIPPED (no ESPN ID found).
   → goals.length = 0.
   → writeKVSnapshot():
       Downgrade guard: score.fullTime.home = 3, goals.length = 0 → checks DR.
       DR key: goalradar:dr:match:{id} → MISSING (first ever build).
       → guard does NOT abort → WRITES 0-goal snapshot.
       - Writes goalradar:match:{id}        with 7-day TTL  ← 0 goals
       - Writes goalradar:dr:match:{id}     with 30-day TTL ← 0 goals (poisoned DR!)

Day 0+N (ESPN ID lookup populated, e.g., via prewarm cron)
────────────────────────────────────────────────────────────
③ goalradar:espn:lookup:{fdId} is now populated.
   BUT: goalradar:match:{id} is still alive (7-day TTL). No rebuild triggered.
   Snapshot serves 0 goals. Enrichment never re-runs on a HIT.

Day 7 (snapshot TTL expires)
──────────────────────────────
④ goalradar:match:{id} TTL expires.
⑤ New visitor → buildSnapshot() → needsEnrichment = true.
   → enrichMatchWithEspnEvents() → ESPN ID found this time!
   → ESPN API called. Event data may be EMPTY (>7 days old match).
   → goals.length = 0.
   → writeKVSnapshot():
       Downgrade guard: checks goalradar:dr:match:{id}.
       DR exists BUT has 0 goals (poisoned in step ②).
       → guard does NOT abort (DR also has 0 goals — no protection).
       → Writes another 0-goal snapshot. 30-day poisoned DR persists.
```

**This is the confirmed root cause for Symptom #5.**

The DR key is "poisoned" when the FIRST snapshot build skips enrichment (ESPN ID not yet
mapped) and writes `goals=[]` to both the primary key AND the DR. Once poisoned, the DR
does not protect against future 0-goal rebuilds — because the DR ITSELF has 0 goals.

---

## 5. Secondary Path — ESPN Event API Returns Empty

Even when the ESPN ID IS present, ESPN's event API returns empty timeline data for matches
older than approximately 72 hours. This is an external API behavior, not a code bug.

```
Day 3+ (snapshot rebuild, ESPN ID exists)
──────────────────────────────────────────
enrichMatchWithEspnEvents()
  → goalradar:espn:event:{espnId}: MISS (12-h TTL expired)
  → ESPN API: fetch /sports/soccer/events/{espnId}
      → Returns: { competitors: [...], status: { type: 'STATUS_FINAL' } }
      → timeline: []  (ESPN purges or stops serving timelines after ~72h)
  → goals extracted from timeline: []
  → Enrichment "succeeded" (no error) but goals = []
  → needsEnrichment guard: goals.length === 0 → writes snapshot with 0 goals
```

This secondary path affects all matches 72+ hours old whose snapshots rebuild after Day 3.

---

## 6. Enrichment Timeline for a Typical Group Stage Match

| Time from kickoff | ESPN ID | ESPN event data | Expected enrichment outcome |
|-------------------|---------|-----------------|----------------------------|
| 0–1 h | maybe missing | Full timeline available | MISS if ID not mapped yet |
| 1–12 h | usually present | Full timeline available | SUCCESS |
| 12–72 h | present | Full timeline available | SUCCESS (if snapshot rebuild) |
| 72 h+ | present | Timeline empty or absent | FAIL — 0 goals written |
| 7 d (snapshot TTL) | present | Empty | FAIL unless DR has goals |

**Austria vs Jordan** (Symptom #6): match was recent. ESPN ID was available within 1h.
Snapshot built with enrichment. Still in primary 7-day TTL window. No rebuild yet.

**Older group stage matches** (Symptom #5): 7+ days old. Snapshot rebuilt after ESPN
timeline purged. DR may be poisoned (built before ESPN ID was available). Result: 0 goals.

---

## 7. The `writeKVSnapshot` Downgrade Guard — Exact Behaviour

```typescript
// src/lib/match-snapshot.ts — writeKVSnapshot()
if (snapshot.match.goals?.length === 0 && scoredFinishedMatch) {
  const drKey = `goalradar:dr:match:${id}`;
  const existing = await kv.get<MatchSnapshot>(drKey);
  if (existing && (existing.match.goals?.length ?? 0) > 0) {
    console.log(`[Snapshot] DOWNGRADE-GUARD ${id}: DR has ${existing.match.goals.length} goals — skipping write`);
    return;
  }
}
```

**Guard fires when:** about to write snapshot with 0 goals AND FD score > 0 AND FINISHED  
**Guard succeeds when:** DR key exists AND DR snapshot has goals > 0  
**Guard fails when:** DR is missing OR DR also has 0 goals

---

## 8. Prewarm Cron and ESPN ID Population

`src/app/api/cron/prewarm-worldcup/route.ts` — the prewarm cron populates ESPN ID lookups.

If the prewarm cron runs AFTER the first snapshot build for a given match, the first snapshot
was built without the ESPN ID → 0-goal snapshot + 0-goal DR key. The prewarm cron does NOT
invalidate existing snapshots; it only populates the lookup table. Once the lookup is populated
but the snapshot is pinned (within 7-day TTL), the enrichment cannot run until TTL expires.

**This creates a race condition:**
```
Match finishes → buildSnapshot() runs immediately (page visit) → ESPN ID not yet mapped → 0-goal snapshot
                           ↑
     Prewarm cron fires (minutes/hours later) → ESPN ID now in KV
                           ↓
                  But snapshot TTL is 7 days → no rebuild → user sees no goals for 7 days
```

---

## 9. Summary

| Root cause | Mechanism | Affected matches |
|------------|-----------|-----------------|
| ESPN ID not mapped at first build | Prewarm cron race condition | Matches visited within first ~1h of finish |
| ESPN timeline empty on rebuild | ESPN API purges timelines after ~72h | Matches rebuilt after Day 3 |
| Poisoned DR key (0 goals) | First build without enrichment writes DR with 0 goals | Both of the above |
| Downgrade guard cannot protect | Guard requires DR to have goals; poisoned DR has none | Any match with poisoned DR |

**Net effect:** Group stage matches (kicked off 7+ days ago) whose snapshots have been rebuilt
at least once since their ESPN timelines were purged will show no goals/cards/subs, even though
the score is correct on the page (score comes from FD, not ESPN).
