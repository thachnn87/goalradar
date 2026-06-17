# DATA-18A Authority Builder Design
## `buildCanonicalMatch()` — Merge Engine

Date: 2026-06-17
Status: Design only — dormant. No production activation.

---

## 1. Purpose

`buildCanonicalMatch()` is the single function responsible for merging all
available data layers into one `CanonicalMatch`. It replaces the current
implicit merge that is spread across:

- `getWCAuthorityMatchesCached()` — STATE_RANK merge of 3 bulk feeds
- `overlayMatchStates()` — snapshot overlay on top of bulk feed
- Page-level field access on `Match` (which lacks events/lineups)

After this function exists, no page ever needs to know where data came from.

---

## 2. Inputs

```
buildCanonicalMatch(
  fdMatch:    Match,            // from FD bulk feeds (SCHEDULED/FINISHED/live)
  liveEntry:  KVLiveEntry | null,  // from goalradar:live:matches (30s TTL)
  snapshot:   MatchSnapshot | null, // from goalradar:match:{id} (ESPN-enriched)
  todayUTC:   string,           // 'YYYY-MM-DD' for classifyMatchState()
): CanonicalMatch
```

All inputs are read before calling this function. The function itself makes
**zero KV reads** and **zero network calls** — it is a pure merge function.

---

## 3. Merge Precedence Table

| Field | Priority 1 | Priority 2 | Priority 3 | Fallback |
|-------|-----------|-----------|-----------|---------|
| `id` / `fdMatchId` | `fdMatch.id` | — | — | — |
| `espnMatchId` | `snapshot.espnMatchId` | — | — | `undefined` |
| `competitionCode` | `fdMatch.competition.code` | — | — | — |
| `utcDate` | `fdMatch.utcDate` | — | — | — |
| `state` (raw status for derive) | `liveEntry.status` if rank > fd | `fdMatch.status` advanced by snapshot | `fdMatch.status` | 'scheduled' |
| `minute` | `liveEntry.minute` | `snapshot.minute` | — | `undefined` |
| `homeTeam` / `awayTeam` | `fdMatch.homeTeam/awayTeam` | — | — | — |
| `score` | `snapshot.score` if FINISHED | `fdMatch.score` | — | null-score object |
| `goals` | `snapshot.goals` | — | — | `[]` |
| `cards` | `snapshot.bookings` | — | — | `[]` |
| `substitutions` | `snapshot.substitutions` | — | — | `[]` |
| `lineups` | `snapshot.lineups` | — | — | `null` |
| `venue` | `snapshot.venue` | — | — | `null` |
| `referee` | `snapshot.referees[0]` | — | — | `null` |
| `lastUpdated` | max(fd, snapshot) | `fdMatch.lastUpdated` | — | — |
| `matchday` | `fdMatch.matchday` | — | — | — |
| `stage` | `fdMatch.stage` | — | — | — |
| `group` | `fdMatch.group` | — | — | — |

---

## 4. State Resolution Algorithm

```typescript
function resolveState(
  fdMatch: Match,
  liveEntry: KVLiveEntry | null,
  snapshot: MatchSnapshot | null,
  todayUTC: string,
): { status: MatchStatus; minute?: number } {

  // Step 1: Start from FD bulk feed status
  let status: MatchStatus = fdMatch.status;
  let minute: number | undefined = fdMatch.minute ?? undefined;

  // Step 2: Advance via snapshot (forward-only — never downgrade)
  if (snapshot !== null) {
    const snapshotRank = STATE_RANK[snapshot.status] ?? 0;
    const currentRank  = STATE_RANK[status] ?? 0;
    if (snapshotRank > currentRank) {
      status = snapshot.status;
      minute = snapshot.minute ?? undefined;
    }
    // Snapshot FINISHED → adopt snapshot score (handled in score merge below)
  }

  // Step 3: Advance via live cache (IN_PLAY/PAUSED rank=2; FINISHED rank=3 always wins)
  if (liveEntry !== null) {
    const liveRank    = STATE_RANK[liveEntry.status] ?? 0;
    const currentRank = STATE_RANK[status] ?? 0;
    if (liveRank > currentRank) {
      status = liveEntry.status as MatchStatus;
      minute = liveEntry.minute ?? undefined;
    }
  }

  return { status, minute };
}
```

STATE_RANK reference (from `match-state-overlay.ts`):
```
SCHEDULED: 0, TIMED: 0, IN_PLAY: 2, PAUSED: 2, FINISHED: 3
```

---

## 5. Score Resolution Algorithm

```typescript
function resolveScore(
  fdMatch: Match,
  snapshot: MatchSnapshot | null,
  resolvedStatus: MatchStatus,
): Score {
  // ESPN never provides score — score only from FD or snapshot.
  // Snapshot score is preferred for FINISHED matches because it may have been
  // written with a confirmed fullTime score while the bulk feed is stale.
  if (
    snapshot !== null &&
    snapshot.status === 'FINISHED' &&
    resolvedStatus === 'FINISHED' &&
    snapshot.score?.fullTime?.home !== null
  ) {
    return snapshot.score;
  }
  return fdMatch.score;
}
```

**Invariant:** ESPN event data (`snapshot.goals`, `snapshot.cards`, etc.) never
overwrites `score`. Score only comes from `fdMatch.score` or `snapshot.score`
(which itself came from FD data, not ESPN).

---

## 6. Full `buildCanonicalMatch()` Pseudocode

```typescript
function buildCanonicalMatch(
  fdMatch:    Match,
  liveEntry:  KVLiveEntry | null,
  snapshot:   MatchSnapshot | null,
  todayUTC:   string,
  builtAt:    string,   // ISO string, passed in (not Date.now() — deterministic)
): CanonicalMatch {

  // ── State & minute ─────────────────────────────────────────────────────────
  const { status: resolvedStatus, minute } = resolveState(fdMatch, liveEntry, snapshot, todayUTC);

  // ── Display state bucket ───────────────────────────────────────────────────
  const state = deriveState(resolvedStatus, fdMatch.utcDate, todayUTC);
  // 'scheduled' | 'live' | 'finished' | 'cancelled'

  // ── Score ──────────────────────────────────────────────────────────────────
  const score = resolveScore(fdMatch, snapshot, resolvedStatus);

  // ── Events (ESPN-enriched, team IDs reconciled per DATA-14A) ──────────────
  const goals         = snapshot?.goals         ?? [];
  const cards         = snapshot?.bookings      ?? [];
  const substitutions = snapshot?.substitutions ?? [];
  const lineups       = snapshot?.lineups       ?? null;

  // ── Venue & referee ────────────────────────────────────────────────────────
  const venue    = snapshot?.venue          ?? null;
  const referee  = snapshot?.referees?.[0]  ?? null;

  // ── Timestamps ─────────────────────────────────────────────────────────────
  const fdTs       = new Date(fdMatch.lastUpdated).getTime();
  const snapTs     = snapshot ? new Date(snapshot.enrichedAt ?? 0).getTime() : 0;
  const lastUpdated = new Date(Math.max(fdTs, snapTs)).toISOString();

  // ── Provenance ─────────────────────────────────────────────────────────────
  const source: CanonicalMatchSource = {
    fdBulkFeed: inferFdFeed(fdMatch.status),
    liveCache:  liveEntry ? { observedAt: builtAt } : undefined,
    snapshot:   snapshot
      ? {
          enrichedAt:        snapshot.enrichedAt ?? builtAt,
          enrichmentSource:  snapshot.enrichmentSource ?? 'none',
          snapshotVersion:   snapshot.version ?? 1,
        }
      : undefined,
    builtAt,
  };

  return {
    id:                fdMatch.id,
    fdMatchId:         fdMatch.id,
    espnMatchId:       snapshot?.espnMatchId,
    competitionCode:   fdMatch.competition.code,
    utcDate:           fdMatch.utcDate,
    state,
    minute,
    homeTeam:          fdMatch.homeTeam,
    awayTeam:          fdMatch.awayTeam,
    score,
    goals,
    cards,
    substitutions,
    lineups:           lineups ? { home: lineups.home, away: lineups.away } : null,
    venue,
    referee:           referee
      ? { id: referee.id, name: referee.name, nationality: referee.nationality ?? null }
      : null,
    source,
    lastUpdated,
    enrichmentApplied: goals.length > 0 || cards.length > 0 || substitutions.length > 0,
    matchday:          fdMatch.matchday,
    stage:             fdMatch.stage,
    group:             fdMatch.group,
  };
}
```

---

## 7. Downstream Caller: `buildAllCanonicalMatches()`

The per-match builder needs a caller that handles the batched KV reads
(the same pattern `overlayMatchStates` uses today):

```typescript
async function buildAllCanonicalMatches(
  fdMatches: Match[],
  liveMap:   Map<number, KVLiveEntry>,
  todayUTC:  string,
  builtAt:   string,
): Promise<CanonicalMatch[]> {

  // Batch-read all snapshots in one mget call (same as overlayMatchStates does today)
  const keys     = fdMatches.map(m => `goalradar:match:${m.id}`);
  const snapshots = await kv.mget<MatchSnapshot>(...keys);

  return fdMatches.map((m, i) =>
    buildCanonicalMatch(
      m,
      liveMap.get(m.id) ?? null,
      snapshots[i] ?? null,
      todayUTC,
      builtAt,
    )
  );
}
```

---

## 8. Key Constraints the Design Enforces

| Constraint | Mechanism |
|-----------|-----------|
| FD always owns identity | `id`, `fdMatchId`, `competitionCode`, `utcDate`, `homeTeam`, `awayTeam` set unconditionally from `fdMatch` |
| ESPN never owns score | `score` comes from `resolveScore()` which only reads `fdMatch.score` or `snapshot.score` (FD-sourced); ESPN events are only read into `goals`/`cards` |
| Snapshot never downgrades | `resolveState()` uses `STATE_RANK` — only advances if `snapshotRank > currentRank` |
| FINISHED is sticky | `STATE_RANK[FINISHED] = 3` is the maximum; once a match reaches FINISHED it cannot return to IN_PLAY or SCHEDULED |
| Zero side effects | `buildCanonicalMatch()` is pure — no KV writes, no network calls, no Date.now() |
| Deterministic | All timestamps passed in as parameters; no internal time reads |
