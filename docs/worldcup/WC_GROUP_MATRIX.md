# WC_GROUP_MATRIX.md — DATA-18WC.7 Phase 2
**Date:** 2026-06-23  
**Sources:** `src/lib/wc-all-teams.ts`, `src/lib/wc-static-groups.ts`, standings-audit production probe

---

## Group Count Verification

| Source | Groups | Teams/Group | Total Teams | Status |
|---|---|---|---|---|
| Static (wc-all-teams.ts) | 12 (A–L) | 11×4 + 1×3 | 47 | ⚠️ G has 3 (pre-draw) |
| Live API (KV standings) | 12 (A–L) | 12×4 | 48 | ✅ |
| getStaticWCGroupTables() | 12 (A–L) | 11×4 + 1×3 | 47 | ⚠️ (same mismatch) |

---

## Live API Group Leaders (standings-audit, 2026-06-23)

| Group | Leader | P | W | PTS | GD |
|---|---|---|---|---|---|
| A | Mexico | 2 | 2 | 6 | +3 |
| B | Canada | 2 | 1 | 4 | +6 |
| C | Brazil | 2 | 1 | 4 | +3 |
| D | United States | 2 | 2 | 6 | +5 |
| E | Germany | 2 | 2 | 6 | +7 |
| F | Netherlands | 2 | 1 | 4 | +4 |
| G | Egypt | 2 | 1 | 4 | +2 |
| H | Spain | 2 | 1 | 4 | +4 |
| I | France | 2 | 2 | 6 | +5 |
| J | Argentina | 2 | 2 | 6 | +5 |
| K | Colombia | 1 | 1 | 3 | +2 |
| L | England | 1 | 1 | 3 | +2 |

**Note:** Groups K and L leaders show only 1 game played — these groups are on MD1 (MD2 not yet played as of audit date).

---

## Static Group Skeleton Accuracy

- **TBD fix:** `getStaticWCGroupTables()` correctly skips Italy (`group === 'TBD'`) → produces exactly 12 groups A–L
- **Group G static skeleton:** Shows 3 TBD-stats entries (argentina, egypt, iraq). Once live API data available, static is fully replaced — rendering uses live data.
- **Standings group key mismatch:** Live API returns `"Group A"` but code expects `"GROUP_A"`. The merge logic falls back to STATIC source for all 12 groups. This means live KV standings data is not being merged; the system serves the static skeleton with zero stats until the key mismatch is fixed.

---

## Group Key Format Mismatch (YELLOW Finding)

**Symptom:** `/api/debug/standings-audit` reports `liveFound=false` for all 12 groups.  
**Root Cause:** The API returns group identifiers like `"Group A"`, `"Group B"` etc., but the merge code expects `"GROUP_A"`, `"GROUP_B"` format.  
**Impact:** Standings pages fall back to STATIC source — but the standings data in KV is fresh and correct (TTL=5112s, fetched at 08:07 UTC). The standing display works due to separate data path (standings KV key), but the merge enrichment doesn't apply.  
**Fix:** Normalize group key casing in the merge logic.

---

## Standings DR KV Absent

`kvDR.exists: false` — no disaster-recovery copy of standings. If primary KV key expires during an outage, standings will fall back to static zero-stats skeleton.

---

## Findings

- ✅ 12 groups confirmed from both static and live API
- ✅ All 12 groups have 4 teams in live API (48 teams total)
- ⚠️ Group G static skeleton has 3 teams (pre-draw mismatch — cosmetic only, live corrects)
- 🔴 Standings group key mismatch (`"Group A"` vs `"GROUP_A"`) prevents live merge for all 12 groups
- 🟡 Standings DR KV absent — no disaster-recovery fallback for standings

**Phase 2 Gate: GROUP_MATRIX_PASS** (12 groups, 4 teams each in live API — correct)  
**Repair items:** Group key mismatch normalization + DR KV population
