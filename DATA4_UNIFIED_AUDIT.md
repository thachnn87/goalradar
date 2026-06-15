# DATA-4 Unified Match State Authority Audit
## GoalRadar · Sprint DATA-4 (follow-up)

Generated: 2026-06-15

---

## Observed production inconsistency

| Surface | Mexico vs SA status | Score shown |
|---------|-------------------|-------------|
| `/match/537327` | FINISHED ✅ | 2–0 FT ✅ |
| `/world-cup-2026-results` | FINISHED ✅ | 2–0 FT ✅ |
| `/world-cup-2026` | SCHEDULED ❌ | – – ❌ |
| `/world-cup-2026/fixtures` | SCHEDULED ❌ | – – ❌ |
| `/schedule?competition=WC` | SCHEDULED ❌ | – – ❌ |
| Fixture card row (compact) | no score rendered ❌ | — |
| MatchCard (full card) | SCHEDULED badge ❌ | – – ❌ |

---

## End-to-end trace — match 537327 (Mexico vs South Africa)

### Layer 1 — Raw KV feeds

| KV key | Status in feed | Score |
|--------|---------------|-------|
| `/competitions/WC/matches?status=SCHEDULED,TIMED` | **SCHEDULED** (stale — match finished) | null / null |
| `/competitions/WC/matches?dateFrom=...&dateTo=...` | **FINISHED** ✅ | 2 / 0 |
| `/competitions/WC/matches?status=FINISHED` | **FINISHED** ✅ | 2 / 0 |
| `goalradar:match:537327` | Variable (see Layer 2) | — |

The SCHEDULED/TIMED feed lags until the cron removes the finished match (up to one 15-min cycle). This is the root feed used by all stale surfaces.

### Layer 2 — Per-match snapshot (`goalradar:match:537327`)

State at time of problem:

| Scenario | Snapshot status | Why |
|----------|----------------|-----|
| User visits match page → snapshot built from provider | **FINISHED**, TTL 7d | Correct |
| Prewarm cron runs before snapshot built (snapshot null) | **SCHEDULED/TIMED**, TTL 60 s | State guard bypassed (null existingSnapshot) |
| Prewarm cron runs after 60 s TIMED snapshot expires | **null** | 60 s TTL expired |
| Prewarm cron reruns while FINISHED snapshot exists | **FINISHED** (kept) | State guard blocks regression |

### Layer 3 — `overlayMatchStates()` on upcoming feed

When `kv.mget('goalradar:match:537327')` returns **null or TIMED**:
- `mergeSnapshotState`: `snapRank (0) > listRank (0)` → false → **no advance**
- Output: SCHEDULED, null score ← **this is the bug**

When `kv.mget` returns **FINISHED**:
- `mergeSnapshotState`: `snapRank (3) > listRank (0)` → true → advances to FINISHED 2–0 ✅

### Layer 4 — Page section routing

| Page | Section routing | Problem |
|------|----------------|---------|
| Homepage (`page.tsx`) | DATA-3 stray routing: FINISHED from upcoming → finishedStrays → wcResults | Resilient but still depended on overlay working |
| WC hub (`world-cup-2026/page.tsx`) | **No stray routing** — `todayMatches` = allUpcoming filtered by date, no status check | FINISHED with SCHEDULED badge could land in "Today's Matches" |
| Fixtures (`world-cup-2026/fixtures/page.tsx`) | All upcoming, no status filter | FINISHED would appear in fixture list if overlay worked |
| Schedule (`schedule/page.tsx`) | All upcoming, no status filter | Same as fixtures |

### Layer 5 — MatchCard rendering

```
const showScore = status === 'FINISHED' || status === 'IN_PLAY' || status === 'PAUSED';
score: showScore ? score.fullTime.home : null  // renders '–' when null
```

MatchCard is **correct** — it shows '–' for SCHEDULED (no score yet) and the actual score for FINISHED. The bug is upstream: the `status` prop is wrong (SCHEDULED when it should be FINISHED).

### Layer 6 — Fixture row renderer (compact card)

```tsx
<span className="text-gray-600 text-xs shrink-0 font-mono">vs</span>
```

**Always renders "vs"** regardless of match status — never shows score. Separate bug from the overlay failure; would persist even if overlay worked.

---

## Root cause summary

Two independent failures:

### Failure A — Overlay dependency on per-match snapshots

`getUpcomingMatchesCached('WC')` reads only the `SCHEDULED,TIMED` KV feed. The `overlayMatchStates()` call bridges this gap using per-match snapshots (`goalradar:match:{id}`). The overlay **fails silently** when:

1. No snapshot exists (no user visited the match page yet)
2. Snapshot TTL is 60 s (TIMED snapshot written by prewarm when kickoff has passed)
3. Both conditions combine: prewarm writes 60 s TIMED → expires → no snapshot

The results feed (`/competitions/WC/matches?dateFrom=...`) is maintained independently by the cron and is **always correct** within one 15-min cycle. The overlay never consulted it.

### Failure B — Fixture row renderer ignores match status

The compact fixture row in `/world-cup-2026/fixtures` always rendered `vs` regardless of `m.status`. Even if the overlay had worked and advanced Mexico to FINISHED 2–0, the row would still show "Mexico vs South Africa" with no score.

---

## Which surfaces bypass overlay

All surfaces use `*Cached` functions which call `overlayMatchStates()` — **no surface bypasses the overlay**. The problem is not bypass; it is **overlay failure** due to missing/expired snapshots (see Failure A).

---

## Score merge vs status merge

`mergeSnapshotState` merges both status AND score atomically when the snapshot is ahead:

```typescript
return { ...listMatch, status: snapMatch.status, score: snapMatch.score, lastUpdated: snapMatch.lastUpdated };
```

When the snapshot IS present and FINISHED, both status and score advance correctly. The divergence was entirely at Layer 2 (snapshot absent/stale), not in the merge logic.

---

## Section membership

Before this fix: section membership on the WC hub followed the feed name (upcoming feed → today/upcoming sections) rather than the overlaid status. A FINISHED match from the overlay could land in "Today's Matches" with correct FT badge via MatchCard, but would also appear in Recent Results (duplicate). If overlay failed, it appeared in "Today's Matches" as SCHEDULED (wrong section, wrong badge).

After this fix: section membership follows `m.status` after the authority merge — FINISHED → Results, IN_PLAY → Live, SCHEDULED/TIMED → Today/Upcoming by UTC day.
