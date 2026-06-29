# DATA-10 Audit
## GoalRadar · Live UX Hardening — Pre-Implementation Findings

Date: 2026-06-16

---

## Phase 1 — Live Match Display Locations

Every location where a live match is rendered:

| Location | Component / Renderer | Minute shown? | Progress? |
|----------|---------------------|---------------|-----------|
| `/live` | `MatchCard` → `StatusBadge` | ✅ Yes (`47'` or `LIVE`) | ❌ No |
| `/world-cup-2026` (WC hub) | `MatchCard` → `StatusBadge` | ✅ Yes | ❌ No |
| `/world-cup-2026-results` | Inline `statusBadge()` | ❌ No (hardcoded `LIVE`) | ❌ No |
| `/match/[id]` hero | `MatchLiveZone` → `StatusBadge` | ✅ Yes (`47'` or `LIVE`) | ❌ No |
| `/match/[id]` client poll | `MatchLiveZone` via `/api/live-score` | ✅ Yes (kv-live + live paths) | ❌ No |
| Schedule page | N/A — explicitly filters to SCHEDULED/TIMED only | — | — |

---

## Phase 2 — Minute Rendering Audit

### MatchCard (`src/components/MatchCard.tsx`)

`StatusBadge` already renders `${minute}'` when `minute != null`, falls back to `LIVE`.
**Status: ✅ correct pre-DATA-10.**

### MatchLiveZone (`src/components/MatchLiveZone.tsx`)

`StatusBadge` already renders `${minute}'` / `LIVE` fallback. Receives `minute` from
`/api/live-score` poll response.
**Status: ✅ correct pre-DATA-10.**

### Results page (`src/app/world-cup-2026-results/page.tsx`)

`statusBadge()` returned `{ label: 'LIVE' }` for both `IN_PLAY` and `PAUSED`.
- IN_PLAY should show minute when available
- PAUSED should show `HT` not `LIVE`

**Status: ❌ two bugs — fixed in DATA-10.**

### `/api/live-score` snapshot fallback

Step 3 (snapshot source) response was missing the `minute` field:
```typescript
// Before — line 83 missing minute:
return NextResponse.json({
  matchId: match.id,
  status:  match.status,
  score:   match.score,
  lastUpdated: ...,
  source: 'snapshot',
});
```
`MatchLiveZone` calls `setMinute(data.minute ?? null)` — on a snapshot-sourced poll the
minute would be reset to null, causing the badge to revert from `"47'"` to `"LIVE"`.

**Status: ❌ silent regression — fixed in DATA-10.**

---

## Phase 3 — Progress Indicator Audit

No location displayed First Half / Second Half / Stoppage Time / Half Time text.
Progress context helps users understand the match state at a glance.

**Logic needed:**
```
PAUSED            → "Half Time"
IN_PLAY minute ≤ 45 → "First Half"
IN_PLAY minute ≤ 90 → "Second Half"
IN_PLAY minute > 90 → "Stoppage Time"
IN_PLAY minute null → null (no label)
```

Targets: `MatchCard` (card footer) and `MatchLiveZone` (below hero badge).

---

## Phase 4 — Live Health Endpoint Audit

`/api/debug/live-telemetry` and `/api/debug/live-minute` already exist but neither
returns a full health summary including KV age and per-match minute+score in one call.

No endpoint existed for:
- `liveMatches` count
- `kvAgeSeconds` (how old is the live cache)
- `lastRefresh` ISO timestamp
- Status: `ok | stale | empty | kv-disabled`

---

## Summary of Issues Found

| Issue | Location | Severity |
|-------|----------|----------|
| Results page hardcodes `LIVE` for IN_PLAY | `world-cup-2026-results/page.tsx:77` | MEDIUM |
| Results page shows `LIVE` instead of `HT` for PAUSED | `world-cup-2026-results/page.tsx:77` | MEDIUM |
| Snapshot fallback omits `minute` field | `api/live-score/[matchId]/route.ts:83` | MEDIUM |
| No match progress phase indicator anywhere | MatchCard, MatchLiveZone | UX |
| No single live-health diagnostic endpoint | — | OPS |
