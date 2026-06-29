# WC_UX_REPAIR_PLAN.md — DATA-18WC.8D Phase 9

**Date:** 2026-06-24
**Scope:** Repairs ordered strictly by user impact. No implementation yet — this is a prioritized plan only.

---

## TRIAGE SUMMARY

| ID | Finding | Pages Affected | Severity |
|----|---------|---------------|---------|
| U1 | Hub shows wrong teams, 0pts in group standings | Hub | P0 |
| U2 | Team pages show pre-tournament placeholder (all 48 teams) | All 48 team pages | P0 |
| U3 | No upcoming fixtures anywhere (hub, fixtures page, group pages, team pages) | Hub, fixtures, groups, teams | P0 |
| U4 | CANCELLED match shows score in page title ("Panama 0–1 Croatia – Match Result") | `/match/537412` | P0 |
| U5 | Fixtures page is labelled "Upcoming matches" but shows only finished results | Fixtures page | P0 |
| U6 | Hub group D shows 5 teams (impossible) | Hub | P0 |
| U7 | Hub standings contradict hub results section (France in results, not in Group I) | Hub | P0 |
| U8 | Group I page: "No upcoming fixtures for this group yet" with 2 remaining | Group/[slug] pages | P1 |
| U9 | `/matches/[id]` returns 404 (correct is `/match/[id]`) | Any link using plural | P1 |
| U10 | Results pages show different goal totals (139 vs 137) | Both results pages | P1 |
| U11 | Bracket doesn't show actual qualified teams (all TBD despite 6 confirmed) | Bracket page | P2 |
| U12 | No direct link from fixtures page to bracket | Fixtures page | P2 |

---

## P0 REPAIRS — BLOCKING

### U1/U6/U7: Hub Wrong Standings (ISR Stale Cache)

**User impact:** A user visiting the most prominent WC page sees Group A = USA/France/Switzerland/Japan (all 0pts) instead of Mexico/Korea Rep/Czechia/South Africa. Group D shows 5 teams. France appears in Recent Results but not in Group I. This is the most visible bug on the site.

**Root cause:** Hub ISR HTML was baked during pre-tournament or pre-draw window. Orchestrator stall prevents `revalidateWCPaths()` from refreshing it. ISR `revalidate = 30` means Next.js would revalidate after 30 seconds on next request — but only if the page is requested and the ISR background revalidation triggers. If the orchestrator is stalled and no one is hitting the hub, the ISR may not be triggering.

**Fix path:**
1. Restart the orchestrator / resolve the stall (root cause: DATA-18WC.9C finding P1-2)
2. Once orchestrator is running, `revalidateWCPaths()` will call `revalidatePath('/world-cup-2026')`, purging the stale ISR
3. On next request, Next.js will re-run the hub's `getStandingsCached`, `getWCAuthorityMatchesV2`, etc. with fresh KV data
4. If orchestrator cannot be restarted: manually trigger ISR via the `/api/revalidate` endpoint (if it exists) or by hitting the `revalidateWCPaths` function directly in production

**Prerequisite:** Standings KV must contain correct data (confirmed: groups page reads same KV and shows correct data, so KV is valid). The fix is purely ISR purge.

**Expected outcome after fix:** Hub shows correct group standings, correct team names, real points, qualification badges.

---

### U2: Team Pages Show Pre-tournament Placeholder (All 48 Teams)

**User impact:** Every WC team page tells the user "Fixtures load once the tournament begins — Check back from 11 June 2026". The tournament started June 11. France has 2 wins. No fixtures are visible on any team page.

**Root cause:** `getUpcomingMatchesCached('WC')` returns empty (upstream KV absent). `getRecentMatchesCached('WC')` returns 0 team-specific matches either because the recent KV feed is absent or the name-match filter fails for team names. When both return empty, the placeholder renders.

**Fix path (two-part):**

*Part A — Recent matches:* The `wc-recent` KV feed may be absent or not written by the stalled orchestrator. Once the orchestrator restarts, the recent matches task writes this feed. After ISR revalidation (3600s TTL), team pages will show recent results.

*Part B — Upcoming matches:* The `wc-upcoming` KV feed is absent because FD `?status=SCHEDULED,TIMED` returns 0 (all group matches are now either finished or not yet in FD as SCHEDULED). The fix from DATA-18WC.8B applies: use `allMatches` from authority cache, filtered client-side by `effectiveBucket() === 'upcoming'`. This same logic needs to be wired into the team page's upcoming section, not just the hub's upcoming section.

**Alternative short-term fix:** If the placeholder condition is `upcoming.length === 0 && recent.length === 0`, change it to show match history from the authority cache when available. The authority cache has 46 finished WC matches — all team pages should be able to find their team's matches from the authority cache.

**Expected outcome after fix:** France team page shows "France 3-0 Iraq (June 22)", "France 3-1 Senegal (June 16)" as recent results, and France's upcoming matchday 3 fixture.

---

### U3: No Upcoming Fixtures (Hub, Fixtures Page, Group Pages)

**User impact:** Users cannot discover any upcoming WC match from any entry point. Hub shows empty upcoming section. Fixtures page title says "Upcoming" but contains only finished results. Group pages say "No upcoming fixtures for this group yet" despite remaining matchday 3 games. 

**Root cause:** `wc-upcoming` KV feed absent. Authority cache contains 0 upcoming matches (all 47 authority matches are FINISHED/CANCELLED). Group stage matchday 3 matches are not appearing as SCHEDULED in the FD API feed.

**Fix path:**
1. **Short term:** Populate the fixtures page with R32 bracket matches (from `getWCKnockoutMatchesCached()`) — the upcoming R32 matches start July 2. The fixtures page should show these as "upcoming" even if group stage matchday 3 is not yet in FD.
2. **Short term:** Fix the fixtures page label — if it shows only finished matches, rename the section to "Fixtures Archive" or "Group Stage Results" rather than "Upcoming matches & kick-off times"
3. **Medium term:** Ensure orchestrator writes group stage remaining matches to the `wc-upcoming` KV feed — these may need to be sourced from a different FD endpoint that returns TIMED status for matchday 3

**Expected outcome after partial fix:** Fixtures page shows R32 entries (16 upcoming matches starting July 2). Hub upcoming section shows at least R32 first matches.

---

### U4: Cancelled Match Shows Score in Title

**User impact:** `/match/537412` title reads "Panama 0–1 Croatia – Match Result". A user sees what appears to be a match result where Croatia won 1-0. The match is CANCELLED — there is no valid result.

**Root cause (from `WC_MATCH_PAGE_UX_AUDIT.md`):**
```typescript
const hasScore = isFinished && ftH != null && ftA != null
```
`isFinished` check doesn't exclude CANCELLED status. Fix: change `isFinished` to `isFinished && status !== 'CANCELLED'`.

**Fix path:**
```typescript
// Before:
const hasScore = isFinished && ftH != null && ftA != null
// After:
const hasScore = isFinished && status !== 'CANCELLED' && ftH != null && ftA != null
```

**Additionally:** The match page should show "CANCELLED" badge prominently, and the title should read "Panama vs Croatia – Cancelled" rather than "Panama 0–1 Croatia – Match Result".

**Expected outcome after fix:** `/match/537412` title = "Panama vs Croatia – Cancelled". No score displayed. CANC badge visible.

---

### U5: Fixtures Page Labelled "Upcoming" but Shows Only Finished

**User impact:** Users looking for upcoming fixtures follow the natural link to the "Fixtures" page, which is titled "WC 2026 Fixtures — Upcoming matches & kick-off times" but contains 47 finished/cancelled matches only. Discoverable dead end.

**Fix path:**
1. Update page title to "WC 2026 Fixtures — Group Stage Results" (or similar) when no upcoming group stage matches exist
2. Add section for knockout stage upcoming matches (source: bracket KV)
3. OR: add a note "All group stage matches complete — view the [knockout bracket →]"

---

## P1 REPAIRS — HIGH PRIORITY

### U8: Group Page "No Upcoming Fixtures" Despite Remaining Matches

**Fix path:** Same as U3 — when `wc-upcoming` KV is absent, group pages should fall back to showing remaining group stage matches from the authority cache or a static schedule. These are known (matchday 3 of all 12 groups scheduled for ~June 25-26).

### U9: `/matches/[id]` 404 (Should Redirect to `/match/[id]`)

**Fix path:** Add a redirect rule:
```
// next.config.js
{ source: '/matches/:id', destination: '/match/:id', permanent: true }
```

This is a one-line fix that prevents user/external link failures.

### U10: Results Pages Show Different Goal Totals (139 vs 137)

**Fix path:** Audit which matches are included in each page's count. The 2-goal difference likely corresponds to how cancelled match 537412's phantom score (0-1) is included in one page but not the other. Align both pages to use the same authority cache source and exclude CANCELLED match scores from goal tallies.

---

## P2 REPAIRS — NORMAL PRIORITY

### U11: Bracket Shows TBD for All Teams Despite 6 Qualified

The bracket could show actual qualified teams (Mexico, USA, Germany, France, Norway, Argentina) in their R32 seed slots. This is an enhancement — TBD is not wrong per se (seedings are being determined), but confirmed 1st-place finishers could be shown.

### U12: No Link from Fixtures Page to Bracket

Add "View knockout bracket →" link on the fixtures page, especially when showing only finished group matches.

---

## REPAIR SEQUENCING

```
Week 1 (before R32 on July 2):
  U9: /matches redirect (5min — next.config change)
  U4: Cancelled match title fix (30min — one-line code change)
  U1: Orchestrator restart → ISR purge (operations)
  U3 partial: Add R32 matches to fixtures page upcoming section
  U5: Update fixtures page title

Week 1 (after orchestrator healthy):
  U2: Team page fixtures (requires wc-recent feed and ISR revalidation)
  U8: Group page upcoming (same as U3)

Week 2:
  U10: Align results page goal totals
  U11: Show confirmed qualified teams in bracket slots
  U12: Add bracket link from fixtures page
```

---

## GATE: R32 READINESS (July 2)

The first Round of 32 matches begin July 2. Critical UX items that MUST be working before then:

1. ✅ Bracket page correct (already working)
2. ❌ Hub group standings must show real teams (U1 — ISR purge)
3. ❌ Team pages must show fixtures (U2 — needs wc-recent + ISR)
4. ❌ Upcoming fixtures must be discoverable (U3)
5. ❌ Cancelled match page must not show misleading score (U4)

If U1/U2/U3 are not fixed before July 2, users will arrive for knockout matches and see pre-tournament group data on the hub — the most damaging UX scenario.
