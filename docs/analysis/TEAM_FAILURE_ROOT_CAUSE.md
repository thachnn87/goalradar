# TEAM_FAILURE_ROOT_CAUSE — DATA-18TEAM.1

**Date:** 2026-06-23  
**Scope:** `/teams/[slug]` pages — all team IDs

---

## Summary

Every `/teams/[id]-[name]` page rendered "Team Data Unavailable" because
**team data is never written to KV cache**, and `getTeamCached` (the page's
data function) was changed by PERF-7A to read KV only — never calling the
provider.

---

## Failure Chain

```
User → /teams/762-argentina
  └─ TeamSlugPage
       └─ getTeamCached('762')                   ← page-safe variant
            └─ withCache('/teams/762', 1h)
                 └─ readKVOnly('/teams/762')      ← KV read only, NO write
                      └─ null  (KV is empty)
                 └─ returns null
       └─ team = null → renders "Team Data Unavailable"
```

---

## Root Cause: Two-Part Design Gap

### Part 1 — PERF-7A broke the read path without fixing the write path

`getTeamCached` was intentionally converted from calling the provider to being
KV-read-only (`readKVOnly`). The function's JSDoc describes a three-tier read
path (L1 → L2 → provider) but the implementation only does L1 → L2:

```typescript
// BEFORE PERF-7A (implicit intent — provider called on L2 miss)
// AFTER PERF-7A (actual code)
export async function getTeamCached(id: string): Promise<TeamDetail | null> {
  return await withCache(key, TTL.STANDINGS, async () => {
    const data = await readKVOnly<TeamDetail>(key);
    return data ?? null;  // ← null on KV miss, no provider call
  });
}
```

### Part 2 — The orchestrator never writes team data to KV

`dispatchToProvider()` in `refresh.ts` maps endpoint patterns to provider
methods. It handles competitions, standings, fixtures, and live matches — but
**has no case for `/teams/${id}`**. No cron task in the orchestrator builds
the team data KV entries, so KV is permanently empty for all team keys.

```typescript
// dispatchToProvider() — excerpt from refresh.ts
// Handles: /competitions/*/standings
// Handles: /competitions/*/matches
// Handles: /matches?status=IN_PLAY,PAUSED
// Handles: /matches?dateFrom=…&dateTo=…
// MISSING:  /teams/${id}   ← never refreshed
throw new Error(`No providerManager mapping for endpoint: ${endpoint}`);
```

---

## Affected Layers

| Layer | Status | Detail |
|---|---|---|
| `providerManager.getTeam(id)` | ✅ Functional | Calls football-data.org `/teams/${id}` |
| `dispatchToProvider` | ❌ Missing case | No `/teams/${id}` dispatch |
| Vercel KV | ❌ Always empty | No cron task ever writes team data |
| `getTeamCached` (PERF-7A) | ❌ KV-only, no fallback | Returns `null` on KV miss |
| `TeamSlugPage` render | ⚠️ Graceful degradation | Shows "Team Data Unavailable" on `null` |

---

## Scope

- All teams accessible via `/teams/[id]-[name]`
- Affects league clubs (PL, La Liga, Bundesliga, Serie A, Ligue 1, CL)
- Affects national teams reachable via numeric ID (e.g. Argentina 762)
- Not a provider failure — football-data.org API returns correct data when called
- Not a type error — `TeamDetail` shape is unchanged
