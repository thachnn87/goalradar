# WC_MATCH_PAGE_UX_AUDIT.md — DATA-18WC.8D Phase 7

**Date:** 2026-06-24
**Method:** Production fetch of match pages `/match/537411` (FINISHED) and `/match/537412` (CANCELLED)

---

## 1. PRODUCTION EVIDENCE

### Match 537411 — England vs Ghana (FINISHED 0-0)

URL: `https://www.goalradar.org/match/537411`

```
Title: "England 0–0 Ghana – Match Result"
Status: FT
Score: 0 – 0
Teams: England vs Ghana
```

**Status:** Title correctly shows "Match Result" and score 0-0. ✅

### Match 537412 — Panama vs Croatia (CANCELLED)

URL: `https://www.goalradar.org/match/537412`

```
Title: "Panama 0–1 Croatia – Match Result"
```

**CRITICAL BUG:** The page title shows:
- Score: 0–1 (implying Croatia won)
- Status label: "Match Result"
- No indication that the match was cancelled

The match is `status: CANCELLED` in the authority cache. A user visiting this URL sees what appears to be a completed match with a score — they cannot tell from the title that the match never completed.

**Root cause (from source analysis):**
```typescript
// match/[id]/page.tsx
const hasScore = isFinished && ftH != null && ftA != null
// ↑ checks isFinished, not status !== 'CANCELLED'
// If snapshot has isFinished=true AND ftH/ftA set, hasScore=true even for CANCELLED
```

The snapshot for match 537412 apparently has `isFinished=true` AND score data present (0-1), causing `hasScore=true`. The title then renders as if it's a complete match result.

---

## 2. AUDIT QUESTIONS

### Q1. LIVE match status — correct?
**UNCONFIRMED — partial evidence**

At audit time, Colombia vs Congo DR was live on the hub ("Colombia 0 Congo DR 0 Half Time"). The direct match page for this live match was not fetched. However:
- Hub correctly shows live match in "Live Now" section (source: `getCurrentLiveMatches()` SSOT)
- Match page has `revalidate = 60` — would update every 60 seconds
- DATA-18WC.9C confirmed `isLiveStatus()` gap for "LIVE" strings — live match page may not show correct in-play status if FD sends "LIVE" instead of "IN_PLAY"

**POSSIBLE P0 — not confirmed** by direct page fetch.

### Q2. FINISHED match status — correct?
**YES** ✅

Match 537411 (England 0-0 Ghana): Title "England 0–0 Ghana – Match Result" is correct. Score present, status consistent.

### Q3. SCHEDULED match status — correct?
**CANNOT CONFIRM** — no upcoming scheduled matches exist in the authority cache (all 47 are FINISHED/CANCELLED). A SCHEDULED match page cannot be tested because there are no upcoming match IDs in the authority cache.

If a user navigates to a future knockout match ID (not yet in authority cache), `getOrBuildMatchSnapshot()` would attempt to build from available sources. If the KV miss results in a fallback or 404, SCHEDULED pages may not be accessible.

### Q4. CANCELLED match status — correct?
**NO — CRITICAL BUG** ❌

Match 537412 (Panama vs Croatia): 
- Title: "Panama 0–1 Croatia – Match Result" — shows score, implies finished
- CANCELLED label: NOT VISIBLE in title
- No "CANC" badge confirmed in title

A user sees a match result that implies Croatia won 1-0. This is misleading. The match was cancelled, and whether 0-1 is a forfeit score or an error is not communicated.

### Q5. Does the match page URL pattern work?
**YES for `/match/[id]`** ✅  
**NO for `/matches/[id]`** ❌

As documented in `WC_UX_PAGE_MAP.md`: `/match/537411` → 200 OK. `/matches/537411` → 404. External links or user bookmarks using the plural form will fail.

### Q6. Do all match status types display correctly?
| Status | Correct Display? | Evidence |
|--------|-----------------|---------|
| FINISHED | ✅ YES | "Match Result", correct score |
| CANCELLED | ❌ NO | Shows "Match Result" with misleading score |
| IN_PLAY | ⚠️ LIKELY (unconfirmed) | Hub shows correct live section; page not direct-tested |
| PAUSED | ⚠️ LIKELY (unconfirmed) | Same live mechanism as IN_PLAY |
| SCHEDULED | ❓ UNCONFIRMED | No SCHEDULED match pages in authority cache to test |

### Q7. Is match metadata (date, venue, competition) visible?
**YES for FINISHED** ✅ — implied from correct title and content structure.
**MISLEADING for CANCELLED** — metadata present but status framing is wrong.

---

## 3. SCORE INCONSISTENCY — RESULTS PAGES

Two results pages show different goal totals:
- `/world-cup-2026/results`: 139 goals
- `/world-cup-2026-results` (legacy): 137 goals

**2-goal discrepancy.** Both show 46 played matches. The difference (2 goals) may correspond to match 537412's phantom score (0-1 = 1 goal) being included in one count but not the other — or to a counting difference in how goals from a specific match are tabulated.

Both pages are accessible (no redirect). Users may see different statistics depending on which page they land on.

---

## 4. SEVERITY RATINGS

| Finding | Severity | Evidence |
|---------|---------|---------|
| CANCELLED match 537412 shows "0–1 Match Result" title — implies Croatia won | **P0** | Confirmed: `/match/537412` title = "Panama 0–1 Croatia – Match Result" |
| `/matches/[id]` returns 404 (should be `/match/[id]`) | **P1** | Confirmed production 404 |
| Results pages show different goal totals (139 vs 137) | **P1** | Both pages confirmed at different totals |
| LIVE match page not direct-tested (isLiveStatus gap risk) | **P1** | DATA-18WC.9C confirms code risk; page not fetched |
| FINISHED match 537411 title correct | ✅ GREEN | Confirmed |
