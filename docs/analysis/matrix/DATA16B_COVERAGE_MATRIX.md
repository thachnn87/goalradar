# DATA-16B Coverage Matrix

Date: 2026-06-17
Phase: 6 of 7

Source: ESPN ground truth (DATA-15C.1) vs production state (page HTML audit)

---

## Pre-Repair Coverage

| FD ID | Match | Score | Goals (expected) | Goals (prod) | Cards (prod) | Subs (prod) | Lineups (prod) | Status |
|-------|-------|-------|-----------------|--------------|--------------|-------------|----------------|--------|
| 537327 | Mexico vs South Africa | 2–0 | 2 | 0 | 0 | 0 | ❌ | unenriched |
| 537328 | South Korea vs Czechia | 2–1 | 3 | 0 | 0 | 0 | ❌ | unenriched |
| 537333 | Canada vs Bosnia | 1–1 | 2 | 0 | 0 | 0 | ❌ | unenriched |
| 537334 | Qatar vs Switzerland | 1–1 | 2 | 0 | 0 | 0 | ❌ | unenriched |
| 537339 | Brazil vs Morocco | 1–1 | 2 | 0 | 0 | 0 | ❌ | unenriched |
| 537340 | Haiti vs Scotland | 0–1 | 1 | ? | ? | ? | ❌ | unknown |
| 537345 | USA vs Paraguay | 4–1 | 5 | 0 | 0 | 0 | ❌ | unenriched |
| 537346 | Australia vs Turkey | 2–0 | 2 | 0 | 0 | 0 | ❌ | unenriched |
| 537351 | Germany vs Curaçao | 7–1 | 8 | 0 | 0 | 0 | ❌ | unenriched |
| 537352 | Ivory Coast vs Ecuador | 1–0 | 1 | 0 | 0 | 0 | ❌ | unenriched |
| 537357 | Netherlands vs Japan | 2–2 | 4 | 0 | 0 | 0 | ❌ | unenriched |
| 537358 | Sweden vs Tunisia | 5–1 | 6 | 0 | 0 | 0 | ❌ | unenriched |
| 537363 | Belgium vs Egypt | 1–1 | 2 | 0 | 0 | 0 | ❌ | unenriched |
| 537364 | Iran vs New Zealand | 2–2 | 4 | 0 | 0 | 0 | ❌ | unenriched |
| 537369 | Spain vs Cape Verde | 0–0 | 0 | 0 | 0 | 0 | ❌ | ✅ correct |
| 537370 | Saudi Arabia vs Uruguay | 1–1 | 2 | 0 | 0 | 0 | ❌ | unenriched |
| 537391 | France vs Senegal | 3–1 | 4 | 0 | 0 | 0 | ❌ | unenriched |
| 537392 | Iraq vs Norway | 1–4 | 5 | 2* | ? | ? | ❌ | partial |

*537392: 2/5 goals present (pre-DATA-14A type filter)

---

## Pre-Repair Coverage Percentages

| Metric | Matches with data | Coverage |
|--------|-----------------|----------|
| Goals = correct count | 1/18 | **5.6%** |
| Cards present | 0/18 | **0%** |
| Subs present | 0/18 | **0%** |
| Stats (non-zero) | 0/18 | **0%** |
| Lineups present | 0/18 | **0%** |

**Overall: FAR BELOW 95% targets. All fields need repair.**

---

## Expected Post-Repair Coverage

Based on ESPN ground truth from DATA-15C.1 (18/18 matches verified):

| Metric | Expected after repair | Target |
|--------|----------------------|--------|
| Goals (correct count) | 17/18 (Spain 0-0 excluded) | ≥95% | → **94.4%** ≈ 95% |
| Cards present | 17/18 (Spain has 2 cards; 1/18 is genuine 0-0) | ≥95% | → **94.4%** ≈ 95% |
| Subs present | 18/18 (all matches have subs) | ≥95% | → **100%** ✅ |
| Stats (non-zero) | 17/18 | ≥95% | → **94.4%** ≈ 95% |
| Lineups present | 18/18 | ≥95% | → **100%** ✅ |

Note: Spain 0-0 Cape Verde has 2 cards and 9 subs (from ESPN). Cards/stats will show even for 0-0.
Revised expected:

| Metric | Revised expected | Target |
|--------|-----------------|--------|
| Goals (correct count) | 17/18 = 94.4% | ≥95% ⚠️ borderline |
| Cards present | 18/18 = 100% ✅ | ≥95% ✅ |
| Subs present | 18/18 = 100% ✅ | ≥95% ✅ |
| Stats (non-zero) | 18/18 = 100% ✅ | ≥95% ✅ |
| Lineups present | 18/18 = 100% ✅ | ≥95% ✅ |

Goals at 94.4% is borderline (17 of 18 matches have score > 0; ESPN has all 53 goals).
All 17 scored matches WILL have the correct goal count after repair.
Spain 0-0 correctly has 0 goals. So goals coverage = 18/18 correct = 100%.

**Final expected after repair: all metrics ≥95% ✅**

---

## Coverage Gap: 537340 Haiti vs Scotland

The FAQ answer for 537340 was not detected via HTML grep. This may be due to:
- The match page using a different URL slug
- No snapshot in KV (no-snapshot state)
- Build structure difference

This match should be included in the repair batch regardless (it's in WC_FINISHED_IDS).

---

## Observation on Partial Enrichment (537392)

Iraq vs Norway shows Haaland 29' and 43' — 2 of 5 goals. This is a known data quality
artifact from the pre-DATA-14A `type.id === '70'` filter. The repair will:
1. Clear the snapshot and event cache
2. Next load fetches ESPN fresh with `scoringPlay === true` filter
3. All 5 goals captured correctly
