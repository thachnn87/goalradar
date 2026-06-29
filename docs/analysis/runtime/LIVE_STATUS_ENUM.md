# LIVE_STATUS_ENUM.md
## DATA-18WC.LIVE.TRUTH — Phase 2: Status Enum Audit

---

## 1. Canonical Status Type

**`src/lib/types.ts:32`**
```typescript
export type MatchStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'SUSPENDED';
```

**`CanonicalMatch.state` — `src/lib/canonical-match.ts`**
```typescript
state: 'scheduled' | 'live' | 'finished' | 'cancelled';
```

---

## 2. Provider Status Mapping

### football-data.org (primary)
Emits `MatchStatus` directly — no translation layer needed.

| FD Status | Meaning | Display Bucket |
|-----------|---------|----------------|
| `SCHEDULED` | Kickoff in future | today / upcoming |
| `TIMED` | Kickoff time confirmed | today / upcoming |
| `IN_PLAY` | Match in progress | **live** |
| `PAUSED` | Half-time / VAR pause | **live** |
| `FINISHED` | Full-time | finished |
| `POSTPONED` | Rescheduled | other |
| `CANCELLED` | Abandoned | other |
| `SUSPENDED` | Suspended mid-game | other |

### API-Football (secondary / failover)
**`src/lib/providers/api-football.ts:63`**

| AF Short | Meaning | → MatchStatus |
|----------|---------|---------------|
| `NS` | Not started | `SCHEDULED` |
| `TBD` | Time TBD | `TIMED` |
| `1H` | First half | `IN_PLAY` |
| `2H` | Second half | `IN_PLAY` |
| `ET` | Extra time | `IN_PLAY` |
| `BT` | Break time (ET) | `IN_PLAY` |
| `P` | Penalty ongoing | `IN_PLAY` |
| `INT` | Interrupted | `IN_PLAY` |
| `HT` | Half-time | `PAUSED` |
| `FT` | Full time | `FINISHED` |
| `AET` | After extra time | `FINISHED` |
| `PEN` | After penalties | `FINISHED` |
| `WO` | Walkover | `FINISHED` |
| `PST` | Postponed | `POSTPONED` |
| `CANC` | Cancelled | `CANCELLED` |
| `ABD` | Abandoned | `SUSPENDED` |
| `SUSP` | Suspended | `SUSPENDED` |

**All AF live short codes map to `IN_PLAY` or `PAUSED` — no leakage of raw AF codes into the system.**

---

## 3. State Rank (Forward-Only Transitions)

**`src/lib/match-state-overlay.ts`**
```typescript
export const STATE_RANK: Record<string, number> = {
  SCHEDULED: 0,
  TIMED:     0,
  POSTPONED: 1,
  SUSPENDED: 1,
  CANCELLED: 1,
  IN_PLAY:   2,  // ← live
  PAUSED:    2,  // ← live
  FINISHED:  3,
};
```

Higher rank wins in snapshot merge. A match can never go from FINISHED → IN_PLAY.

---

## 4. CanonicalMatch State Derivation

**`src/lib/canonical-match.ts`**
```typescript
function deriveState(status: MatchStatus): CanonicalMatch['state'] {
  if (status === 'IN_PLAY' || status === 'PAUSED') return 'live';
  if (status === 'FINISHED')                       return 'finished';
  if (status === 'SCHEDULED' || status === 'TIMED') return 'scheduled';
  return 'cancelled'; // POSTPONED, CANCELLED, SUSPENDED
}
```

---

## 5. Authority Cache TTL Tier Selection

**`src/lib/authority-cache.ts:63`**
```typescript
const TTL_LIVE   =  30;   // any match is live → 30s cache
const TTL_TODAY  = 300;   // any match today → 5min cache
const TTL_NORMAL = 900;   // no live/today matches → 15min cache
```

If any match has `state === 'live'`, the entire authority payload refreshes every 30 seconds automatically.

---

## 6. Verdict: Status Enum Consistency

| Status | Defined in types.ts | Emitted by FD | Mapped from AF | Used in live filter | Consistent? |
|--------|--------------------|-----------|----|-----|----|
| `SCHEDULED` | ✅ | ✅ | `NS` | N/A | ✅ |
| `TIMED` | ✅ | ✅ | `TBD` | N/A | ✅ |
| `IN_PLAY` | ✅ | ✅ | `1H,2H,ET,BT,P,INT` | ✅ | ✅ |
| `PAUSED` | ✅ | ✅ | `HT` | ✅ | ✅ |
| `FINISHED` | ✅ | ✅ | `FT,AET,PEN,WO` | N/A | ✅ |
| `POSTPONED` | ✅ | ✅ | `PST` | N/A | ✅ |
| `CANCELLED` | ✅ | ✅ | `CANC` | N/A | ✅ |
| `SUSPENDED` | ✅ | ✅ | `ABD,SUSP` | N/A | ✅ |

**Status enum is consistent. No page invents its own status values.**

The live filter `IN_PLAY | PAUSED` is the single definition of a live match across all layers.
