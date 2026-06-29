# WC_UPCOMING_UX_AUDIT.md — DATA-18WC.8D Phase 2

**Date:** 2026-06-24
**Method:** Production page fetches at https://www.goalradar.org
**Focus:** Can users discover upcoming WC matches?

---

## 1. PRODUCTION EVIDENCE

### WC Hub Upcoming Section

```
Upcoming Matches
No upcoming fixtures available
Upcoming matches will appear here once scheduled
```

**Confirmed EMPTY.** The hub shows "No upcoming fixtures available" for the Upcoming Matches section.

### WC Fixtures Page

- Title: "WC 2026 Fixtures (47 matches) — Upcoming matches & kick-off times"
- Content: Shows 47 finished/cancelled group stage matches with FT scores
- Last entry: "Panama vs Croatia — 23:00 UTC CANC Panama – Croatia –"
- No Round of 32 fixtures shown
- No remaining group stage fixtures shown

**Confirmed: The fixtures page does NOT show upcoming matches.**

### Group I Detail Page

```
Upcoming Fixtures
No upcoming fixtures for this group yet.
```

Yet Group I status shows "4/6 played" (2 matches remaining). The upcoming Group I matches (France/Norway matchday 3 and Senegal/Iraq matchday 3) are NOT showing.

---

## 2. AUDIT QUESTIONS

### Q1. Does it show all future matches?
**NO** ❌ 

The "Upcoming Matches" section on the hub is empty. The fixtures page shows only finished matches. Neither source shows the remaining group stage matches (matchday 3 for most groups) or the Round of 32 onwards.

**Evidence:** Production scan 2026-06-24T02:17Z — `"upcoming": { "present": false, "count": 0, "drPresent": false }` — upstream KV feed for upcoming matches is completely absent.

### Q2. Does it show knockout fixtures?
**NOT IN FIXTURES/UPCOMING SECTIONS** ❌

The bracket page shows the Round of 32 structure with TBD teams and correct dates (Jun 28 – Jul 9). The hub also shows the bracket mini-widget with TBD slots. But neither the Fixtures page nor the Upcoming Matches section shows these knockout fixtures.

A user looking for "upcoming fixtures" would find: empty section on the hub and 47 finished matches on the fixtures page.

### Q3. Does it show Round of 32?
**Only on the bracket page** ⚠️

The bracket page correctly shows all 16 Round of 32 matches with dates and "TBD" teams. The first R32 match date shown: "2 Jul, 17:00 UTC". This is discoverable from the hub sidebar bracket widget and the bracket page.

Not discoverable via: Fixtures page, Upcoming section, Team pages.

### Q4. Does it show Round of 16?
**Only on the bracket page** ⚠️

Round of 16 is on the bracket page with dates "12–15 July". Team slots show "Winner R32 M1" etc. — not linked until R32 is played.

### Q5. Does it show correct kickoff times?
**YES on the bracket** ✅, **NO elsewhere** ❌

The bracket page shows kickoff times for all knockout matches (e.g. "2 Jul, 17:00 UTC"). The fixtures page shows times for finished group matches (correct historical times).

Remaining group stage matches (matchday 3) have no kickoff times shown anywhere on the site.

### Q6. Does it become empty after group stage?
**YES** ❌ — CONFIRMED PRODUCTION DEFECT

The "Upcoming Matches" section on the hub shows empty specifically because the FD upcoming feed filter (`?status=SCHEDULED,TIMED`) returns 0 matches when all scheduled group stage matches complete. The DATA-18WC.8B fix handles this for the authority cache but not for the hub's upcoming section.

The fixtures page shows only finished matches — it has become a "Results Archive" rather than a forward-looking fixtures page.

### Q7. Can a user discover future fixtures easily?
**VERY DIFFICULT** ❌

Paths available to a user:
- Hub → "No upcoming fixtures available" → dead end
- Fixtures page → 47 finished matches → no upcoming matches → dead end
- Bracket page → can see Round of 32 dates (TBD teams) → minimal

The only useful path is the bracket page, but it doesn't show remaining group matches (matchday 3).

---

## 3. SEVERITY RATINGS

| Finding | Severity | Evidence |
|---------|---------|---------|
| Hub shows "No upcoming fixtures available" | **P0** | Confirmed production HTML |
| Fixtures page shows only finished matches | **P0** | Confirmed production HTML — "47 matches", all FT |
| Remaining group stage matchday 3 not discoverable | **P0** | Upstream upcoming KV absent; FD API not returning SCHEDULED matches |
| Knockout R32 only visible on bracket page | **P1** | Bracket page renders correctly; other entry points missing |
| Group I page "No upcoming fixtures for this group yet" despite 2 remaining | **P1** | Confirmed production HTML |

---

## 4. ROOT CAUSES

| Issue | Root Cause |
|-------|-----------|
| Upcoming KV feed absent | FD `?status=SCHEDULED,TIMED` query returns 0 matches post-group-stage active phase |
| Hub empty upcoming | Authority cache upcoming filter relies on KV upcoming feed; DATA-18WC.8B coldRebuild fallback doesn't feed the Hub's upcoming matches section |
| Fixtures page shows only finished | Fixtures page reads from authority cache which has 0 upcoming matches (all 47 authority matches are FINISHED/CANCELLED) |
| R32 dates not in fixtures | Knockout matches are served from a separate bracket feed (`getWCKnockoutMatchesCached`), not the authority cache |
| Matchday 3 not shown | Remaining group stage matches appear to not be in the FD API yet as SCHEDULED entries OR are SCHEDULED but not in the authority cache's source feeds |
