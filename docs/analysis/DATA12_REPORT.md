# DATA-12 Report
## GoalRadar · Live Match UX Stabilization

Date: 2026-06-16
Status: COMPLETE

---

## Summary

Two deliverables shipped:

1. **Bug fix** — `mergeSnapshotState()` now propagates `minute` to all list surfaces.
2. **New endpoint** — `/api/debug/minute-health` for runtime minute-layer diagnosis.

---

## Bug Fix — Schedule/List Minute Propagation

**File:** `src/lib/match-state-overlay.ts`

**Root cause:** `mergeSnapshotState()` merged `score` and `lastUpdated` from the
per-match KV snapshot into the list entry but omitted `minute`. Every list surface
(schedule, WC hub, live page cards, homepage, team pages, competition pages) goes
through `overlayMatchStates()` which calls this function. The result: even when the
KV snapshot had a fresh `minute` value, the list entry kept `minute: undefined`,
so `MatchCard` always showed `LIVE` instead of e.g. `45'`.

**Fix (2 lines):**

```typescript
// State advance branch (snapshot ahead in state machine)
- return { ...listMatch, status: snapMatch.status, score: snapMatch.score, lastUpdated: snapMatch.lastUpdated };
+ return { ...listMatch, status: snapMatch.status, score: snapMatch.score, minute: snapMatch.minute, lastUpdated: snapMatch.lastUpdated };

// Same live state branch (snapshot fresher score/minute)
- return { ...listMatch, score: snapMatch.score, lastUpdated: snapMatch.lastUpdated };
+ return { ...listMatch, score: snapMatch.score, minute: snapMatch.minute, lastUpdated: snapMatch.lastUpdated };
```

**Surfaces fixed:** schedule, WC hub, live page cards, homepage live section,
team pages, competition pages — all 6 call-sites in `api.ts`.

---

## New Endpoint — /api/debug/minute-health

**File:** `src/app/api/debug/minute-health/route.ts`

Reports the minute value at all observable layers for every currently live match.

**Request:**
```
GET /api/debug/minute-health?secret=<CRON_SECRET>
```

**Response shape:**
```json
{
  "diagnosis": "NO_LOSS | PROVIDER_LOSS | SNAPSHOT_LOSS | NO_LIVE_MATCHES",
  "liveMatches": 2,
  "kvAgeSeconds": 18,
  "checkedAt": "2026-06-16T19:03:42.000Z",
  "matches": [
    {
      "id": 537391,
      "home": "France",
      "away": "Senegal",
      "status": "IN_PLAY",
      "kvLiveMinute": 67,
      "snapshotMinute": 67,
      "diagnosis": "NO_LOSS",
      "kvAgeSeconds": 18,
      "snapshotAgeSeconds": 22
    }
  ]
}
```

**Diagnoses:**

| Diagnosis | Meaning | Action |
|-----------|---------|--------|
| `NO_LOSS` | All layers have matching minute | None needed |
| `PROVIDER_LOSS` | Provider not returning minute (football-data.org startup lag) | Wait — provider adds minute ~5 min after kickoff |
| `SNAPSHOT_LOSS` | KV live has minute but snapshot doesn't | Force snapshot rebuild: `POST /api/revalidate/match/{id}` |
| `NO_LIVE_MATCHES` | No IN_PLAY / PAUSED matches in KV live cache | Normal outside of match windows |

---

## Surfaces Not Changed

| Surface | Reason |
|---------|--------|
| `MatchLiveZone.tsx` | Minute/HT/progress logic already correct |
| `MatchCard.tsx` | Minute/HT/progress logic already correct |
| `/api/live-score/[id]` | Already returns `minute` field |
| Results page | No dedicated route — finished matches use MatchCard which shows FT, not minute (correct) |

---

## Success Criteria — Status

| Criterion | Status |
|-----------|--------|
| No surface shows LIVE when minute exists | ✅ Fixed via overlay propagation |
| Minute stable through polls | ✅ MatchLiveZone polls `data.minute` correctly |
| All pages show identical minute | ✅ All list surfaces now inherit minute from snapshot |
| TypeScript 0 errors | ✅ Confirmed |
| `/api/debug/minute-health` endpoint | ✅ Created |

---

## Final Verdict: GREEN
