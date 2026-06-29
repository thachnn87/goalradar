# WC_UX_PAGE_MAP.md — DATA-18WC.8D Phase 1

**Date:** 2026-06-24
**Method:** Source read + production fetch of all pages
**Scan time:** 2026-06-24T02:17–03:45Z

---

## 1. PAGE INVENTORY

### `/world-cup-2026` — WC Hub
| Attribute | Value |
|-----------|-------|
| Source file | `src/app/world-cup-2026/page.tsx` |
| ISR revalidate | 30s |
| Primary data | `getWCAuthorityMatchesV2()` → Authority Cache → DR (2h old) |
| Standings data | `getStandingsCached('WC')` → KV → DR |
| Knockout data | `getWCKnockoutMatchesCached()` → Bracket KV |
| Live data | `getCurrentLiveMatches()` → Live Cache |
| Fallback | DR keys for each data source |
| Production status | **DEGRADED** — standings section shows stale pre-draw data (0 pts, wrong teams) |

### `/world-cup-2026/standings` → **308 REDIRECT** to `/world-cup-2026/groups`
| Attribute | Value |
|-----------|-------|
| Behaviour | Permanent redirect |
| Destination | `/world-cup-2026/groups` |

### `/world-cup-2026/groups` — Group Standings
| Attribute | Value |
|-----------|-------|
| Source file | `src/app/world-cup-2026/groups/page.tsx` |
| ISR revalidate | 3600s (1h) |
| Primary data | `getStandingsCached('WC')` filtered `type === 'TOTAL'` |
| Fallback | Empty tables with `apiError` flag |
| Production status | **CORRECT** — all 12 groups with real standings |

### `/world-cup-2026/group/[group]` → **404** (wrong URL pattern)
| Attribute | Value |
|-----------|-------|
| Correct route | `/world-cup-2026/[group]` (e.g. `/world-cup-2026/group-i`) |
| Pattern confirmed | e.g. `https://www.goalradar.org/world-cup-2026/group-i` works |
| `/world-cup-2026/group/a` | **404 Not Found** |
| `/world-cup-2026/group/group-a` | **404 Not Found** |

### `/world-cup-2026/[group]` — Individual Group Page (e.g. `/world-cup-2026/group-i`)
| Attribute | Value |
|-----------|-------|
| Source file | `src/app/world-cup-2026/[group]/page.tsx` |
| Primary data | `getStandingsCached('WC')` — group-specific table |
| Match data | Authority matches filtered by group |
| Production status | **MOSTLY CORRECT** — standings and results accurate; upcoming fixtures missing for active groups |

### `/world-cup-2026/fixtures` — Fixtures Page
| Attribute | Value |
|-----------|-------|
| Source file | `src/app/world-cup-2026/fixtures/page.tsx` |
| ISR revalidate | Unknown (pending source read) |
| Primary data | Authority matches — all statuses |
| Production status | **PARTIAL** — shows 47 finished/cancelled group matches; no upcoming group matches; no knockout fixtures |

### `/world-cup-2026/results` — Results Page
| Attribute | Value |
|-----------|-------|
| Source file | `src/app/world-cup-2026/results/page.tsx` |
| Primary data | Authority matches filtered by FINISHED |
| Production status | **MOSTLY CORRECT** — 46 played, 139 goals (differs from `/world-cup-2026-results` which shows 137) |

### `/world-cup-2026-results` — Alternate Results Page
| Attribute | Value |
|-----------|-------|
| Source file | `src/app/world-cup-2026-results/page.tsx` (separate file) |
| Primary data | Authority matches or separate source |
| Production status | **INCONSISTENT** — shows 137 goals vs 139 on `/world-cup-2026/results` |

### `/world-cup-2026/bracket` — Knockout Bracket
| Attribute | Value |
|-----------|-------|
| Source file | `src/app/world-cup-2026/bracket/page.tsx` |
| Primary data | `getWCKnockoutMatchesCached()` |
| Production status | **CORRECT** — all 6 rounds present (R32, R16, QF, SF, 3rd, Final) with TBD teams and correct dates |

### `/world-cup-2026/teams/[slug]` — Team Pages (48 teams)
| Attribute | Value |
|-----------|-------|
| Source file | `src/app/world-cup-2026/teams/[slug]/page.tsx` |
| ISR revalidate | 3600s (1h) |
| Primary data | `getUpcomingMatchesCached('WC')` + `getRecentMatchesCached('WC')` filtered by team name |
| Standings data | `getStandingsCached('WC')` |
| Fallback | `WC_GROUP_FIXTURES` static local fixtures |
| Production status | **BROKEN** — shows pre-tournament placeholder "Fixtures load once the tournament begins — Check back from 11 June 2026" for active teams (e.g. France, USA). Qualification and standings render correctly. |
| Confirmed affected | France (2 matches played), USA |

### `/match/[id]` — Match Pages
| Attribute | Value |
|-----------|-------|
| Source file | `src/app/match/[id]/page.tsx` |
| ISR revalidate | 60s |
| Primary data | `getOrBuildMatchSnapshot(numericId)` → Snapshot KV → Detail KV → DR → fresh API |
| Production status | **PARTIALLY BROKEN** — page metadata renders correctly; body content is in RSC payload; cancelled match 537412 shows score "0-1" in title metadata; snapshot key expired |
| Note | Route is `/match/[id]` not `/matches/[id]` (spec assumed wrong URL) |

### `/matches/[id]` (with 's') → **404**

---

## 2. DATA SOURCE SUMMARY

| Page | Auth Cache | Standings KV | Live Cache | Bracket KV | Snapshot KV |
|------|-----------|-------------|-----------|-----------|------------|
| WC Hub | ✅ | ✅ (but stale ISR bake) | ✅ | ✅ | ❌ |
| Groups | ❌ | ✅ | ❌ | ❌ | ❌ |
| Group/[slug] | ✅ | ✅ | ❌ | ❌ | ❌ |
| Fixtures | ✅ | ❌ | ❌ | ❌ | ❌ |
| Results | ✅ | ❌ | ❌ | ❌ | ❌ |
| Bracket | ❌ | ❌ | ❌ | ✅ | ❌ |
| Teams/[slug] | ❌ | ✅ | ❌ | ❌ | ❌ |
| Match/[id] | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 3. MISSING / NON-EXISTENT PAGES

| URL from spec | Actual status |
|--------------|---------------|
| `/world-cup-2026/standings` | 308 → `/world-cup-2026/groups` |
| `/world-cup-2026/group/[group]` | **404** |
| `/matches/[id]` (with 's') | **404** |
| `/world-cup-2026-results` | Exists — separate file from `/world-cup-2026/results` |
