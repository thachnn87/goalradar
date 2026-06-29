# DATA-18B.1 Phase 3 — Pilot Implementation

**Date:** 2026-06-18  
**Task:** DATA-18B.1 Authority Cache Pilot Migration  
**Phase:** 3 of 6 — Implement pilot with AUTHORITY_CACHE_PILOT=true

---

## 1. Implementation Summary

**File modified:** `src/app/world-cup-2026/bracket/page.tsx`  
**Files unchanged:** `WCBracket.tsx`, `MatchCard.tsx`, all other pages, all API functions

### Changes made

#### 1. New imports (top of file)

```typescript
import { getWCKnockoutMatchesCached, getWCAuthorityMatchesV2 } from '@/lib/api';
import type { Match, MatchStatus } from '@/lib/types';
import type { CanonicalMatch } from '@/lib/canonical-match';
```

`CanonicalMatch` is imported from `src/lib/canonical-match` (the real interface, not the legacy `Match` alias from `api.ts`).

#### 2. Feature flag constant

```typescript
const PILOT_ENABLED = process.env.AUTHORITY_CACHE_PILOT === 'true';
```

Reads `AUTHORITY_CACHE_PILOT` from Vercel environment variables at runtime. Default (unset): `false` → old path active.

#### 3. `canonicalToMatch()` adapter function

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
    competition: { id: 2000, name: 'FIFA World Cup', code: 'WC', type: 'CUP', emblem: '', area: { id: 2267, name: 'World', code: 'WLD', flag: null } },
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    score: m.score,
    minute: m.minute ?? null,
  };
}
```

Maps `CanonicalMatch.state` → `Match.status` (different field names, compatible semantics). Synthesizes `competition` field (not rendered by bracket page — passed for type conformance only).

**TypeScript validation:** `npx tsc --noEmit` passes with zero errors.

#### 4. Pilot gate in `WCBracketPage()`

```typescript
let allWCMatches: Match[] = [];
try {
  if (PILOT_ENABLED) {
    const builtAt = new Date().toISOString();
    const data = await getWCAuthorityMatchesV2(builtAt);
    allWCMatches = data.matches.map(canonicalToMatch);
  } else {
    const data = await getWCKnockoutMatchesCached();
    allWCMatches = data.matches;
  }
} catch {
  // graceful degradation — fall back to local slot schedule below
}
```

The `try/catch` wraps both paths. If `getWCAuthorityMatchesV2` fails (KV unavailable, cold rebuild throws, etc.), the page falls through to `allWCMatches = []` and renders the local `WC_KNOCKOUT_SLOTS` pre-tournament schedule — same degradation as today.

---

## 2. Data Path Comparison

| | Old path | New path (PILOT_ENABLED) |
|---|---|---|
| Data function | `getWCKnockoutMatchesCached()` | `getWCAuthorityMatchesV2(builtAt)` |
| KV reads | `/competitions/WC/matches` + 104 snapshot mgets | Single `goalradar:wc:authority:v1` or `..dr..` read |
| State overlay | `overlayMatchStates()` | Built into authority cache |
| Returns | `Match[]` | `CanonicalMatch[]` → `Match[]` via adapter |
| Filter | `KNOCKOUT_STAGES.has(m.stage)` | same |
| Render components | `WCBracket`, `ThirdPlaceCard`, `FinalCard`, `MatchCard` | same (receives `Match[]` unchanged) |

---

## 3. Rollback Procedure

**To roll back (no redeploy required):**
1. Vercel dashboard → Project → Settings → Environment Variables
2. Set `AUTHORITY_CACHE_PILOT` to any value other than `true` (or delete it)
3. Page reverts to `getWCKnockoutMatchesCached()` on next ISR revalidation (≤21600s) or immediately on next cold request

**To activate:**
1. Vercel dashboard → Set `AUTHORITY_CACHE_PILOT = true` for Production
2. Page activates on next ISR revalidation or cold request

---

## 4. Validation Readiness

Phase 4 validation targets (to be collected after AUTHORITY_CACHE_PILOT=true in production):

| Metric | How to measure | Target |
|---|---|---|
| Data source | `authority-telemetry` — new drHits increment? | primary or dr (no cold) |
| Render latency | Server-Timing header on `/world-cup-2026/bracket` | ≤ current baseline |
| Bracket display | Browser — knockout matches show correct stage/teams/scores | Matches current |
| Round summary | Round progress pills show correct played/total counts | Matches current |
| Rollback test | Set flag=false → old path returns | Instant |

---

## 5. Phase 3 Complete

- Implementation committed to `bracket/page.tsx`
- TypeScript clean
- Old path preserved intact (default)
- Pilot path gated behind `AUTHORITY_CACHE_PILOT=true`
- Rollback: Vercel env var change, no redeploy

**Next:** Phase 4 — activate `AUTHORITY_CACHE_PILOT=true` in Vercel dashboard and run production validation.
