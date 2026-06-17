# DATA-18D Phase 2 — Canary Implementation
## AUTHORITY_RESULTS_ONLY: Only /world-cup-2026/results Uses Authority Cache

Implemented: 2026-06-17

---

## Design

**Goal:** Route production traffic for a single low-risk page through `getWCAuthorityMatchesV2()` while all other pages remain on the legacy `getWCAuthorityMatches()` path.

**Page chosen:** `/world-cup-2026/results`  
**Reason:** This route had no existing page (fell through to the `[group]` dynamic catch-all). Creating it fresh means zero risk of regression on existing pages. It also covers the primary use case for the authority cache (listing finished results with enrichment-aware data).

---

## Feature Flag

```bash
# Vercel Environment Variable
AUTHORITY_RESULTS_ONLY=true
```

When `false` (or unset, the production default): page uses `getWCAuthorityMatches()` — identical to all other WC listing pages. No behavioral change until the flag is activated.

When `true`: page uses `getWCAuthorityMatchesV2(builtAt)` → `readAuthorityCache()` → `goalradar:wc:authority:v1`.

---

## File Created

`src/app/world-cup-2026/results/page.tsx`

### Key Implementation Details

**Unified render shape:**
```typescript
interface ResultsEntry {
  id:       number;
  homeTeam: { name: string };
  awayTeam: { name: string };
  score?:   { fullTime?: { home: number | null; away: number | null } | null };
  state:    'live' | 'finished' | 'scheduled' | 'cancelled';
  minute?:  number;
  utcDate:  string;
  _path:    'legacy' | 'authority'; // canary telemetry label
}
```

Both `Match[]` (legacy) and `CanonicalMatch[]` (authority) are adapted to this shape before rendering. `CanonicalScore = Score` (same TypeScript type), so `score.fullTime.home/away` works identically. `CanonicalMatch.state` is already the classified bucket — no `classifyMatchState()` needed.

**Legacy adapter** (Match → ResultsEntry):
```typescript
function fromMatch(m: Match): ResultsEntry {
  const state =
    m.status === 'IN_PLAY' || m.status === 'PAUSED'              ? 'live'
    : m.status === 'FINISHED'                                    ? 'finished'
    : m.status === 'CANCELLED' || m.status === 'POSTPONED' ||
      m.status === 'SUSPENDED'                                   ? 'cancelled'
    : 'scheduled';
  return { ..., state, _path: 'legacy' };
}
```

**Canary adapter** (CanonicalMatch → ResultsEntry):
```typescript
function fromCanonical(m: CanonicalMatch): ResultsEntry {
  return { ..., state: m.state, _path: 'authority' };
}
```

**Page switch:**
```typescript
const CANARY = process.env.AUTHORITY_RESULTS_ONLY === 'true';

if (CANARY) {
  const { matches } = await getWCAuthorityMatchesV2(builtAt).catch(...)
  console.log(`[DATA-18D] results page | path=authority | matches=${matches.length} | builtAt=${builtAt}`)
  entries = matches.map(fromCanonical);
} else {
  const { matches } = await getWCAuthorityMatches().catch(...)
  entries = matches.map(fromMatch);
}
```

**Canary badge (visible in UI):**
When `AUTHORITY_RESULTS_ONLY=true`, a small "authority cache" badge appears next to the "Results" heading — providing a visual confirmation in production that the canary path is active.

**Logging:** Each page load when canary is active logs:
```
[DATA-18D] results page | path=authority | matches=104 | builtAt=2026-06-17T...
```

---

## Isolation Guarantees

| Page | Path | Changed? |
|------|------|----------|
| `/world-cup-2026` (Hub) | `getWCAuthorityMatches()` | No |
| `/world-cup-2026/fixtures` | `getWCAuthorityMatches()` | No |
| `/world-cup-2026/[group]` (Group A–L) | `getWCAuthorityMatches()` | No |
| `/world-cup-2026-results` (SEO page) | `getWCAuthorityMatches()` | No |
| **`/world-cup-2026/results`** | **`getWCAuthorityMatchesV2()` when flag=true** | **Yes (new page)** |
| All match detail pages | Per-match snapshot | No |
| All schedule/bracket/team pages | Respective feeds | No |

---

## Rollback

Set `AUTHORITY_RESULTS_ONLY=false` (or remove the env var). Vercel edge re-deploys in <30s. No code change required.

---

## Activation Steps

1. Deploy current commit (page already exists with `AUTHORITY_RESULTS_ONLY=false` default)
2. Verify `/world-cup-2026/results` renders correctly on legacy path (no "authority cache" badge)
3. Set `AUTHORITY_RESULTS_ONLY=true` in Vercel → Production environment variables
4. Trigger a new deployment (or revalidate) to pick up the env var
5. Confirm "authority cache" badge visible at `/world-cup-2026/results`
6. Run Phase 3 benchmark and Phase 4 stability monitoring
