# DATA-18B.1 Phase 2 — Current Data Flow: `bracket/page.tsx`

**Date:** 2026-06-18  
**Task:** DATA-18B.1 Authority Cache Pilot Migration  
**Phase:** 2 of 6 — Document current data flow for pilot page

---

## 1. Current Data Flow (before migration)

```
Request → /world-cup-2026/bracket
  │
  ├─ revalidate = 21600 (6h ISR)
  │
  └─ WCBracketPage() [server component]
       │
       └─ getWCKnockoutMatchesCached()
            │
            ├─ 1. withCache('/competitions/WC/matches', TTL.WC=21600)
            │       → L1 in-process cache (6h TTL)
            │       → If L1 miss: readKVOnly('/competitions/WC/matches')
            │            → Vercel KV: goalradar:/competitions/WC/matches
            │            → If KV miss: return { matches: [] }
            │
            └─ 2. overlayMatchStates(data.matches)
                    → For each match: kv.get('goalradar:match:{id}')  ← per-match snapshot
                    → Forward-only state promotion (STATE_RANK)
                    → Returns Match[] with snapshot-authoritative status
```

### KV Keys read by current path

| KV key | Type | TTL | Purpose |
|---|---|---|---|
| `/competitions/WC/matches` | String | 21600s (6h) | Bulk WC match feed from FD |
| `goalradar:match:{id}` × N | String | 900s | Per-match snapshots for state overlay |

### Provider chain (current)

1. **FD bulk feed** (`/competitions/WC/matches`): Written by orchestrator cron. Contains ALL 104 WC matches with FD-authoritative fixture data. TTL 6h.
2. **Per-match snapshots** (`goalradar:match:{id}`): Written by match snapshot cron. Contains ESPN-enriched state (goals, score, status). TTL 900s. Used by `overlayMatchStates()` to promote stale FD states.
3. **L1 in-process cache** (`withCache`): Deduplicates KV reads within a single serverless invocation. 6h TTL aligned with `revalidate`.

### Fields used from `Match[]`

By `bracket/page.tsx` directly (`ThirdPlaceCard`, `FinalCard`, JSON-LD, knockout filter):
- `m.stage` — filter to `KNOCKOUT_STAGES`
- `m.utcDate` — JSON-LD, kickoff display
- `m.id` — URL generation via `matchPath()`
- `m.homeTeam.name`, `.shortName`, `.crest` — team display
- `m.awayTeam.name`, `.shortName`, `.crest` — team display
- `m.status` — `'IN_PLAY'|'PAUSED'|'FINISHED'` checks
- `m.score.winner` — `'HOME_TEAM'|'AWAY_TEAM'`
- `m.score.fullTime.home/away` — score display

By `WCBracket` component (receives filtered `Match[]`):
- Same fields as above (BracketMatchCard in WCBracket.tsx line 67–138)
- `match.status` at lines 68, 69, 118 of WCBracket.tsx

### Estimated render latency (current path)

| Step | Latency |
|---|---|
| withCache L1 hit | ~1ms |
| withCache L1 miss → KV get | ~15-25ms |
| overlayMatchStates (104 match mget) | ~30-50ms |
| Total (L1 hit) | ~35-55ms |
| Total (KV hit, L1 miss) | ~50-75ms |

---

## 2. Proposed Data Flow (after migration)

```
Request → /world-cup-2026/bracket  [AUTHORITY_CACHE_PILOT=true]
  │
  ├─ revalidate = 21600 (6h ISR, unchanged)
  │
  └─ WCBracketPage() [server component]
       │
       └─ readAuthorityCache(builtAt)           ← single call
            │
            ├─ 1. kv.get('goalradar:wc:authority:v1')    ← primary (TTL: 300s/today)
            │       → If hit: return matches[] immediately
            │
            ├─ 2. kv.get('goalradar:dr:wc:authority:v1') ← DR (TTL: 7d)
            │       → If hit: return matches[] immediately
            │
            └─ 3. coldRebuild()                          ← only if both absent
                    → FD feeds + mget snapshots → buildAllCanonicalMatches()

       → canonicalToMatch(m) for each match      ← thin adapter (inline)
       → filter by KNOCKOUT_STAGES
       → render (same components, same types)
```

### KV Keys read by proposed path

| KV key | Type | TTL | Purpose |
|---|---|---|---|
| `goalradar:wc:authority:v1` | String | 300s (today tier) | Authority cache primary |
| `goalradar:dr:wc:authority:v1` | String | 7d | Authority cache DR |

No per-match snapshot reads. No `overlayMatchStates()`. The authority cache embeds enriched state.

### Estimated render latency (proposed path)

| Step | Latency |
|---|---|
| kv.get primary (HIT) | ~15-25ms |
| kv.get DR (HIT, primary expired) | ~20-30ms |
| coldRebuild (both absent) | ~150-250ms |
| Total (primary or DR hit) | **~20-45ms** |

Expected improvement: ~10-30ms reduction vs current path (eliminates `overlayMatchStates` mget fan-out).

---

## 3. Adaptation Required: `CanonicalMatch` → `Match`

The authority cache returns `CanonicalMatch[]` (from `src/lib/canonical-match.ts`).  
The bracket rendering components (`WCBracket`, `ThirdPlaceCard`, `FinalCard`) are typed for `Match` (from `src/lib/types.ts`).

**Incompatible fields:**

| `Match` field | `CanonicalMatch` equivalent | Notes |
|---|---|---|
| `status: MatchStatus` | `state: 'scheduled'\|'live'\|'finished'\|'cancelled'` | Different field name + different value set |
| `competition: Competition` | absent | Not used in bracket rendering |

**All other fields compatible:** `id`, `utcDate`, `matchday`, `stage`, `group`, `lastUpdated`, `homeTeam.*`, `awayTeam.*`, `score.*`, `minute`.

**Adapter strategy:** A thin `canonicalToMatch()` function in `bracket/page.tsx` maps `state` to `status` and synthesizes the `competition` field. This keeps `WCBracket.tsx` and the card subcomponents untouched.

```typescript
function canonicalToMatch(m: CanonicalMatch): Match {
  const statusMap: Record<CanonicalMatch['state'], MatchStatus> = {
    live:      'IN_PLAY',
    finished:  'FINISHED',
    scheduled: 'SCHEDULED',
    cancelled: 'POSTPONED',
  };
  return {
    id: m.id,
    utcDate: m.utcDate,
    status: statusMap[m.state],
    matchday: m.matchday,
    stage: m.stage,
    group: m.group,
    lastUpdated: m.lastUpdated,
    competition: { id: 2000, name: 'FIFA World Cup', code: 'WC', type: 'CUP', emblem: '' },
    homeTeam: m.homeTeam as Team,
    awayTeam: m.awayTeam as Team,
    score: m.score,
    minute: m.minute ?? null,
  };
}
```

**Files changed in Phase 3:**
- `src/app/world-cup-2026/bracket/page.tsx` — add pilot gate, adapter function, new fetch path
- No changes to `src/components/WCBracket.tsx`
- No changes to `src/components/MatchCard.tsx`

---

## 4. Rollback Design

Feature flag: `AUTHORITY_CACHE_PILOT=true` in Vercel environment variables.

| State | Path active | Rollback |
|---|---|---|
| `AUTHORITY_CACHE_PILOT=true` | Authority cache path | Set to `false` in Vercel dashboard |
| `AUTHORITY_CACHE_PILOT=false` (or unset) | `getWCKnockoutMatchesCached()` path | N/A — existing behavior |

Rollback takes effect on next ISR revalidation (up to 21600s) or immediate on next cold request after Vercel propagates the env var change. No redeploy required.

---

## 5. Phase 2 Summary

**Current data flow:** `getWCKnockoutMatchesCached()` → KV read (`/competitions/WC/matches`) + `overlayMatchStates()` (mget per-match snapshots) → filter knockouts → render.

**Proposed data flow:** `readAuthorityCache()` → single KV read (primary or DR) → `canonicalToMatch()` adapter → filter knockouts → same render components.

**Change is bounded and reversible:**
- 1 file modified: `bracket/page.tsx`
- 0 component changes
- 1 inline adapter function (~10 lines)
- 1 feature flag gate (~5 lines)

**Ready for Phase 3 implementation.**
