# LIVE-3B Scorers / Match Events Audit
## GoalRadar · Sprint LIVE-3A/B

Generated: 2026-06-15

---

## Task

Determine whether scorer names and match event data exist in the provider payload,
and if so, through which data path they flow. Do NOT implement anything.

---

## Findings

### 1. `Match` vs `MatchDetail`

The `getLiveMatches()` call returns `Match[]`. The `getMatch(id)` call returns
`MatchDetail`.

```typescript
interface Match {
  // No goals[], bookings[], substitutions[]
  score: Score;  // only aggregate score, not events
}

interface MatchDetail extends Match {
  goals:         Goal[];
  bookings:      Booking[];
  substitutions: Substitution[];
  venue:         string | null;
  referees:      Referee[];
}

interface Goal {
  minute:     number;
  injuryTime: number | null;
  type:       string;
  team:       Team;
  scorer:     { id: number; name: string };
  assist:     { id: number; name: string } | null;
}
```

**Scorer data lives in `MatchDetail.goals[]`, not in `Match`.**

---

### 2. football-data.org v4 (PRIMARY) — `src/lib/providers/football-data.ts`

**`getMatch(id)` → `/matches/{id}`**

Returns a `MatchDetail` object (no mapper — raw JSON cast). The football-data.org
v4 `/matches/{id}` response includes:
- `goals[]` with scorer id, name, team, minute, injuryTime, type (Normal Goal, Own
  Goal, Penalty)
- `bookings[]` with player id, name, team, minute, card type
- `substitutions[]` with player out/in, team, minute

**Scorer names: ✅ available via `getMatch(id)` (primary, no mapper)**

**`getLiveMatches()` → `/matches?status=IN_PLAY,PAUSED`**

Returns `Match[]` — no goals/events in the response. The `/matches` (list)
endpoint does NOT include per-match events.

**Scorer names: ❌ NOT available via `getLiveMatches()`**

---

### 3. api-football (SECONDARY) — `src/lib/providers/api-football.ts`

**`getMatch(id)` → `normaliseMatchDetail(item)`**

`normaliseMatchDetail()` maps `item.events[]` (type 'Goal', 'Card', 'subst') into
`goals[]`, `bookings[]`, `substitutions[]`:

```typescript
const goals: Goal[] = (item.events ?? [])
  .filter((e) => e.type === 'Goal' && e.detail !== 'Missed Penalty')
  .map((e) => ({
    minute:     e.time.elapsed,
    injuryTime: e.time.extra ?? null,
    type:       e.detail ?? 'Normal Goal',
    team:       normaliseTeam(e.team),
    scorer:     { id: e.player?.id ?? 0, name: e.player?.name ?? '' },
    assist:     e.assist?.id ? { id: e.assist.id, name: e.assist.name ?? '' } : null,
  }));
```

**Scorer names: ✅ available via `getMatch(id)` (secondary, mapper preserves names)**

**`getLiveMatches()` → `normaliseMatch()` (not `normaliseMatchDetail`)**

`getLiveMatches()` calls `normaliseMatch()` which maps only the base `Match` fields.
No events/goals mapped.

**Scorer names: ❌ NOT available via `getLiveMatches()`**

---

### 4. Live cache (`goalradar:live:matches`)

Populated by `refreshLiveMatches()` which calls `getLiveMatches()`. Both providers'
`getLiveMatches()` return `Match[]` — no events.

**The KV live cache contains NO scorer data.** Only score, status, minute (from
primary), competition, teams.

---

### 5. `buildSnapshot()` — where scorer data is assembled

`buildSnapshot()` in `src/lib/match-snapshot.ts` calls:
1. `readMatchDetailFromKV(matchId)` → KV key `goalradar:/matches/{id}` — detail with goals[]
2. `getMatchDetail(matchId)` fallback → `providerManager.getMatch()` → provider
3. LIVE-2 overlay: replaces `score` and `status` from live cache (not goals)
4. `assembleSnapshot()` → `snapshot.match` includes `goals[]`, `bookings[]`, `substitutions[]`

**The match detail page (`/match/[id]`) DOES have scorer data from `MatchDetail`.**

---

### 6. What is and is not available in real-time

| Data | Available in live cache? | Available in match detail? | Freshness |
|------|--------------------------|---------------------------|-----------|
| Score | ✅ (goalradar:live:matches, 30s) | ✅ (overlay from live cache) | 30s |
| Status | ✅ | ✅ | 30s |
| Minute | ✅ (primary only, untyped) | ✅ (same) | 30s |
| Goals scored (events with scorer names) | ❌ | ✅ (goalradar:/matches/{id}, 60s SWR) | 60s |
| Assist names | ❌ | ✅ | 60s |
| Bookings | ❌ | ✅ | 60s |
| Substitutions | ❌ | ✅ | 60s |

---

### 7. Options to surface scorer data in real time

**Option A — Use existing `MatchDetail` from snapshot (60s lag)**

`buildSnapshot()` already assembles `goals[]` from the per-match detail KV key.
The match detail page already shows scorer names after page load. No new API calls.
Lag: 60s (per-match detail SWR window).

**Option B — Add a `/api/match-events/[id]` endpoint**

New endpoint hits `getMatchDetail(matchId)` directly (bypasses 60s SWR, hits provider
or 60s KV). Returns `goals[]` for client polling. Moderate provider call increase.

**Option C — Include events in `getLiveMatches()` response (risky)**

football-data.org `/matches?status=IN_PLAY,PAUSED` does NOT include events in the
list response — would require a separate per-match fetch per live match.
api-football `/fixtures?live=all` also does NOT include `events[]` by default in
the list response (events require the individual fixture endpoint).
**NOT feasible without N additional provider calls per orchestrator tick.**

---

## Conclusion

Scorer names and match events ARE present in both providers' `getMatch(id)` paths
and flow into `MatchDetail.goals[]`. They are NOT present in `getLiveMatches()`
responses from either provider.

Displaying real-time scorer names on `/live` cards or `/match/[id]` score hero
requires either:
- Reading from the per-match detail KV key (already done in `buildSnapshot()`) — 60s lag
- A dedicated event-polling endpoint (new provider calls)

**Scorer display on the match page is already possible** without code changes — the
snapshot passed to the page already contains `goals[]` from `MatchDetail`. The
question is UI implementation (rendering goals in `ScoreHero` or a timeline component).

**Scorer display on `/live` cards** requires per-match detail fetches or accepting
60s event lag — outside the scope of LIVE-3A.
