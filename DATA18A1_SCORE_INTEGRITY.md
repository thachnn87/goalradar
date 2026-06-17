# DATA-18A.1 Score Ownership Integrity Review

Date: 2026-06-17
Reviewer: Architecture review — no code changes.
Verdict: **YELLOW** (one blocking issue, two actionable findings)

---

## 1. Score Entry Points — Where Score Enters the System

| Entry point | File | Score source | Writable? |
|-------------|------|-------------|-----------|
| FD bulk results feed | `api.ts:getWCResultsCached()` | `/competitions/WC/matches?status=FINISHED` — FD API response | Read-only KV |
| FD bulk upcoming feed | `api.ts:getUpcomingMatchesCached()` | `/competitions/WC/matches?status=SCHEDULED,TIMED` | Read-only KV |
| FD match detail | `match-snapshot.ts:buildSnapshot()` | `/matches/{id}` — FD API response | Read-only KV |
| Live cache | `live-cache.ts` → `refresh.ts` | Primary provider (live score during IN_PLAY) | Written every 30s |
| ESPN enrichment | `espn-id-map.ts:enrichMatchWithEspnEvents()` | ESPN does NOT provide score — only goals/cards/subs | Events only |
| Per-match snapshot | `match-snapshot.ts` | `MatchDetail.score` (from FD detail) + live overlay | Written at build time |

**ESPN confirmed non-owner of score.** `enrichMatchWithEspnEvents()` applies
`applyEspnEvents()` which populates `match.goals`, `match.bookings`, `match.substitutions`
and `match.lineups` — it never touches `match.score`. Verified at source.

---

## 2. Ownership Matrix

| Layer | Owns `score.fullTime`? | Owns `score.halfTime`? | Can overwrite prior score? |
|-------|----------------------|----------------------|--------------------------|
| FD bulk results feed | ✅ Primary | ✅ Primary | Yes — cron-refreshed every 12h |
| FD match detail | ✅ Same data | ✅ Same data | Yes — SWR-refreshed |
| Live cache | ✅ During IN_PLAY only | ❌ | Yes — 30s writes while live |
| Per-match snapshot | ✅ Copied from FD detail | ✅ Copied from FD detail | At snapshot build time only |
| ESPN enrichment | ❌ Never | ❌ Never | No — events only |
| AF enrichment | ❌ Never | ❌ Never | No — events only (dormant) |

---

## 3. Current Score Resolution — `mergeSnapshotState()` (`match-state-overlay.ts:53`)

```typescript
if (snapRank > listRank) {
  return { ...listMatch, status: snapMatch.status, score: snapMatch.score, ... };
}
if (snapRank === listRank && (snapMatch.status === 'IN_PLAY' || snapMatch.status === 'PAUSED')) {
  return { ...listMatch, score: snapMatch.score, ... };
}
```

**Observation:** When snapshot rank > list rank (e.g., snapshot says FINISHED, list
says TIMED), the snapshot score replaces the list score. This is correct: the
snapshot was built from the FD detail endpoint which has the same score as the
results feed.

**Observation:** When both are live (same rank), snapshot score replaces list
score — correct. The snapshot was built more recently from the live overlay.

**No ESPN path here.** `overlayMatchStates()` reads `snap?.match` which is a
`MatchDetail` — the match's score within the snapshot always came from FD (detail
or live cache). ESPN never touched it.

---

## 4. Proposed Score Resolution — `buildCanonicalMatch()` (`canonical-match.ts:234`)

```typescript
let score: CanonicalScore = fdMatch.score;
if (
  snapshot !== null &&
  resolvedStatus === 'FINISHED' &&
  snapshot.match.score?.fullTime?.home !== null
) {
  score = snapshot.match.score;
}
```

### Finding S-1: STALE SNAPSHOT CAN OVERWRITE CORRECTED FD SCORE — **BLOCKING**

**Scenario:** FD corrects a result after the snapshot was built. Example:
a match finishes 3-0 but VAR disallows a goal — official score becomes 2-0.
FD updates the results feed. The cron refreshes `goalradar:/competitions/WC/matches?status=FINISHED` to 2-0.
The per-match snapshot `goalradar:match:{id}` still shows 3-0 (7-day TTL,
built before the correction). The authority cache builder calls `buildCanonicalMatch(fdMatch[score=2-0], snapshot[score=3-0])`.

Result: `resolvedStatus === 'FINISHED'` AND `snapshot.match.score.fullTime.home !== null`
→ **snapshot score 3-0 wins**. The page shows the wrong score for up to 7 days.

**Root cause:** The condition checks only `!== null` on snapshot score, not
whether the snapshot is newer than the FD feed.

**Fix required before DATA-18B:** Add a timestamp guard:

```typescript
const snapTs   = snapshot.generatedAt;
const fdTs     = new Date(fdMatch.lastUpdated).getTime();
const snapIsNewer = snapTs > fdTs;

if (
  snapshot !== null &&
  resolvedStatus === 'FINISHED' &&
  snapshot.match.score?.fullTime?.home !== null &&
  snapIsNewer   // ← guard: only prefer snapshot if it's newer than FD feed
) {
  score = snapshot.match.score;
}
```

Without this guard, a stale snapshot becomes score authority for up to 7 days.

---

### Finding S-2: `enrichmentApplied` is ambiguous for genuinely 0-0 matches — MINOR

```typescript
enrichmentApplied: goals.length > 0 || cards.length > 0 || substitutions.length > 0,
```

This is `false` both when:
- The match was never enriched (no snapshot, or snapshot had no events)
- The match was enriched but the final score was genuinely 0-0 with no bookings/subs logged

A truly goalless match that was successfully enriched reads as unenriched. No
score is involved, but it means monitoring / alerting on `enrichmentApplied=false`
would false-positive on goalless matches.

**Fix (non-blocking):** Separate `enrichmentAttempted` (snapshot was present and had
enrichment logic run) from `enrichmentProducedEvents` (events were non-empty). The
current `enrichmentApplied` conflates both states.

---

### Finding S-3: Score not validated against goal count — INFORMATIONAL

If `score.fullTime.home = 3` but `goals.filter(g => g.team.id === homeTeam.id).length = 2`,
the canonical object contains internally inconsistent data. This can occur when:
- ESPN enrichment found only 2 of 3 goals
- A goal belongs to neither team (own goal logged against wrong team ID)

The current design has no check. This is tracked in PHASE 3 (Integrity Layer).

---

## 5. Can Score Be Downgraded?

| Scenario | Current path | Future path (buildCanonicalMatch) |
|----------|-------------|----------------------------------|
| FINISHED match, snapshot newer than FD | snapshot score applied | snapshot score applied ✅ |
| FINISHED match, snapshot older than FD (correction) | FD score applied (overlayMatchStates uses rank, not score timestamp) ✅ | **snapshot score applied** ❌ (S-1) |
| IN_PLAY match | live cache score applied | live cache score applied ✅ |
| TIMED match, snapshot shows FINISHED | snapshot score applied | snapshot score applied ✅ |
| FINISHED match, snapshot from IN_PLAY build | depends on snapshot.match.status | if snapshot.match.status=FINISHED: score applied; if IN_PLAY: condition fails, FD score used ✅ |

---

## 6. Stale Data Scenarios

| Scenario | Max staleness | Detection | Impact |
|----------|---------------|-----------|--------|
| FD score correction, snapshot not rebuilt | 7 days (snapshot TTL) | Manual only (no integrity check) | Wrong final score on all listing pages |
| Live cache stale (30s TTL miss) | 30s | `[LiveCache] MISS` log | Live score shows last-known (acceptable) |
| Snapshot built at IN_PLAY, FD score not yet final | 60s (IN_PLAY snapshot TTL guard prevents write) | — | Not a risk — isLiveStatus guard prevents writing live snapshots |
| Orchestrator delayed | 15–30 min | Monitoring | Latest results delayed, not wrong |

---

## 7. Recommendations

| Priority | Action | Stage |
|----------|--------|-------|
| **BLOCKING** | Fix S-1: add `snapIsNewer` guard to `buildCanonicalMatch()` score resolution | DATA-18A.2 or before DATA-18B |
| Medium | Address S-2: add `enrichmentAttempted` boolean to `CanonicalMatch` | S1 |
| Low | Address S-3: validate score vs goal count in `validateCanonicalMatch()` | S2 |
| Low | Document FD correction behaviour in operational runbook | Before S4 |

---

## 8. Verdict

**YELLOW — One blocking fix required before DATA-18B.**

Score ownership is structurally sound (ESPN never owns score, FD is the authority).
The one blocking issue (S-1) is in the proposed `buildCanonicalMatch()` score
resolution in `canonical-match.ts` — a timestamp guard is missing. This is a
dormant file today, so no production behaviour is affected now. But the fix must
land before S1 activates `buildCanonicalMatch()`.

The current production path (`overlayMatchStates` + `mergeSnapshotState`) does NOT
have this bug because it uses STATE_RANK (not score timestamp) to merge, and in
practice FD scores don't get corrected after the results feed publishes.
