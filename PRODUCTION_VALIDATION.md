# PRODUCTION VALIDATION
**Phase:** DATA-18WC.VERIFY Phase 10  
**Date:** 2026-06-25

---

## Changes Deployed in VERIFY Sprint

| # | Change | File |
|---|---|---|
| V1 | Schedule page: `getWCAuthorityMatchesCached` → `getWCAuthorityMatchesV2` | `src/app/world-cup-2026-schedule/page.tsx` |
| V2 | Schedule page: `Match[]` → `CanonicalMatch[]` types throughout | `src/app/world-cup-2026-schedule/page.tsx` |

---

## V1 — Schedule Page Upcoming Fixtures

**What changed:** Schedule page now reads from `goalradar:wc:authority:v1` directly (same source as fixtures, hub, and all knockout pages). Previously used merged KV buckets with FD API window limitation.

**Expected behavior post-fix:**
- `https://www.goalradar.org/world-cup-2026-schedule` shows all upcoming WC matches
- Group stage matches for June 25–26 (today + tomorrow)
- Round of 32 matches starting June 27
- All subsequent knockout rounds (R16, QF, SF, 3P, Final)
- Maximum 48 matches displayed across up to 14 days
- Each match shows: kickoff time ET, team names, stage label
- Matches link to `/match/{id}-home-vs-away`

**Verification steps (run after deployment):**
1. Fetch `https://www.goalradar.org/world-cup-2026-schedule`
2. Count "Upcoming Fixtures" section matches — should be significantly more than 4
3. Confirm Round of 32 matches appear (stage label: "Round of 32", dates starting June 27)
4. Confirm team names are real (e.g., Germany, Brazil, France) not placeholder TBD
5. Verify count matches `/world-cup-2026/fixtures` upcoming section count (both from authority:v1)

**ISR note:** First production ISR after deployment will revalidate within 300s. Stale ISR page may still show 4 matches for up to 5 minutes after deploy.

---

## All 11 Success Criteria — Post-VERIFY Status

| Criterion | Surface | Expected | Status |
|---|---|---|---|
| 1. Upcoming fixtures displays all scheduled matches | `/world-cup-2026-schedule` (post-fix) | 30+ upcoming | ✅ EXPECTED |
| 2. Round of 32: 16 matches | `/world-cup-2026/round-of-32` | 16 | ✅ VERIFIED |
| 3. Round of 16: 8 matches | `/world-cup-2026/round-of-16` | 8 | ✅ VERIFIED |
| 4. Quarter Finals: 4 matches | `/world-cup-2026/quarter-finals` | 4 | ✅ VERIFIED |
| 5. Semi Finals: 2 matches | `/world-cup-2026/semi-finals` | 2 | ✅ VERIFIED |
| 6. Third Place: 1 match | `/world-cup-2026/third-place` | 1 | ✅ VERIFIED |
| 7. Final: 1 match | `/world-cup-2026/final` | 1 | ✅ VERIFIED |
| 8. Bracket Tree and Bracket List render identical match identities | `/world-cup-2026/bracket` | WCBracket tree = round page lists | ✅ VERIFIED (same VM source) |
| 9. Every round page renders same entities as bracket | All round pages | Same match IDs as bracket page | ✅ VERIFIED (single buildKnockoutViewModel) |
| 10. Standings navigation, CompetitionSelector, Navbar, canonical routes consistent | Cross-page | Redirects working, Standings → /world-cup-2026-standings | ✅ VERIFIED |
| 11. Every production discrepancy mapped to root cause before any code change | PRODUCTION_DIVERGENCE.md | D1-D3 all documented | ✅ VERIFIED |

---

## Regression Checks

Verify RESET sprint work is still intact:

| Surface | Check |
|---|---|
| `/world-cup-2026/bracket` | Positional labels still present ("1st Group A – 3rd B/C/D") |
| `/world-cup-2026/round-of-32` | 16 matches with positional labels |
| `/world-cup-2026/third-place-playoff` | Still redirects 301 → `/world-cup-2026/third-place` |
| `/world-cup-2026-standings` | CompetitionSelector visible after hydration |
| Navbar Standings link | → `/world-cup-2026-standings` on WC pages |

No RESET changes were modified in the VERIFY sprint. Only `world-cup-2026-schedule/page.tsx` was edited.
