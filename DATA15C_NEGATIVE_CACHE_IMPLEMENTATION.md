# DATA-15C Negative Cache Implementation
## Hardening the ESPN Lookup Layer

Date: 2026-06-17
Scope: ESPN lookup layer only. **No Match Identity activation, no Snapshot V2, no Team Identity migration.**
Status: Implemented, `tsc` clean, helpers verified against the shipped module.

---

## Objective 1 — Structured negative-cache record

The bare `'__NOT_FOUND__'` string sentinel is replaced by a structured object
(`src/lib/espn-id-map.ts`):

```typescript
export interface LookupMiss {
  status:        'NOT_FOUND';
  reason:        string;  // 'no-scoreboard-match' | 'legacy-sentinel'
  firstMissAt:   number;  // epoch ms — enables true age
  lastAttemptAt: number;  // epoch ms — drives the backoff window
  attempts:      number;  // 1-based; selects the backoff interval
}
```

Positive entries remain a **bare ESPN ID string** (backward compatible with all
existing positive keys). The lookup value is therefore one of:

| Stored value | Meaning |
|--------------|---------|
| `"760421"` (string ≠ sentinel) | positive — ESPN event ID |
| `{ status:'NOT_FOUND', ... }` (object) | structured miss (DATA-15C) |
| `"__NOT_FOUND__"` (legacy string) | pre-DATA-15C bare sentinel — read-compat |
| `null` | absent |

---

## Objective 2 — Split positive / negative TTL

| Result | TTL / window | Constant |
|--------|--------------|----------|
| Positive (ESPN ID) | **30 days** (unchanged) | `ESPN_LOOKUP_TTL_SEC` |
| Negative — retry backoff | attempt 1 → **15m**, 2 → **1h**, 3 → **6h**, 4+ → **24h** | `ESPN_NEG_BACKOFF_SEC = [900, 3600, 21600, 86400]` |
| Negative — KV record ceiling | **7 days** | `ESPN_NEG_RECORD_TTL_SEC` |

### Why the backoff is a computed window, not the KV TTL

A literal per-attempt KV TTL (`kv.set(key, miss, { ex: 900 })`) is **buggy**: when
the key expires the record vanishes, so the attempt counter is lost and the next
miss restarts at attempt 1. Backoff would never escalate past 15m, and a
permanently-absent match would be re-queried every 15 minutes forever.

Instead the record **persists** (7-day ceiling) and retry is gated by a computed
window: a re-attempt is allowed only when

```
now ≥ lastAttemptAt + espnNegBackoffSec(attempts) * 1000
```

This preserves the counter across retries so the 15m→1h→6h→24h escalation
actually happens, while the 7-day ceiling self-cleans a match nobody views for a
week. The 15m/1h/6h/24h schedule from the objective is realised exactly as the
escalating retry interval.

---

## Objective 3 — Retry / backoff helpers

```typescript
// Backoff seconds for a miss attempted `attempts` times (clamps to 24h at 4+).
export function espnNegBackoffSec(attempts: number): number;

// True while a stored miss is still inside its backoff window (suppress retry).
export function espnMissSuppressed(miss: LookupMiss, now: number): boolean;
```

### `resolveEspnMatchId` flow (rewritten)

```
read goalradar:espn:lookup:{fdId}
 ├─ string ≠ sentinel        → return ESPN ID (positive hit)
 ├─ object, in backoff window → return null   (suppress; no ESPN call)
 ├─ object, window elapsed    → re-attempt, carrying firstMissAt + attempts
 └─ legacy '__NOT_FOUND__'    → re-attempt now (heals stale 30-day sentinels)

on re-attempt → findEspnMatch():
 ├─ hit  → kv.set(id, ex=30d)                      [+ logs "(healed prior miss)"]
 └─ miss → kv.set(LookupMiss{attempts+1}, ex=7d)   [escalating backoff]
```

Legacy bare sentinels (e.g. the 537346 false negative from DATA-15B) are treated
as a stale miss and re-attempted immediately, so they **self-heal** on the next
page build once the alias fix (Objective 5) is deployed.

---

## Objective 4 — Debug endpoint fixes

`src/app/api/debug/espn-enrichment/[matchId]/route.ts` now reports:

| Field | Before | After |
|-------|--------|-------|
| `lookupAgeSeconds` | always `null` (never assigned) | **real** — miss: `now − firstMissAt`; positive: `30d − ttlRemaining` |
| `lookupReason` | — | `miss.reason` / `'legacy-sentinel'` / `null` |
| `lookupAttempts` | — | `miss.attempts` / `1` (legacy) / `null` |
| `lookupTtlRemaining` | — | `kv.ttl(lookupKey)` seconds |
| `nextRetryInSec` | — | seconds until backoff window opens (miss only) |

The lookup value is now read as `string | LookupMiss` and classified (positive ID
/ structured miss / legacy sentinel / absent). `kv.ttl()` is added to the parallel
KV read batch.

---

## Objective 5 — Alias fix

`src/lib/providers/espn.ts` `ESPN_ALIASES`:

```typescript
'turkey': 'turkiye',   // FD "Turkey" ↔ ESPN "Türkiye" (DATA-15C)
```

`normaliseName("Turkey")` → `turkiye` === `normaliseName("Türkiye")` → resolves.

---

## Objective 6 — Verification

See `DATA15C_RUNTIME_VERIFY.md`. Summary: Australia vs Turkey (FD 537346) resolves
to **ESPN 760421** with the new alias; backoff schedule and suppression window
verified against the shipped module. `tsc --noEmit` clean.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/espn-id-map.ts` | `LookupMiss` type; `ESPN_NEG_BACKOFF_SEC` / `ESPN_NEG_RECORD_TTL_SEC` / `ESPN_LEGACY_SENTINEL`; `espnNegBackoffSec()` / `espnMissSuppressed()`; rewritten `resolveEspnMatchId` |
| `src/lib/providers/espn.ts` | `turkey → turkiye` alias |
| `src/app/api/debug/espn-enrichment/[matchId]/route.ts` | real `lookupAgeSeconds`, `lookupReason`, `lookupAttempts`, `lookupTtlRemaining`, `nextRetryInSec`; `kv.ttl` read; structured-value classification |

## Constraints honoured

- No Match Identity activation (match-identity.ts untouched, still dormant).
- No Snapshot V2 (match-snapshot.ts untouched).
- No Team Identity migration (single alias added to the existing map; no new layer wired in).
- Positive-entry format unchanged → backward compatible with existing keys.
