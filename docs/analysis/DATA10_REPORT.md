# DATA-10 Report
## GoalRadar · Live UX Hardening — Implementation

Date: 2026-06-16
Commit: 96cb64a
TypeScript: ✅ 0 errors
Constraints: ✅ No provider changes · No new KV keys · No TTL changes

---

## Phase 2 — Minute Rendering

### MatchCard + MatchLiveZone
Already correct pre-DATA-10. Both show `${minute}'` when minute is non-null,
falling back to `LIVE`. No change needed.

### Results page fix (`src/app/world-cup-2026-results/page.tsx`)

**Before:**
```typescript
if (m.status === 'IN_PLAY' || m.status === 'PAUSED')
  return { label: 'LIVE', cls: '...' };
```

**After:**
```typescript
if (m.status === 'IN_PLAY')
  return { label: m.minute != null ? `${m.minute}'` : 'LIVE', cls: '...' };
if (m.status === 'PAUSED')
  return { label: 'HT', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
```

Results: live matches on this page now show `"72'"` instead of `"LIVE"`, and
PAUSED matches show `"HT"` with a yellow badge instead of a red `"LIVE"` badge.

### Snapshot fallback minute fix (`src/app/api/live-score/[matchId]/route.ts`)

Added `minute: match.minute ?? null` to the Step 3 snapshot response. Previously
absent, which caused `MatchLiveZone` to silently reset the displayed minute to null
(showing `"LIVE"` instead of `"47'"`) whenever a poll response came from the
snapshot path.

---

## Phase 3 — Match Progress Indicator

### `matchProgress()` helper

Same logic added independently to both MatchCard and MatchLiveZone (no shared
import needed — each is a simple 5-line function):

```typescript
function matchProgress(status, minute): string | null {
  if (status === 'PAUSED') return 'Half Time';
  if (status !== 'IN_PLAY' || minute == null) return null;
  if (minute <= 45) return 'First Half';
  if (minute <= 90) return 'Second Half';
  return 'Stoppage Time';
}
```

### MatchCard (`src/components/MatchCard.tsx`)

Added after the TeamRow pair:
```tsx
{matchProgress(status, match.minute) && (
  <p className="text-[10px] text-gray-500 mt-2 text-right">
    {matchProgress(status, match.minute)}
  </p>
)}
```

Renders at the bottom-right of every live card. Invisible for FINISHED/SCHEDULED.

### MatchLiveZone (`src/components/MatchLiveZone.tsx`)

Status badge section changed from `<div>` to `<div className="flex flex-col items-center gap-1">`:
```tsx
<div className="flex flex-col items-center gap-1 mb-4">
  <StatusBadge status={status} minute={minute} />
  {matchProgress(status, minute) && (
    <span className="text-[11px] text-gray-500">{matchProgress(status, minute)}</span>
  )}
</div>
```

Shows below the status badge in the match page hero. Updates every poll cycle as
`minute` state changes.

### Rendered output examples

| Minute | Status | Badge | Progress label |
|--------|--------|-------|----------------|
| null | IN_PLAY | `LIVE` | — |
| 23 | IN_PLAY | `23'` | First Half |
| 45 | PAUSED | `HT` | Half Time |
| 67 | IN_PLAY | `67'` | Second Half |
| 90 | IN_PLAY | `90'` | Second Half |
| 93 | IN_PLAY | `93'` | Stoppage Time |

---

## Phase 4 — Live Health Endpoint

**File:** `src/app/api/debug/live-health/route.ts`

```bash
curl "https://goalradar.org/api/debug/live-health?secret=$CRON_SECRET"
```

**Response shape:**
```json
{
  "status": "ok",
  "liveMatches": 3,
  "kvAgeSeconds": 12,
  "lastRefresh": "2026-06-16T17:42:15.000Z",
  "ttlSeconds": 30,
  "checkedAt": "2026-06-16T17:42:27.000Z",
  "matches": [
    {
      "id": 537364,
      "home": "Iran",
      "away": "New Zealand",
      "status": "IN_PLAY",
      "minute": 72,
      "score": { "fullTime": { "home": 0, "away": 1 }, ... }
    }
  ]
}
```

**Status values:**

| Status | Meaning |
|--------|---------|
| `ok` | KV entry fresh (age < 30s) |
| `stale` | KV entry exists but older than 30s (orchestrator may have missed a run) |
| `empty` | KV key missing (no live data written yet) |
| `kv-disabled` | KV env vars not configured |

Reads `goalradar:live:matches` directly — no L1, no provider call.
Auth: `CRON_SECRET` (Bearer or `?secret=`) or `NODE_ENV=development`.

---

## Phase 5 — Verification Notes

Production verification requires a live World Cup match. The following
log patterns confirm correct operation:

**Minute rendering:**
- `/world-cup-2026-results`: match row badge shows `"72'"` not `"LIVE"` during play
- MatchCard on `/live`: badge already showed minute (unchanged)

**Progress indicator:**
- MatchCard cards show `"Second Half"` at bottom-right during second half
- MatchLiveZone hero shows `"Second Half"` below `"72'"` badge

**Snapshot minute fix:**
- Vercel function logs: no longer see `setMinute(null)` resets mid-match
- `/api/live-score/{id}` response includes `minute` field on `source: snapshot` path

**Live health:**
```bash
curl "https://goalradar.org/api/debug/live-health?secret=$CRON_SECRET"
# Expected during a match: { "status": "ok", "liveMatches": 1+, "kvAgeSeconds": <30 }
# Expected when no matches: { "status": "ok", "liveMatches": 0 }
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/MatchCard.tsx` | Add `matchProgress()` helper + progress label below TeamRows |
| `src/components/MatchLiveZone.tsx` | Add `matchProgress()` helper + progress label below badge |
| `src/app/world-cup-2026-results/page.tsx` | `statusBadge()`: IN_PLAY shows minute; PAUSED shows HT |
| `src/app/api/live-score/[matchId]/route.ts` | Add `minute` to snapshot fallback response |

## Files Created

| File | Purpose |
|------|---------|
| `src/app/api/debug/live-health/route.ts` | Live cache health check endpoint |
