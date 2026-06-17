# DATA-16B Enrichment Health Audit

Date: 2026-06-17
Phase: 2 of 7

---

## Method

`GET /api/debug/enrichment-health` requires CRON_SECRET (unavailable in this environment).
Health was assessed via public HTML of each match page — specifically the FAQ structured data
(`schema.org/QAPage`) which encodes the actual scorer answer text.

Detection logic:
- `"Goals: ... (Team)"` in the answer → enriched (goals present in snapshot)
- `"Detailed scorer information is currently unavailable"` → not enriched, score > 0
- `"The match ended goalless (0–0)"` → genuine 0-0 or unenriched + score 0-0

---

## Pre-Repair Production State

| FD ID | Match | FD Score | FAQ Answer (production) | Goals in KV | Status |
|-------|-------|----------|-------------------------|-------------|--------|
| 537327 | Mexico vs South Africa | 2–0 | "scorer information unavailable" | 0 | ❌ unenriched |
| 537328 | South Korea vs Czechia | 2–1 | "scorer information unavailable" | 0 | ❌ unenriched |
| 537333 | Canada vs Bosnia | 1–1 | "scorer information unavailable" | 0 | ❌ unenriched |
| 537334 | Qatar vs Switzerland | 1–1 | "scorer information unavailable" | 0 | ❌ unenriched |
| 537339 | Brazil vs Morocco | 1–1 | "scorer information unavailable" | 0 | ❌ unenriched |
| 537340 | Haiti vs Scotland | 0–1 | (no FAQ answer detected) | ? | ⚠️ unknown |
| 537345 | USA vs Paraguay | 4–1 | "scorer information unavailable" | 0 | ❌ unenriched |
| 537346 | Australia vs Turkey | 2–0 | "scorer information unavailable" | 0 | ❌ unenriched |
| 537351 | Germany vs Curaçao | 7–1 | "scorer information unavailable" | 0 | ❌ unenriched |
| 537352 | Ivory Coast vs Ecuador | 1–0 | "scorer information unavailable" | 0 | ❌ unenriched |
| 537357 | Netherlands vs Japan | 2–2 | "scorer information unavailable" | 0 | ❌ unenriched |
| 537358 | Sweden vs Tunisia | 5–1 | "scorer information unavailable" | 0 | ❌ unenriched |
| 537363 | Belgium vs Egypt | 1–1 | "scorer information unavailable" | 0 | ❌ unenriched |
| 537364 | Iran vs New Zealand | 2–2 | "scorer information unavailable" | 0 | ❌ unenriched |
| 537369 | Spain vs Cape Verde | 0–0 | "The match ended goalless (0–0)" | 0 | ✅ correct 0-0 |
| 537370 | Saudi Arabia vs Uruguay | 1–1 | "scorer information unavailable" | 0 | ❌ unenriched |
| 537391 | France vs Senegal | 3–1 | "scorer information unavailable" | 0 | ❌ unenriched |
| 537392 | Iraq vs Norway | 1–4 | "Goals: Haaland 29', Haaland 43'" | 2 | ⚠️ partial |

---

## Summary

| Status | Count | Notes |
|--------|-------|-------|
| ✅ Correct (0-0) | 1 | Spain vs Cape Verde |
| ✅ Enriched | 0 | None fully enriched |
| ⚠️ Partial enrichment | 1 | Iraq/Norway: 2/5 goals (pre-DATA-14A type filter) |
| ❌ Unenriched | 16 | Score > 0 but goals.length = 0 |
| ⚠️ Unknown | 1 | 537340 — FAQ answer not detected |

**Pre-repair coverage: 5.5% (1/18 correct; 1 partial).**
All 16 degraded matches display "scorer information unavailable" — correct fallback text, not false "goalless".

---

## Root Cause of Degradation

KV snapshots for 16/18 scored matches were built before the DATA-14A→16 stack was deployed.
They contain `goals: []` because:
1. Pre-DATA-14A code only captured `type.id === '70'` (missed headers, volleys)
2. ESPN event caches expired (12h TTL, now fixed to 30d in DATA-16)
3. Snapshots rebuilt without event cache → returned empty goals → pinned for 7 days

Iraq vs Norway has partial data because it was enriched during a window when the event cache was
warm but before the DATA-14A type filter was fixed.

**Fix path:** invalidate the 16 degraded snapshots + event caches. Next rebuild will use the corrected
enrichment pipeline (DATA-14A goals filter + DATA-15C aliases + DATA-16 30d event cache).
