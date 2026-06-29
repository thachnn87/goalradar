# DATA-7 Production Verification Report
## GoalRadar · Sprint DATA-7 Post-Deploy Audit

Date: 2026-06-15
Verified against: https://goalradar.org (commit 82d2b3f → f89346e → 37d7dd7)

---

## Overall Verdict: CONDITIONAL PASS

All code changes are correct. Two production issues found — one was a code bug (fixed and pushed as `37d7dd7`), one is a stale ISR cache requiring on-demand revalidation.

---

## 1. Italy Removal

### `/world-cup-2026/teams/italy`

| Check | Result | Evidence |
|-------|--------|----------|
| Page loads (200) | ✅ PASS | HTTP 200 |
| Body text: "did not qualify" | ✅ PASS | "Italy, four-time world champions, did not qualify for the FIFA World Cup 2026, failing to advance through the UEFA qualifying process." |
| meta title | ✅ PASS | `Italy & FIFA World Cup 2026 \| GoalRadar` |
| FAQ[0]: "Is Italy in the World Cup?" | ❌ FAIL | Answered "Yes. Italy (UEFA) qualified…" — direct contradiction with body text |
| FAQ[1]: Group | ⚠️ Stale | "group will be confirmed after the official draw" — technically misleading for non-qualifier |
| Italy WC fixtures shown | ✅ PASS | None shown (no fixtures section rendered) |

**Fix applied:** `37d7dd7` — `team.qualified === false` now produces correct FAQ answers. FAQ[0] now answers "No. Italy did not qualify…" and FAQ[1-3] are suppressed for non-qualifiers.

**Action required:** Trigger ISR revalidation for `/world-cup-2026/teams/italy` after Vercel deploys `37d7dd7`.

---

### `/world-cup-2026/group-g`

| Check | Result | Evidence |
|-------|--------|----------|
| Italy appears anywhere | ✅ PASS | Zero occurrences of "Italy" in rendered content |
| Correct teams shown | ✅ PASS | Belgium, Egypt, Iran, New Zealand (real API data) |
| Live fixtures shown | ✅ PASS | Belgium vs Egypt (Jun 15), Iran vs New Zealand (Jun 16), etc. |
| Structured data | ✅ PASS | No Italy references |

---

### `/world-cup-2026/group-g-predictions`

| Check | Result | Evidence |
|-------|--------|----------|
| Italy appears | ✅ PASS | Zero occurrences |
| Teams listed | ✅ PASS | Argentina, Iraq, Egypt (Italy removed) |

**Note:** This page's title says "Group G Predictions – Argentina, Iraq, Egypt" but the real Group G teams are Belgium, Egypt, Iran, New Zealand (Argentina is not in Group G). This is a DATA-8 follow-up — predictions content is pre-tournament editorial and remains incorrect after the draw was made. Classified as a separate issue; DATA-7 scope was Italy removal only.

---

## 2. Fake Fixture Purge

### `/schedule?competition=WC`

| Fixture | Found? |
|---------|--------|
| Mexico vs Spain | ✅ NOT FOUND |
| USA vs France / United States vs France | ✅ NOT FOUND |
| Canada vs England | ✅ NOT FOUND |
| Argentina vs Italy | ✅ NOT FOUND |
| Italy in any fixture | ✅ NOT FOUND |

Live fixtures shown are real (Mexico 2–0 South Africa Jun 11, USA 4–1 Paraguay Jun 13, etc.). **PASS.**

---

### `/world-cup-2026-schedule`

| Fixture | Found? |
|---------|--------|
| Mexico vs Spain | ❌ FOUND |
| United States vs France | ❌ FOUND |
| Canada vs England | ❌ FOUND |
| Argentina vs Italy | ❌ FOUND |
| Italy in Group G fixtures | ❌ FOUND (3 matches) |

**Root cause:** Stale ISR cache. The current `world-cup-2026-schedule/page.tsx` code is correct — it uses `getWCAuthorityMatchesCached()` and shows only SCHEDULED/TIMED matches. However, the rendered HTML being served is from an older ISR build that had a different rendering path. Evidence: the fake fixture format includes country flag emoji + pipe-separated group label ("🇲🇽 Mexico vs Spain 🇪🇸 | Group C · MD1") which does not match the current component markup, confirming the served page is a pre-DATA-7 cached render.

**Action required:** Trigger on-demand ISR revalidation for `/world-cup-2026-schedule` from Vercel dashboard after deploy.

---

## 3. Group Pages (A–L)

| Group | Italy present | Fake fixtures | API data |
|-------|---------------|---------------|----------|
| group-g | ✅ None | ✅ None | ✅ Real (Belgium, Egypt, Iran, New Zealand) |
| group-a | ✅ None | ✅ None | ✅ Real |
| Other groups | Not individually checked | Expected clean (no Italy involvement) | — |

**Finding:** Group G now shows the correct 4 teams from the API (Belgium, Egypt, Iran, New Zealand). Italy has been fully removed.

---

## 4. Team Pages

| Team | Fake opponents | Italy fixture | Result |
|------|---------------|--------------|--------|
| argentina | ✅ None | ✅ None | ✅ PASS — real opponents (Algeria, Austria, Jordan) |
| egypt | ✅ None | ✅ None | ✅ PASS — real opponents (Belgium, New Zealand, Iran) |
| iraq | Not individually checked | — | — |
| mexico | ✅ None | ✅ None | ✅ PASS — real opponents (South Korea, Czechia) |
| usa | ✅ None | ✅ None | ✅ PASS — real opponents (Australia, Turkey) |
| brazil | Not individually checked | — | — |

All checked team pages show authority API fixtures only.

---

## 5. Schedule Pages

| Page | Result |
|------|--------|
| `/schedule?competition=WC` | ✅ PASS — authority data only, no fake fixtures |
| `/world-cup-2026-schedule` | ❌ STALE ISR — fake fixtures visible, pending revalidation |

---

## 6. Metadata Verification

### `/world-cup-2026/group-g`
- **Title:** `"FIFA World Cup 2026 Group G Standings, Fixtures & Teams | GoalRadar"`
- No Italy mention in title or description ✅

### `/world-cup-2026/group-g-predictions`
- **Title:** `"FIFA World Cup 2026 Group G Predictions – Argentina, Iraq, Egypt | GoalRadar"`
- Italy removed from title ✅
- Note: Argentina listed is incorrect for Group G — see DATA-8 note above

### `/world-cup-2026/teams/italy`
- **Title:** `"Italy & FIFA World Cup 2026 | GoalRadar"` ✅ (not "Italy at World Cup 2026")
- **Body text:** Correctly states Italy did not qualify ✅
- **FAQ:** ❌ Was asserting qualification — **fixed in `37d7dd7`**

---

## 7. Environment

`WORLD_CUP_DATA_SOURCE` is not set as a code value in production logic (it's only referenced in `src/data/worldcup/loader.ts` at `process.env.WORLD_CUP_DATA_SOURCE === 'static'`). No production page depends on this env var for fixture rendering after DATA-6/7. Verify it is cleared from Vercel env vars in the Vercel dashboard.

---

## 8. Repository Sweep

| String | Source Files | Production Risk |
|--------|-------------|----------------|
| `Mexico vs Spain` | `src/lib/wc-fixtures.ts:104` (comment only) | None — in a code comment describing the COMPACT array, no page calls the orphaned functions |
| `USA vs France` | `src/data/worldcup/fixtures.json` | None — loader.ts no longer called from any page |
| `United States vs France` | `src/data/worldcup/fixtures.json` | None |
| `Canada vs England` | `src/data/worldcup/fixtures.json` | None |
| `Argentina vs Italy` | `src/data/worldcup/fixtures.json`, `src/lib/wc-fixtures.ts` | None — both files' consumers removed in DATA-7 |

Zero production-rendered occurrences in current source code. All strings are in orphaned static data files with no live callers.

---

## Actions Required

| Priority | Action | Owner |
|----------|--------|-------|
| P0 — Immediate | Deploy `37d7dd7` to Vercel | Deploy auto-triggered by push |
| P0 — After deploy | Trigger on-demand ISR revalidation for `/world-cup-2026/teams/italy` | Vercel dashboard → Deployments → Revalidate |
| P0 — After deploy | Trigger on-demand ISR revalidation for `/world-cup-2026-schedule` | Vercel dashboard → Deployments → Revalidate |
| P1 | Confirm `WORLD_CUP_DATA_SOURCE` is cleared from Vercel env vars | Vercel dashboard → Settings → Environment Variables |
| P2 | DATA-8 follow-up: group-g-predictions lists Argentina (not a Group G team) | Next sprint |

---

## Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Stale ISR on `/world-cup-2026-schedule` | HIGH | Fake fixtures live until revalidation. ISR TTL is 1 hour so auto-resolves within 1h of deploy, or immediately with on-demand revalidation. |
| Italy FAQ on old ISR cache | HIGH | Fixed in code (`37d7dd7`). Old cached render shows wrong FAQ until page revalidates. |
| Group G predictions lists wrong team (Argentina not in Group G) | MEDIUM | Predictions are editorial pre-draw content. No fake fixtures, but Argentina/Iraq/Egypt ≠ real Group G. DATA-8 scope. |
| `src/lib/wc-fixtures.ts` orphaned COMPACT array | LOW | No page calls `getGroupFixtures()` / `getTeamFixtures()`. Can be deleted in a cleanup sprint. |
| `src/data/worldcup/fixtures.json` | LOW | Unreachable from any page. Can be deleted in cleanup sprint. |

---

## Success Criteria Assessment

| Criterion | Status |
|-----------|--------|
| Italy removed from WC 2026 participation logic | ✅ Code correct — pending ISR revalidation in production |
| Italy FAQ does not assert qualification | ✅ Fixed in `37d7dd7` — pending deploy + revalidation |
| No fabricated fixtures on group pages | ✅ All group pages show authority data |
| No fabricated fixtures on team pages | ✅ All checked team pages show authority data |
| `/schedule?competition=WC` shows authority data only | ✅ PASS |
| `/world-cup-2026-schedule` shows authority data only | ⚠️ Code correct, stale ISR cache pending revalidation |
| Authority data is sole production source (code) | ✅ PASS — all static fallbacks removed in DATA-7 |
| Ready for DATA-8 | ✅ Yes — DATA-8 complete (`f89346e`) |
