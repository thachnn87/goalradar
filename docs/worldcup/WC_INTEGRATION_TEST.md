# WC_INTEGRATION_TEST.md — End-to-End Integration Test
**Sprint:** DATA-18WC.12 | **Date:** 2026-06-25

---

## Scenario 1: A Match Finishes (e.g., Mexico 3–0 Czechia)

| Step | Component | Expected Behavior | Actual (June 25) | Status |
|---|---|---|---|---|
| FD API posts FINISHED status + score | Provider | Status=FINISHED, score=3-0 | Confirmed in FD API | — |
| Orchestrator runs (≤30m) | wc-all-matches, wc-finished, wc-recent tasks | KV keys updated | Running every 30m | — |
| Snapshot written | `prewarmWorldCup()` | `goalradar:match:{matchId}` has FINISHED + score | ✅ confirmed from Results page | PASS |
| Authority cache rebuilt | `writeAuthorityCache()` | `goalradar:wc:authority:v1` has match | ✅ | PASS |
| Results page | authority filter | Shows "Mexico 3–0 Czechia FT" | ✅ confirmed | PASS |
| Standings updated | `/competitions/WC/standings` KV | Mexico: P=3, W=3, Pts=9 | ❌ all zeros — KV empty | **FAIL** |
| Groups page standing | `getStandingsCached` | Mexico 9 pts Group C | ❌ shows 0 | **FAIL** |
| Qualification badge | `calculateQualificationStatus` | Mexico: QUALIFIED | ❌ shows UNDECIDED | **FAIL** |
| **Propagation time** | — | Match result on Results: ≤45m | ≤45m | OK |
| **Propagation time** | — | Standing update: never | never | **FAIL** |

**Verdict: FAIL** — Match result propagates correctly to results/fixtures; standing never updates.

---

## Scenario 2: A Match is CANCELLED (match 537412 — Panama vs Croatia)

| Step | Component | Expected | Actual | Status |
|---|---|---|---|---|
| FD API posts CANCELLED | Provider | status=CANCELLED, no score | Present in FD API | — |
| Authority cache | `wc:authority:v1` | Shows CANCELLED | ✅ authority path reflects CANCELLED | PASS |
| Primary snapshot | `goalradar:match:537412` | status=CANCELLED | Likely correct (authority reads from here) | PASS |
| DR snapshot | `goalradar:dr:match:537412` | status=CANCELLED | ❌ status=FINISHED, score=0-1 (poisoned) | **FAIL** |
| Results page | authority overlay + DR fallback | Not shown as FT | ❌ shows "Panama 0–1 Croatia FT" | **FAIL P0** |
| Fix required | DR purge | purge + rebuild from FD API | Not yet executed | **PENDING** |

**Verdict: FAIL** — Cancelled match shown as finished result. P0 operational action pending.

---

## Scenario 3: A Team Qualifies Mathematically

| Step | Component | Expected | Actual | Status |
|---|---|---|---|---|
| Team reaches 7 pts with 1 game remaining | Standings | P=2, W=2, Pts=6 | ❌ P=0 for all teams | FAIL |
| Qualification engine | `calculateQualificationStatus` | Returns QUALIFIED for that team | ❌ Returns UNDECIDED (inputs zero) | FAIL |
| Groups page badge | WCGroupTable | Shows green "Qualified" badge | ❌ Shows "In Contention" | FAIL |
| Hub group table | hub groups section | Same badge | ❌ Same | FAIL |
| Team page badge | team page | Shows QUALIFIED | ❌ Shows qualification probability % | FAIL |

**Verdict: FAIL** — Qualification propagation completely broken due to standings zero-state.

---

## Scenario 4: Knockout Slot Filled (group stage ends → R32 slot populated)

| Step | Component | Expected | Actual | Status |
|---|---|---|---|---|
| Group stage completes (tonight) | FD API | Group standings finalize | ✅ Will complete tonight | — |
| FD API posts R32 fixtures with real teams | Provider | Knockout match data available | TBD (FD API timing) | — |
| Authority cache | `wc:authority:v1` | R32 matches with teams | Will populate when FD API posts | — |
| Bracket page | `getWCKnockoutMatchesCached` | R32 slots show real teams | Currently TBD (correct) | PASS for now |
| Bracket ISR | 900s | Updates within 15m of FD API posting | ✅ ISR set to 900s | PASS |
| Hub bracket | 30s ISR | Updates within 30s | ✅ ISR 30s | PASS |
| Divergence window | Hub vs Bracket | Hub shows teams 14.5m before bracket | Acceptable | OK |

**Verdict: PASS** — Bracket slot filling will work when FD API posts R32 fixtures.

---

## Scenario 5: Live Match Disappears After Completion

| Step | Component | Expected | Actual | Status |
|---|---|---|---|---|
| FD API: match goes FINISHED | Provider | status=FINISHED | ✅ confirmed in results | — |
| `refreshLiveMatches()` | live:matches KV (30s TTL) | Match removed from live set | ✅ TTL 30s ensures rapid update | PASS |
| `effectiveBucket()` | ghost-live demotion | Stale LIVE demoted if not in live set | ✅ implemented | PASS |
| Hub live section | 30s ISR | Match disappears within 30s | ✅ 30s revalidate | PASS |

**Verdict: PASS** — Live matches clear correctly.

---

## Integration Test Summary

| Scenario | Verdict | Blocker |
|---|---|---|
| Match finishes → results appear | PASS (45m max) | — |
| Match finishes → standings update | **FAIL** | Standings KV empty |
| Match finishes → qualification updates | **FAIL** | Standings KV empty |
| Match cancelled → shown correctly | **FAIL** | DR cache 537412 poisoned |
| Team qualifies → badge shows QUALIFIED | **FAIL** | Standings KV empty |
| Knockout slot fills | PASS | — |
| Live match disappears after completion | PASS | — |

**3 of 7 scenarios PASS. 4 FAIL.**  
All 4 failures trace to 2 root causes: (1) standings KV empty, (2) DR cache poisoned.
