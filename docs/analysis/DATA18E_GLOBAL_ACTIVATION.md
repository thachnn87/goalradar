# DATA-18E — Authority Cache Global Activation

Date: 2026-06-17  
Commit: `0c963a8` — feat(data18e): Phase 4 — migrate all WC listing pages to getWCAuthorityMatchesV2()

---

## Phase 1 — Source Census

Deliverable: `DATA18E_SOURCE_CENSUS.md`

| Finding | Detail |
|---------|--------|
| WC listing pages | 6 pages inventoried |
| Legacy feed calls eliminated | 8 (3 from matches-today, 2 from matches-tomorrow, 2 from hub, 1 CANARY flag removed from results) |
| Single source after migration | `goalradar:wc:authority:v1` via `getWCAuthorityMatchesV2()` |

---

## Phase 2 — Adoption Matrix

Deliverable: `DATA18E_ADOPTION_MATRIX.md`

All 6 WC listing pages: **AUTHORITY** class post-migration.  
Zero pages remaining on LEGACY class.

---

## Phase 3 — Legacy Audit

Deliverable: `DATA18E_LEGACY_AUDIT.md`

| Legacy function | WC listing page callers after Phase 4 |
|----------------|--------------------------------------|
| `getWCAuthorityMatches()` | 0 |
| `getWCAuthorityMatchesCached()` | 0 |
| `getUpcomingMatchesCached()` | 0 |
| `getWCResultsCached()` | 0 |
| `getWCLiveMatchesCached()` | 0 |
| `overlayMatchStates()` | 0 |

---

## Phase 4 — Code Migration

Commit: `0c963a8`  
TypeScript: **0 errors**

Files modified:

| File | Change |
|------|--------|
| `src/lib/match-classify.ts` | Added `state` field support (CanonicalMatch) alongside `status` (Match) |
| `src/components/MatchCard.tsx` | Accept `Match \| CanonicalMatch`; `effectiveStatus()` + `effectiveCompName()` helpers |
| `src/components/WCCountdown.tsx` | `liveMatches` prop updated from `Match[]` to `CanonicalMatch[]` |
| `src/app/world-cup-2026/results/page.tsx` | Removed CANARY flag; always `getWCAuthorityMatchesV2()` |
| `src/app/world-cup-2026/fixtures/page.tsx` | `getWCAuthorityMatches()` → `getWCAuthorityMatchesV2()` |
| `src/app/world-cup-2026/[group]/page.tsx` | `getWCAuthorityMatches()` → `getWCAuthorityMatchesV2()` |
| `src/app/world-cup-2026/matches-today/page.tsx` | 3-call fetch → single `getWCAuthorityMatchesV2()`; all `m.status` → `m.state` |
| `src/app/world-cup-2026/matches-tomorrow/page.tsx` | `getUpcomingMatchesCached()` → `getWCAuthorityMatchesV2()` |
| `src/app/world-cup-2026/page.tsx` | `getWCLiveMatchesCached()` + `getWCAuthorityMatchesCached()` → `getWCAuthorityMatchesV2()` |

---

## Phase 5 — Production Gates

**Status: PENDING** (requires deployment of `0c963a8` + `AUTHORITY_CACHE_ENABLED=true`)

Required gate checks:

```bash
# Gate 1: authority-compare scope=all
curl "https://www.goalradar.org/api/debug/authority-compare?scope=all" \
  -H "x-internal-token: <INTERNAL_TOKEN>"
# Required: gate=GREEN, redCount=0

# Gate 2: integrity-audit
curl "https://www.goalradar.org/api/debug/data18d1-integrity-audit"
# Required: overallVerdict=PASS, fail=0
```

---

## Phase 6 — Global Activation

**Status: PENDING**

Activation instruction:

```
Vercel Dashboard → goalradar project → Settings → Environment Variables
Set: AUTHORITY_CACHE_ENABLED = true
Trigger redeploy
```

**Effect:** `writeAuthorityCache(builtAt)` is called by the authority-write cron. `readAuthorityCache()` serves `goalradar:wc:authority:v1` on every listing page request. The legacy merge path (`getWCAuthorityMatchesCached`) is no longer called by any listing page.

---

## Final Answer

**Is GoalRadar now operating with a true World Cup Single Source of Truth?**

### PENDING — Phase 5 gates and Phase 6 activation not yet run

**Pre-conditions met:**
- ✅ All 6 WC listing pages read from `getWCAuthorityMatchesV2()` (commit `0c963a8`)
- ✅ No duplicate feed merges on any listing page
- ✅ No secondary overlay on any listing page
- ✅ No date-scoped result keys on any listing page
- ✅ TypeScript clean (0 errors)
- ✅ `classifyMatchState()` handles both `CanonicalMatch.state` and `Match.status`
- ✅ `MatchCard` accepts both types

**Remaining:**
- ☐ Deploy `0c963a8` to production (Vercel)
- ☐ `authority-compare?scope=all` → gate=GREEN
- ☐ `integrity-audit` → PASS
- ☐ Set `AUTHORITY_CACHE_ENABLED=true` in Vercel
- ☐ Validate Hub / Results / Fixtures / Groups / Match pages — scores identical

Once Phase 5 gates pass and `AUTHORITY_CACHE_ENABLED=true` is set: **YES — GoalRadar operates with a true World Cup Single Source of Truth.**
