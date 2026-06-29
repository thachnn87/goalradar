# WC_DATA_INTEGRITY_RISK_REGISTER.md — DATA-18WC.9C Phase 7

**Date:** 2026-06-24
**Method:** Evidence synthesis from Phases 1–6; production scan at 2026-06-24T02:17Z
**Classification:** P0 = site-breaking / incorrect match results shown. P1 = wrong status/state shown to users. P2 = degraded enrichment or display. P3 = theoretical / edge-case risk.
**Evidence categories:** PROVEN = confirmed in production data. THEORETICAL = plausible from code analysis but not observed in production.

---

## P0 RISKS — Site-Breaking or Incorrect Match Results

### P0-1: Status="LIVE" Snapshot DR Poison — 30-Day Survival
**Priority:** P0
**Evidence:** PROVEN
**Source files:** `src/lib/match-snapshot.ts`, `src/lib/providers/football-data.ts`

**Description:**
FD v4 returns `status: "LIVE"` for in-play WC 2026 matches. `isLiveStatus("LIVE")` returns false. `writeDRSnapshot()` is called unconditionally — no status guard. The DR snapshot (`goalradar:dr:match:{id}`) carries `status: "LIVE"` with a 30-day TTL.

When the orchestrator is stalled (confirmed at scan time) or rate-safe is active, primary Detail KV expires and the system reads from DR Detail KV, which also carries "LIVE". Every snapshot rebuild re-reads "LIVE" from DR Detail, re-writes it to Snapshot KV, and resets the DR Snapshot 30-day clock. The cycle is self-perpetuating.

**User-visible impact:**
- Match page title renders as "LIVE — TeamA vs TeamB" instead of "CANCELLED — TeamA vs TeamB"
- `StatusPill` renders raw `<span>LIVE</span>` (no case) instead of styled cancelled badge
- `isLive = status === 'IN_PLAY' || status === 'PAUSED'` → false, so live layout doesn't activate (partially mitigating)
- `classifyMatchState()` with "LIVE" → falls to `'other'` bucket → match excluded from live bucket on WC hub
- `STATE_RANK["LIVE"]` = undefined → overlay comparisons produce unexpected results

**Confirmed production evidence:** Match 537412 had `snapshotStatus: "LIVE"` in an earlier production call (DATA-18WC.9). At 02:17 scan, snapshot has expired but DR key status is unknown (endpoint does not inspect DR directly).

**Self-heals without intervention?** NO — Snapshot DR is re-poisoned on every rebuild. Requires manual DR key deletion.

**Fix:** `isLiveStatus()` must include "LIVE"; `normalizeFDStatus("LIVE")` → `'IN_PLAY'` at FD provider boundary. See WC_DATA_INTEGRITY_REMEDIATION.md §R1.

---

### P0-2: deriveState("LIVE") Returns Wrong Canonical State
**Priority:** P0
**Evidence:** PROVEN (by code analysis; confirmed "LIVE" reaches authority build path)
**Source files:** `src/lib/canonical-match.ts`

**Description:**
`deriveState()` in `canonical-match.ts` does not handle "LIVE". The function has explicit branches for `IN_PLAY/PAUSED → 'live'`, `FINISHED → 'finished'`, `CANCELLED/POSTPONED/SUSPENDED → 'cancelled'`, and a fallthrough. "LIVE" falls through.

The fallthrough's return value determines the canonical state stored in the authority cache for any match that has `status: "LIVE"` as the resolved status.

**User-visible impact:**
- WC hub `classifyMatchState()` checks `match.state` first. If state='scheduled' (or 'cancelled') for a live match, it won't appear in the live bucket, even if the match is actively in play.
- Fixtures page, schedule page, bracket — all use `match.state` from authority.

**Note:** For match 537412, authority correctly shows 'cancelled' because authority reads from the FD finished/all-matches feeds (which return CANCELLED for this match), not from the poisoned snapshot. The risk materializes if FD bulk feed itself returns "LIVE" for a match AND coldRebuild uses the bulk feed status as the resolved status.

**Fix:** `deriveState()` must include 'LIVE' → 'live'. Same normalization fix at FD provider boundary resolves upstream.

---

## P1 RISKS — Wrong Status or State Shown to Users

### P1-1: STATE_RANK["LIVE"] = undefined → Forward-Only State Machine Breaks
**Priority:** P1
**Evidence:** PROVEN (code analysis; "LIVE" confirmed in production)
**Source files:** `src/lib/match-state-overlay.ts:STATE_RANK`

**Description:**
`STATE_RANK` maps every `MatchStatus` to a numeric rank for the forward-only state machine. "LIVE" is absent. JavaScript property access on a missing key returns `undefined`. `undefined ?? 0` = 0 (SCHEDULED level).

In `mergeSnapshotState()`: if `snapRank > listRank`, the snapshot status overrides the list status. "LIVE" (rank=0) never overrides FINISHED (rank=3) or IN_PLAY (rank=2). This means:
- A match that has been FINISHED in the FD feed will NOT have its correct status overridden by a "LIVE" snapshot → authority correctly shows FINISHED
- But a match that is SCHEDULED in the FD feed CAN have its status overridden by a "LIVE" snapshot if "LIVE" is ever treated as a higher rank (which it currently isn't)

The net effect is that "LIVE" in a snapshot is silently ignored in the overlay. This partially prevents the authority from being poisoned by "LIVE" snapshots — but it's accidental, not designed.

**Risk:** If FD changes behavior and "LIVE" replaces "IN_PLAY" in their live feed query results, all live matches would have rank=0 and be treated as SCHEDULED, disappearing from the live bucket.

**Fix:** Add `'LIVE': 2` to STATE_RANK (or normalize "LIVE" → "IN_PLAY" upstream).

---

### P1-2: Orchestrator Stall — All Primary KV Expiring
**Priority:** P1
**Evidence:** CONFIRMED PRODUCTION (authority 7442s old, verdict=RED)
**Source files:** `src/app/api/cron/orchestrator/route.ts`

**Description:**
The orchestrator has not run successfully for at least 7442 seconds (~2h). All primary KV keys with TTL < 7442s have expired. Consumers are falling through to DR.

**Current DR ages at scan time:**
- Authority DR: 2h+ old
- Finished feed: 3.1h old (within tolerance for finished data)
- Upcoming feed: absent (both primary and DR)
- Live cache: absent (30s TTL; expired)

**User-visible impact:**
- WC hub shows data from 2h ago — no newly started matches would appear as live
- Match pages for matches that have changed state in the last 2h may show stale status
- Live clock doesn't advance (live cache absent)

**Cause:** Unknown at time of scan — cron trigger failure, rate-safe mode, or deployment issue.

**Self-heals?** YES — once orchestrator recovers and runs, all primary keys are refreshed within one orchestrator cycle (~5-10 minutes).

---

### P1-3: isLive Guard Gap on Match Page
**Priority:** P1
**Evidence:** PROVEN (code analysis)
**Source files:** `src/app/match/[id]/page.tsx`

**Description:**
```typescript
const isLive = status === 'IN_PLAY' || status === 'PAUSED';
```
If status="LIVE" on a match page, `isLive=false`. The page renders in "preview" layout mode instead of "live" layout mode. The live badge, live clock, and live data refresh are not activated even if the match is genuinely in progress.

**Fix:** Use `isLiveStatus()` helper (after fixing the helper to include "LIVE"), or normalize at source.

---

### P1-4: StatusPill Has No Case for "LIVE"
**Priority:** P1  
**Evidence:** PROVEN (code analysis)
**Source files:** `src/components/StatusPill.tsx` (inferred from session summary)

**Description:**
`StatusPill` renders each known status with a styled badge. "LIVE" has no case → renders `<span>LIVE</span>` with no styling. Users see the raw provider string.

**Fix:** Normalize at source (eliminates the need for this fix) OR add "LIVE" → "IN_PLAY" rendering alias in StatusPill.

---

## P2 RISKS — Degraded Enrichment or Display

### P2-1: C2_TEAM_ID Flag — ESPN Event Team ID Mismatch (Non-Blocking)
**Priority:** P2
**Evidence:** THEORETICAL (code analysis)
**Source files:** `src/lib/canonical-match.ts:validateCanonicalMatch()`

**Description:**
`validateCanonicalMatch()` checks that goal/booking/sub event `team.id` values match `homeTeam.id` or `awayTeam.id`. ESPN uses its own string-based team IDs. `parseInt(espnTeam.id)` may not match FD team IDs. When the C2_TEAM_ID check fails, the `integrity` field on CanonicalMatch is flagged, but goals/bookings are still written to the snapshot.

**User-visible impact:** Goals/bookings may be attributed to the wrong team (or no team), or not displayed at all.

**Evidence in production:** Not confirmed in production scan. The state-divergence endpoint does not expose C2_TEAM_ID failures.

**Fix:** Improve ESPN team ID reconciliation in `espn.ts`.

---

### P2-2: AF Failover Produces Synthetic TLA/ShortName
**Priority:** P2
**Evidence:** THEORETICAL (code analysis; no confirmed AF failover during WC 2026)
**Source files:** `src/lib/providers/api-football.ts:normaliseTeam()`

**Description:**
During FD rate-limit (rate-safe mode), AF becomes the primary provider. AF has no `shortName` field; `normaliseTeam()` sets `shortName = name` and `tla = name.slice(0,3).toUpperCase()`. For WC teams: "South Korea" → tla="SOU" (correct FD value: "KOR"); "Saudi Arabia" → tla="SAU"; "Costa Rica" → tla="COS".

**User-visible impact:** Match cards with wrong TLA; compact name display wrong.

**Self-heals?** YES — once FD primary recovers, next prewarm overwrites with correct values.

---

### P2-3: parseRound() Falls Through for Unknown Stage Names
**Priority:** P2
**Evidence:** THEORETICAL (code analysis)
**Source files:** `src/lib/providers/api-football.ts:parseRound()`

**Description:**
"3rd Place Playoff" is not in `parseRound()` string matching. Would produce `stage: "3rd Place Playoff"` (raw string). Bracket routing compares against exact constants like `'THIRD_PLACE'`. Raw string would break the bracket component rendering for that match.

**Evidence:** WC 2026 third-place match not yet played. Risk materializes when it is.

---

### P2-4: ESPN Lineup Roster Ordering Assumption
**Priority:** P2
**Evidence:** THEORETICAL
**Source files:** `src/lib/providers/espn.ts`

**Description:**
`parseLineups()` assumes `rosters[0]=home, rosters[1]=away`. If ESPN reorders or adds a neutral roster, lineups would be swapped. No validation of team ID against home/away.

**User-visible impact:** Home and away lineups swapped on match page.

---

## P3 RISKS — Theoretical / Edge-Case

### P3-1: FD Returns "AWARDED" for Walkover Match
**Priority:** P3
**Evidence:** THEORETICAL (documented FD status, not observed in production)

"AWARDED" is a documented FD v4 status for technical wins/walkovers. `MatchStatus` type does not include it. Same normalization gap as "LIVE". No confirmed WC 2026 walkovers.

---

### P3-2: AF `competition.code` Falls Through to Empty String
**Priority:** P3
**Evidence:** THEORETICAL (AF failover during FD rate-limit)

`Object.keys(COMPETITION_MAP).find(...)  ?? ''` — empty string if AF leagueId not in COMPETITION_MAP. WC competition is in the map, so this requires COMPETITION_MAP to be wrong or AF to change their leagueId for WC.

---

### P3-3: Future FD Status Values
**Priority:** P3
**Evidence:** THEORETICAL

FD v4 has added at least two statuses not in the original spec ("LIVE", "AWARDED"). Future additions (e.g., "WALKOVER", "DISQUALIFIED", "VOID") would follow the same pattern — raw string passing through all guards.

---

## RISK SUMMARY TABLE

| ID | Risk | Priority | Evidence | Self-Heals? | Impact |
|----|------|---------|---------|------------|--------|
| P0-1 | status="LIVE" Snapshot DR 30d poison cycle | **P0** | PROVEN | NO | Wrong status, badge, routing |
| P0-2 | deriveState("LIVE") → wrong canonical state | **P0** | PROVEN | NO | Wrong bucket on WC hub |
| P1-1 | STATE_RANK["LIVE"]=undefined → overlay incorrect | P1 | PROVEN | NO | Live detection failure |
| P1-2 | Orchestrator stall — primary KV expiring | P1 | CONFIRMED | YES (on recovery) | Stale data serving |
| P1-3 | isLive guard misses "LIVE" | P1 | PROVEN | NO | Live layout not activated |
| P1-4 | StatusPill no case for "LIVE" | P1 | PROVEN | NO | Raw "LIVE" string in UI |
| P2-1 | C2_TEAM_ID non-blocking — wrong goals served | P2 | THEORETICAL | YES (slowly) | Wrong scorers shown |
| P2-2 | AF failover synthetic TLA/shortName | P2 | THEORETICAL | YES (on FD recovery) | Wrong team display |
| P2-3 | parseRound() falls through for 3rd-place | P2 | THEORETICAL | NO | Bracket break for 3rd-place |
| P2-4 | ESPN lineup roster ordering assumption | P2 | THEORETICAL | NO | Lineups swapped |
| P3-1 | FD "AWARDED" status not handled | P3 | THEORETICAL | NO | Same as "LIVE" |
| P3-2 | AF competition.code → empty string | P3 | THEORETICAL | NO | WC routing failure on AF failover |
| P3-3 | Future FD status values | P3 | THEORETICAL | NO | Unknown runtime behavior |
