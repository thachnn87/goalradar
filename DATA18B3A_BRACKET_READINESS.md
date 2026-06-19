# DATA-18B.3A Bracket Readiness

**Date:** 2026-06-19
**Verdict: BRACKET_READY**

---

## Summary

The World Cup 2026 bracket page is ready for production activation. All structural, data, and adapter requirements are met.

---

## Evidence

### 1. Authority Cache — All 32 Knockout Slots Present

Full-audit confirms all 32 knockout placeholder slots are present in authority cache:

| Stage | Count | State | Teams |
|-------|-------|-------|-------|
| LAST_32 | 16 | scheduled | TBD (correct) |
| LAST_16 | 8 | scheduled | TBD (correct) |
| QUARTER_FINALS | 4 | scheduled | TBD (correct) |
| SEMI_FINALS | 2 | scheduled | TBD (correct) |
| THIRD_PLACE | 1 | scheduled | TBD (correct) |
| FINAL | 1 | scheduled | TBD (correct) |

No missing knockout slots. No duplicate knockout slots.

### 2. Bracket Page TBD Handling Verified

`src/app/world-cup-2026/bracket/page.tsx` — `canonicalToMatch()` adapter:

- `homeTeam?.name ?? 'TBD'` — graceful TBD label when team not yet assigned
- `awayTeam?.name ?? 'TBD'` — same
- Conditional crest rendering: `match.homeTeam?.crest && (...)` — no broken image for TBD slots
- `utcDate` rendering: shows scheduled kickoff date when available, blank otherwise
- State rendering: `scheduled` → no score shown (correct)

No null pointer errors. No broken crests. No score displayed for unplayed matches.

### 3. Snapshot Coverage for Knockout Matches

All 32 knockout placeholder matches: snapshot present in KV (pre-built stubs).
`snapshotGate: GREEN` for all 32.

When a knockout match is played, the first page visit to `/match/[id]` will populate the full snapshot with goals, lineups, H2H.

### 4. Authority Cache Structural Integrity

From full-audit `structure.stages`:
```json
{
  "GROUP_STAGE": 72,
  "LAST_32": 16,
  "LAST_16": 8,
  "QUARTER_FINALS": 4,
  "SEMI_FINALS": 2,
  "THIRD_PLACE": 1,
  "FINAL": 1
}
```

This exactly matches the WC 2026 bracket format. The bracket page has the complete data to render all rounds.

### 5. AUTHORITY_CACHE_PILOT — Activation Status

- Env var `AUTHORITY_CACHE_PILOT` is currently **not set** in production (Vercel Dashboard).
- Bracket page (`src/app/world-cup-2026/bracket/page.tsx`) reads this flag at build time to switch from legacy FD path to authority cache path.
- **Action required to activate:** Set `AUTHORITY_CACHE_PILOT=true` in Vercel Dashboard → Production environment.
- This is the final gate before bracket goes live on authority cache.

**Note from DATA-18B.2A:** Pilot activation was staged. Full audit now confirms the data layer is ready.

---

## Readiness Checklist

| Requirement | Status | Evidence |
|-------------|--------|---------|
| 32 knockout slots in authority cache | ✅ PASS | full-audit: LAST_32=16, LAST_16=8, QF=4, SF=2, THIRD=1, FINAL=1 |
| No missing knockout slots | ✅ PASS | `duplicateIds: []`, all stage counts match |
| TBD team handling in adapter | ✅ PASS | `canonicalToMatch()` uses `?? 'TBD'` fallback |
| Conditional crest rendering | ✅ PASS | `match.homeTeam?.crest && (...)` |
| Snapshot stubs for knockout matches | ✅ PASS | snapshotGate=GREEN for all 32 |
| 0 authority RED issues for knockout | ✅ PASS | all 32 YELLOW (expected TBD), 0 RED |
| Authority cache operational | ✅ PASS | source=primary, stale=false, liveCount=0 |
| Write-back mechanism deployed | ✅ PASS | commit `32a95c6` |
| DR staleness guard deployed | ✅ PASS | `DR_LIVE_STALE_MAX_MS=120_000` |
| `AUTHORITY_CACHE_PILOT` activated | ⏳ PENDING | Set in Vercel Dashboard to complete |

---

## Activation Instructions

1. Go to Vercel Dashboard → goalradar project → Settings → Environment Variables
2. Add: `AUTHORITY_CACHE_PILOT` = `true` (Production environment)
3. Redeploy or wait for next deployment
4. Verify bracket page in `/api/debug/authority-cache-attribution` — should show `source: authority` for bracket page

**Risk:** LOW. TBD handling is confirmed. Authority cache is operational. Write-back prevents thundering herd. DR staleness guard prevents stale live state.
