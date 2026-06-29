# WC_GROUP_VALIDATION — DATA-18WC.5

**Date:** 2026-06-23

---

## Production audit result

Probe: `/api/debug/standings-audit?secret=<CRON_SECRET>` — 2026-06-23

```
effectiveVerdict: "FIX_ACTIVE — 12/12 groups have playedGames>0"
```

All 12 groups override the static seed with live data. No static fallback detected.

---

## Group-by-group live data (API via standings-audit endpoint)

| Group | Leader | P | PTS | Table size | Status |
|-------|--------|---|-----|------------|--------|
| GROUP_A | Mexico | 2 | 6 | 4 | ✅ LIVE |
| GROUP_B | Canada | 2 | 4 | 4 | ✅ LIVE |
| GROUP_C | Brazil | 2 | 4 | 4 | ✅ LIVE |
| GROUP_D | United States | 2 | 6 | 4 | ✅ LIVE |
| GROUP_E | Germany | 2 | 6 | 4 | ✅ LIVE |
| GROUP_F | Netherlands | 2 | 4 | 4 | ✅ LIVE |
| GROUP_G | Egypt | 2 | 4 | 4 | ✅ LIVE |
| GROUP_H | Spain | 2 | 4 | 4 | ✅ LIVE |
| GROUP_I | France | 2 | 6 | 4 | ✅ LIVE |
| GROUP_J | Argentina | 2 | 6 | 4 | ✅ LIVE |
| GROUP_K | Colombia | 1 | 3 | 4 | ✅ LIVE |
| GROUP_L | England | 1 | 3 | 4 | ✅ LIVE |

All 12/12 groups: `tableLength = 4`, `playedGames > 0`, `points > 0`.

---

## Group key format

Post-fix: `getStandingsCached('WC')` always returns `"GROUP_A"` format (canonical).
All page-level extraction code handles this format:

| Route | Extraction logic | Result |
|-------|-----------------|--------|
| `/world-cup-2026-standings` | `.replace(/^GROUP_/, '')` | `"A"` ✅ |
| `/world-cup-2026-groups` | `.replace('GROUP_', '').replace(/^Group\s+/i, '').trim()` | `"A"` ✅ |
| `/world-cup-2026/groups` | `g.toLowerCase().replace(/[\s_]+/g, '-')` | `"group-a"` ✅ |
| `/world-cup-2026/[group]` | `normalizeGroupLetter` (handles both formats) | `"A"` ✅ |
| `/world-cup-2026` hub | `g.toLowerCase().replace(/[\s_]+/g, '-')` | `"group-a"` ✅ |
| `WCGroupTable` component | `raw.replace(/_/g, ' ').replace(/^GROUP /, 'Group ')` | `"Group A"` ✅ |

---

## Qualification position markers

All pages use `i < 2` (position-based) or `rank <= 2` to mark qualifiers with green highlights.
Source: football-data.org's pre-sorted `table[]` array — no re-sort needed.

| Page | Qualifier logic | Correct post-fix |
|------|----------------|-----------------|
| `WCGroupTable` (hub, groups) | `i < 2` → green border | ✅ |
| `/world-cup-2026-standings` | `i < 2` → bg-green | ✅ |
| `/world-cup-2026/[group]` | `rank <= 2` → "Advancing" | ✅ |
| `/world-cup-2026-groups` | `j < 2` → bg-green | ✅ |

---

## Static fallback check

`isStaticFallback()` condition: all table entries have `playedGames === 0`.
Post-fix: no group meets this condition. Static fallback is NOT active.

---

## Verdict

**GROUP_VALIDATION: PASS** — all 12 groups A–L serve live data with real stats.
No static P=0/PTS=0 fallback detected on any group. Qualification markers are position-correct.
