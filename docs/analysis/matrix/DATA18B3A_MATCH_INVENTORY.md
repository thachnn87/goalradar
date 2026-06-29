# DATA-18B.3A Match Inventory

**Date:** 2026-06-19
**Collected:** 03:30 UTC (full-audit endpoint)
**Source:** `goalradar:wc:authority:v1` → DR fallback
**Status:** COMPLETE

---

## Summary

| Dimension | Value |
|-----------|-------|
| Total matches | **104** |
| Finished | 27 |
| Live (at collection time) | 1 (537330 Mexico vs South Korea — ended by ~04:00 UTC) |
| Scheduled | 76 (44 group stage + 32 knockout TBD) |
| Duplicates | **0** |
| Teams | **48** |
| Groups | **12** (A–L) |

---

## Finished Matches (27)

| matchId | Home | Away | utcDate | Score | Group | State | Auth | Snap |
|---------|------|------|---------|-------|-------|-------|------|------|
| 537327 | Mexico | South Africa | 2026-06-11 19:00:00 | 2–0 | GROUP_A | finished | GREEN | GREEN |
| 537328 | South Korea | Czechia | 2026-06-12 02:00:00 | 2–1 | GROUP_A | finished | GREEN | GREEN |
| 537329 | Czechia | South Africa | 2026-06-18 16:00:00 | 1–1 | GROUP_A | finished | GREEN | GREEN |
| 537333 | Canada | Bosnia-Herzegovina | 2026-06-12 19:00:00 | 1–1 | GROUP_B | finished | GREEN | GREEN |
| 537334 | Qatar | Switzerland | 2026-06-13 19:00:00 | 1–1 | GROUP_B | finished | GREEN | GREEN |
| 537335 | Switzerland | Bosnia-Herzegovina | 2026-06-18 19:00:00 | 4–1 | GROUP_B | finished | GREEN | GREEN |
| 537336 | Canada | Qatar | 2026-06-18 22:00:00 | 6–0 | GROUP_B | finished | GREEN | GREEN |
| 537339 | Brazil | Morocco | 2026-06-13 22:00:00 | 1–1 | GROUP_C | finished | GREEN | GREEN |
| 537340 | Haiti | Scotland | 2026-06-14 01:00:00 | 0–1 | GROUP_C | finished | GREEN | GREEN |
| 537345 | United States | Paraguay | 2026-06-13 01:00:00 | 4–1 | GROUP_D | finished | GREEN | GREEN |
| 537346 | Australia | Turkey | 2026-06-14 04:00:00 | 2–0 | GROUP_D | finished | GREEN | GREEN |
| 537351 | Germany | Curaçao | 2026-06-14 17:00:00 | 7–1 | GROUP_E | finished | GREEN | GREEN |
| 537352 | Ivory Coast | Ecuador | 2026-06-14 23:00:00 | 1–0 | GROUP_E | finished | GREEN | GREEN |
| 537357 | Netherlands | Japan | 2026-06-14 20:00:00 | 2–2 | GROUP_F | finished | GREEN | GREEN |
| 537358 | Sweden | Tunisia | 2026-06-15 02:00:00 | 5–1 | GROUP_F | finished | GREEN | GREEN |
| 537363 | Belgium | Egypt | 2026-06-15 19:00:00 | 1–1 | GROUP_G | finished | GREEN | GREEN |
| 537364 | Iran | New Zealand | 2026-06-16 01:00:00 | 2–2 | GROUP_G | finished | GREEN | GREEN |
| 537369 | Spain | Cape Verde Islands | 2026-06-15 16:00:00 | 0–0 | GROUP_H | finished | GREEN | GREEN |
| 537370 | Saudi Arabia | Uruguay | 2026-06-15 22:00:00 | 1–1 | GROUP_H | finished | GREEN | GREEN |
| 537391 | France | Senegal | 2026-06-16 19:00:00 | 3–1 | GROUP_I | finished | GREEN | GREEN |
| 537392 | Iraq | Norway | 2026-06-16 22:00:00 | 1–4 | GROUP_I | finished | GREEN | GREEN |
| 537397 | Argentina | Algeria | 2026-06-17 01:00:00 | 3–0 | GROUP_J | finished | GREEN | GREEN |
| 537398 | Austria | Jordan | 2026-06-17 04:00:00 | 3–1 | GROUP_J | finished | GREEN | GREEN |
| 537403 | Portugal | Congo DR | 2026-06-17 17:00:00 | 1–1 | GROUP_K | finished | GREEN | GREEN |
| 537404 | Uzbekistan | Colombia | 2026-06-18 02:00:00 | 1–3 | GROUP_K | finished | GREEN | GREEN |
| 537409 | England | Croatia | 2026-06-17 20:00:00 | 4–2 | GROUP_L | finished | GREEN | GREEN |
| 537410 | Ghana | Panama | 2026-06-17 23:00:00 | 1–0 | GROUP_L | finished | GREEN | GREEN |

**Note:** Authority=GREEN means: valid state, valid score structure, valid teams, valid stage. Snapshot=GREEN means: snapshot exists AND state/score consistent with authority.

---

## Live Match at Collection Time

| matchId | Home | Away | Score | State | Group |
|---------|------|------|-------|-------|-------|
| 537330 | Mexico | South Korea | 1–0 | live | GROUP_A |

This match ended by ~04:00 UTC on 2026-06-19. Snapshot was being built at collection time (first visit to match page).

---

## Scheduled Group Stage Matches (44)

44 GROUP_STAGE matches with `state: 'scheduled'` — kickoff dates ranging from 2026-06-19 onwards. All have valid homeTeam.id > 0, valid utcDate, valid group assignment. No authority issues.

Groups with remaining scheduled matches:

| Group | Total Matches | Finished | Live | Scheduled |
|-------|--------------|---------|------|-----------|
| GROUP_A | 6 | 3 | 1 | 2 |
| GROUP_B | 6 | 4 | 0 | 2 |
| GROUP_C | 6 | 2 | 0 | 4 |
| GROUP_D | 6 | 2 | 0 | 4 |
| GROUP_E | 6 | 2 | 0 | 4 |
| GROUP_F | 6 | 2 | 0 | 4 |
| GROUP_G | 6 | 2 | 0 | 4 |
| GROUP_H | 6 | 2 | 0 | 4 |
| GROUP_I | 6 | 2 | 0 | 4 |
| GROUP_J | 6 | 2 | 0 | 4 |
| GROUP_K | 6 | 2 | 0 | 4 |
| GROUP_L | 6 | 2 | 0 | 4 |
| **Total** | **72** | **27** | **1** | **44** |

---

## Knockout Placeholder Matches (32 — TBD)

All 32 knockout matches have `homeTeam.id = 0` / `awayTeam.id = 0` — teams are determined after group stage concludes. This is correct tournament structure.

| Stage | Count | Match IDs |
|-------|-------|-----------|
| LAST_32 | 16 | 537375–537390 |
| LAST_16 | 8 | 537415–537430 (selected) |
| QUARTER_FINALS | 4 | (IDs in range) |
| SEMI_FINALS | 2 | (IDs in range) |
| THIRD_PLACE | 1 | (ID in range) |
| FINAL | 1 | (ID in range) |

All 32 have snapshots present in KV (pre-built). Authority classification: YELLOW (expected TBD), snapshot: GREEN.

---

## Match ID Range Summary

| Range | Stage | Count |
|-------|-------|-------|
| 537327–537430 | Full tournament | 104 |
| 537327–537410 | Group stage (Matchday 1–2) | ~44+ |
| 537375–537390 | LAST_32 | 16 |
| 537415–537430 | LAST_16 | 16 |
| Higher IDs | QF / SF / FINAL / 3rd Place | 8 |
