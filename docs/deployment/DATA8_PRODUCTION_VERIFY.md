# DATA-8 Production Verification Report
## GoalRadar · Sprint DATA-8 Post-Deploy Audit

Date: 2026-06-15
Verified against: https://goalradar.org (DATA-8 deploy: f89346e)
Hotfix applied during audit: 777dc3a (group format normalisation)

---

## Overall Verdict: FAIL → HOTFIX APPLIED → PENDING ISR REVALIDATION

DATA-8 introduced a critical regression: football-data.org WC 2026 standings API returns group as `'Group G'` (space, mixed case) while the code assumed `'GROUP_G'` (underscore, uppercase). This caused:

1. Group pages showing empty standings ("Standings will appear once matches begin")
2. Team pages showing "Group Group A" badge and FAQ answers
3. Group letter links on teams page linking to non-existent `/world-cup-2026/group-group a`
4. `generateMetadata` finding no group teams → empty SEO team names

**Hotfix `777dc3a` applied and pushed.** All affected files now normalise both formats → single letter. Pending Vercel deploy + ISR revalidation to take effect in production.

---

## Detailed Findings

### 1. `/world-cup-2026/group-g`

| Check | Status | Evidence |
|-------|--------|----------|
| Standings table shows real teams | ❌ FAIL | "Standings will appear once matches begin on 11 June 2026." — empty state, despite tournament being live |
| Teams section shows Belgium, Egypt, Iran, New Zealand | ❌ FAIL | No dedicated Teams section rendered (requires non-empty tableEntries) |
| Match fixture cards show correct teams | ✅ PASS | Belgium vs Egypt, Iran vs New Zealand etc. appear via match data (separate filter path unaffected) |
| FAQ "Which teams are in Group G?" names teams | ❌ FAIL | "Group G at the FIFA World Cup 2026 features four teams: ." — team list is empty string |
| FAQ "Who is the favourite?" uses authority data | ❌ FAIL | "All teams enter Group G with a genuine chance of qualification." — topTeam is undefined (groupTeams derived from empty tableEntries) |
| metadata team list from standings API | ❌ FAIL | groupTableMeta is null (find fails on `s.group === 'GROUP_G'`), teamsText = '' |
| Italy present | ✅ PASS | Zero occurrences |

**Root cause:** `standingsResult.value.standings.find(s => s.group === 'GROUP_G')` returns null because API returns `s.group = 'Group G'`. Fixed in `777dc3a`: find now uses `normalizeGroupLetter(s.group) === letter`.

---

### 2. `/world-cup-2026/teams/south-africa`

| Check | Status | Evidence |
|-------|--------|----------|
| Group badge shows correct group | ❌ FAIL | Badge text: **"Group Group A"** (double "Group") |
| FAQ group answer is correct | ❌ FAIL | "South Africa are in **Group Group A** at the FIFA World Cup 2026." |
| Related links group label | ❌ FAIL | "**Group Group A** Standings" |
| Group link points to correct page | ❌ FAIL | Link renders as `/world-cup-2026/group-group a` (invalid URL) |
| Standing row shown (API data used) | ✅ PASS | Standing row: "🇿🇦 South Africa 1 - 2 0 - 0 - 1 0" (position from authority standings) |
| Group is Group A (correct per API) | ✅ PASS | South Africa IS in Group A (real draw), shown correctly despite format bug |

**Root cause:** `standingGroupLabel = (tables[i].group ?? '').replace('GROUP_', '')` where `tables[i].group = 'Group A'` → no match → `standingGroupLabel = 'Group A'` → badge renders "Group Group A". Fixed in `777dc3a`: two-step replace handles both formats.

---

### 3. `/world-cup-2026/teams` (By Group tab)

| Check | Status | Evidence |
|-------|--------|----------|
| By Group tab uses authority standings | ✅ PASS | Authority data IS used — South Africa under Group A (correct) |
| Group labels correct | ❌ FAIL | Labels show "Group Group A", "Group Group B", etc. |
| Group links valid | ❌ FAIL | Links render as `/world-cup-2026/group-group a` (invalid) |
| South Africa in Group A (not J) | ✅ PASS | South Africa listed under Group A — correct per draw |

**Root cause:** `const letter = (t.group ?? '').replace('GROUP_', '')` → same format mismatch. Fixed in `777dc3a`.

---

### 4. `/world-cup-2026-groups`

| Check | Status | Evidence |
|-------|--------|----------|
| Live Group Standings shown | ✅ PASS | "Live Group Standings" heading displayed |
| STATIC_GROUPS fallback not rendered | ✅ PASS | Real teams shown per group (e.g. Group A: Mexico, Korea Republic, Czechia, South Africa) |
| Group letter labels | ✅ PASS | Shows "Group A"–"Group L" (index-based — coincidentally correct since API returns groups in order) |
| Group links valid | ✅ PASS | Links to `/world-cup-2026/group-a` etc. |
| No fake teams | ✅ PASS | All 12 groups show real tournament participants |

**Note:** Index-based letter derivation (`String.fromCharCode(65 + i)`) works here because the standings API returns groups in alphabetical order. Fixed in `777dc3a` to use `normalizeGroupLetter(st.group)` with index fallback for safety.

---

### 5. `/world-cup-2026-standings`

| Check | Status | Evidence |
|-------|--------|----------|
| "Pre-tournament lineup" banner absent | ✅ PASS | No such banner found |
| Heading is "Live Group Standings" | ✅ PASS | "Live Group Standings" confirmed |
| Real teams shown per group | ✅ PASS | Group G: Egypt, Belgium, Iran, New Zealand (0 pts each, tournament just started) |
| No static data | ✅ PASS | `isStaticData` flag removed, `getStaticWCGroupTables()` removed |

---

### 6. Production HTML Search — Fake Fixture Strings

Searched across all checked pages:

| String | Occurrence Type | Status |
|--------|----------------|--------|
| Italy (as WC participant) | Visible content | ✅ PASS — zero on group/fixture pages; only on teams/italy page where it correctly states "did not qualify" |
| Italy (in match fixtures) | Visible content | ✅ PASS — zero on all checked pages |
| Mexico vs Spain | Visible content | ❌ FAIL — `/world-cup-2026-schedule` stale ISR (separate from DATA-8; noted in DATA7_PRODUCTION_VERIFY.md) |
| USA vs France | Visible content | ❌ FAIL — `/world-cup-2026-schedule` stale ISR only |
| Canada vs England | Visible content | ❌ FAIL — `/world-cup-2026-schedule` stale ISR only |
| Argentina vs Italy | Visible content | ❌ FAIL — `/world-cup-2026-schedule` stale ISR only |

All fake fixture strings are isolated to `/world-cup-2026-schedule` stale ISR cache (pre-DATA-7 render). No other page is affected. See DATA7_PRODUCTION_VERIFY.md for that issue.

---

### 7. ISR Freshness

| Page | Revalidate TTL | Status |
|------|---------------|--------|
| `/world-cup-2026/group-g` | 3600s (1h) | ❌ STALE — serving DATA-8 buggy render |
| `/world-cup-2026/teams/south-africa` | 3600s (1h) | ❌ STALE — "Group Group A" bug live |
| `/world-cup-2026/teams` | 86400s (24h) | ❌ STALE — "Group Group A" links; will NOT auto-resolve in reasonable time |
| `/world-cup-2026-groups` | 3600s (1h) | ✅ FRESH — live standings, no regression |
| `/world-cup-2026-standings` | 3600s (1h) | ✅ FRESH — live standings, no regression |
| `/world-cup-2026-schedule` | 3600s (1h) | ❌ STALE — pre-DATA-7 fake fixtures (separate issue) |

---

## Hotfix Applied: `777dc3a`

**Root cause:** football-data.org returns standings `group` field as `'Group G'` (WC 2026 format) not `'GROUP_G'` (assumed format). Match data correctly uses `'GROUP_G'` — an inconsistency within the same API.

**Fix — two-step normalisation in all consumers:**
```typescript
// Handles both 'GROUP_G' (old format) and 'Group G' (WC 2026 standings format)
(group ?? '').replace('GROUP_', '').replace(/^Group\s+/i, '').trim()
// → 'G' in both cases
```

**Files changed:**
| File | Site fixed |
|------|-----------|
| `[group]/page.tsx` | `liveGroupTable` find + `generateMetadata` groupTableMeta find |
| `teams/[slug]/page.tsx` | `standingGroupLabel` extraction |
| `teams/page.tsx` | `byGroup` letter extraction |
| `world-cup-2026-groups/page.tsx` | Live standings group letter (with index fallback) |

TypeScript: ✅ 0 errors. Build: ✅ clean (234/234 pages).

---

## Required Actions

| Priority | Action | Path |
|----------|--------|------|
| P0 — Verify | Confirm `777dc3a` deployed on Vercel | Vercel dashboard → Deployments |
| P0 — Revalidate | `/world-cup-2026/teams/south-africa` and all team pages | Vercel → On-demand revalidation, or wait ≤1h |
| P0 — Revalidate | `/world-cup-2026/teams` — **24h TTL, must revalidate manually** | Vercel → On-demand revalidation |
| P0 — Revalidate | All `/world-cup-2026/group-*` pages | Vercel → On-demand revalidation, or wait ≤1h |
| P1 — Revalidate | `/world-cup-2026-schedule` — stale ISR with fake fixtures | Vercel → On-demand revalidation |
| P1 | Clear `WORLD_CUP_DATA_SOURCE` from Vercel env vars | Vercel → Settings → Environment Variables |

---

## Remaining Risks After Hotfix

| Risk | Severity | Notes |
|------|----------|-------|
| `/world-cup-2026/teams` 24h TTL stale | HIGH | Will show "Group Group A" links until manually revalidated — users clicking these get 404 |
| `/world-cup-2026-schedule` stale ISR (fake fixtures) | HIGH | Pre-DATA-7 issue, needs on-demand revalidation |
| Group pages showing empty standings until revalidation | MEDIUM | Standings will appear empty ≤1h post-deploy |
| `wc-fixtures.ts` COMPACT array still in codebase | LOW | Orphaned — no page calls `getGroupFixtures()`/`getTeamFixtures()`. Can be deleted. |
| `src/data/worldcup/fixtures.json` | LOW | Unreachable. Can be deleted. |

---

## Recommended Next Sprint: DATA-9 — ISR Revalidation + Cleanup

1. **Trigger on-demand ISR revalidation** for all affected pages immediately post-deploy of `777dc3a`
2. **Delete dead code**: `src/lib/wc-fixtures.ts` COMPACT array, `src/data/worldcup/fixtures.json`, `src/data/worldcup/loader.ts` static exports, `src/lib/wc-static-groups.ts` (now fully orphaned)
3. **Add API format smoke test**: assert that `getStandingsCached('WC')` returns at least one table with a recognisable group string — catches future API format changes before they reach production
4. **Consider lowering ISR TTL for `/world-cup-2026/teams`** from 86400s (24h) to 3600s (1h) during the live tournament — 24h is too long when group assignments are live data
