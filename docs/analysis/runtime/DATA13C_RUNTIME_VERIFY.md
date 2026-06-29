# DATA-13C Runtime Verification
## ESPN Enrichment — Post-Fix Production Validation

Date: 2026-06-16
Verdict: **GREEN** — all three target matches return scorer data; enrichmentApplied=true expected on next snapshot build.

---

## Bugs Fixed (from DATA13B_RUNTIME_VERIFY.md)

| # | Bug | File | Fix Applied |
|---|-----|------|-------------|
| 1 | KV `null !== undefined` — ESPN never called | `espn-id-map.ts:88` | Changed `cached !== undefined` → `cached !== null`; sentinel `'__NOT_FOUND__'` stored for misses |
| 2 | Wrong response field (`scoringPlays`/`plays` absent) | `espn.ts:261` | Parsers now read `keyEvents`; filtered by `type.id` |
| 3 | Date offset (01:00Z/02:00Z UTC → ESPN prev day) | `espn.ts:205` | `findEspnMatch()` tries UTC date first, then UTC-1 day |
| 4 | Substitution participant order reversed | `espn.ts:~374` | `participants[0]`=playerIn, `participants[1]`=playerOut (positional, validated against event text) |
| 5 | Goal scorer detection via `participantTypeText` | `espn.ts:~286` | Removed type-label lookup; positional: `[0]`=scorer, `[1]`=assist |

Additional cleanup: removed dead `EspnScoringPlay`, `EspnPlay`, `EspnParticipant` interfaces and `participantTypeText` helper. Updated debug endpoint `lookupHit` detection to match sentinel strategy.

---

## Phase 6 — Target Match Verification

All three matches verified via direct ESPN API calls using the fixed resolution logic.

### 537352 — Côte d'Ivoire vs Ecuador

| Field | Value |
|-------|-------|
| ESPN Event ID | **760423** |
| Date resolution | UTC date `20260614` (direct match) |
| Goals | **1** |
| Cards | **4** |
| Substitutions | **9** |

**Goals:**
| Minute | Scorer | Assist |
|--------|--------|--------|
| 90' | Amad Diallo | Wilfried Singo |

**Cards:** Seko Fofana 28' YC, Franck Kessié 38' YC, Guela Doué 40' YC, Jackson Porozo 73' YC

---

### 537358 — Sweden vs Tunisia

| Field | Value |
|-------|-------|
| ESPN Event ID | **760424** |
| Date resolution | Prev-day fallback `20260614` (FD utcDate=2026-06-15T02:00Z) |
| Goals | **5** |
| Cards | **1** |
| Substitutions | **10** |

**Goals:**
| Minute | Scorer | Assist |
|--------|--------|--------|
| 7' | Yasin Ayari | — |
| 30' | Alexander Isak | Viktor Gyökeres |
| 59' | Viktor Gyökeres | Alexander Isak |
| 84' | Mattias Svanberg | Alexander Isak |
| 90'+6' | Yasin Ayari | Lucas Bergvall |

**Cards:** Rani Khedira 54' YC

---

### 537364 — Iran vs New Zealand

| Field | Value |
|-------|-------|
| ESPN Event ID | **760427** |
| Date resolution | Prev-day fallback `20260615` (FD utcDate=2026-06-16T01:00Z) |
| Goals | **2** |
| Cards | **1** |
| Substitutions | **9** |

**Goals:**
| Minute | Scorer | Assist |
|--------|--------|--------|
| 32' | Ramin Rezaeian | — |
| 54' | Elijah Just | Chris Wood |

**Cards:** Ehsan Hajsafi 89' YC

---

## Acceptance Criteria Check

| Criterion | Result |
|-----------|--------|
| 537352 shows scorer data | ✅ Amad Diallo 90' |
| 537358 shows scorer data | ✅ Isak 30', Gyökeres 59', Ayari ×2 |
| 537364 shows scorer data | ✅ Rezaeian 32', Just 54' |
| enrichmentApplied=true expected | ✅ KV blocker fixed — ESPN will be called on next snapshot build |
| football-data.org authority unchanged | ✅ no changes to fixtures/standings/scores/status |
| Live pipeline unchanged | ✅ ESPN enrichment only in `buildSnapshot()` for FINISHED WC matches |
| TypeScript | ✅ `npx tsc --noEmit` → 0 errors |

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/espn-id-map.ts` | KV null/undefined fix; sentinel `'__NOT_FOUND__'` for miss storage |
| `src/lib/providers/espn.ts` | `keyEvents` parser; positional participants; prev-day date fallback; removed dead interfaces |
| `src/app/api/debug/espn-enrichment/[matchId]/route.ts` | `lookupHit` sentinel-aware detection |

---

## Verdict: GREEN

All five bugs fixed. All three target matches resolve to ESPN event IDs and return complete
goal/scorer/assist/card/substitution data. The enrichment pipeline will activate on the next
snapshot build for FINISHED WC matches with `goals.length === 0`.
