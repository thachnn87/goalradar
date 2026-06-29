# DATA-18C.0 Phase 2 — ESPN Enrichment Coverage
## All FINISHED Matches: Goals / Cards / Subs / Lineups

Audit timestamp: 2026-06-17T09:30:14Z  
Data source: live KV snapshot reads via `/api/debug/data18c0-audit`

---

## 1. Totals

| Category | Count | % of FINISHED |
|----------|-------|---------------|
| Total FINISHED matches (actual status) | 20 | — |
| **Fully enriched** (goals > 0) | **1** | **5 %** |
| Partially enriched (cards or subs, 0 goals) | 0 | 0 % |
| Unenriched (0 goals, score > 0) | 18 | 90 % |
| Not applicable (score 0–0) | 1 | 5 % |
| ESPN IDs present | **0** | **0 %** |
| AF IDs present | unknown (not checked) | — |

---

## 2. Per-Match Enrichment Table

| matchId | Home | Away | Date | Score | Goals | Cards | Subs | Lineup? | Enriched? |
|---------|------|------|------|-------|-------|-------|------|---------|-----------|
| 537327 | Mexico | South Africa | Jun 11 | 2–0 | 0 | 0 | 0 | NO | ✗ |
| 537328 | South Korea | Czechia | Jun 12 | 2–1 | 0 | 0 | 0 | NO | ✗ |
| 537333 | Canada | Bosnia-Herz. | Jun 12 | 1–1 | 0 | 0 | 0 | NO | ✗ |
| 537345 | United States | Paraguay | Jun 13 | 4–1 | 0 | 0 | 0 | NO | ✗ |
| 537334 | Qatar | Switzerland | Jun 13 | 1–1 | 0 | 0 | 0 | NO | ✗ |
| 537339 | Brazil | Morocco | Jun 13 | 1–1 | 0 | 0 | 0 | NO | ✗ |
| 537340 | Haiti | Scotland | Jun 14 | 0–1 | 0 | 0 | 0 | NO | ✗ |
| 537346 | Australia | Turkey | Jun 14 | 2–0 | 0 | 0 | 0 | NO | ✗ |
| 537351 ★ | Germany | Curaçao | Jun 14 | 7–1 | 0 | 0 | 0 | NO | ✗ |
| 537357 | Netherlands | Japan | Jun 14 | 2–2 | 0 | 0 | 0 | NO | ✗ |
| 537352 | Ivory Coast | Ecuador | Jun 14 | 1–0 | 0 | 0 | 0 | NO | ✗ |
| 537358 | Sweden | Tunisia | Jun 15 | 5–1 | 0 | 0 | 0 | NO | ✗ |
| 537363 | Belgium | Egypt | Jun 15 | 1–1 | 0 | 0 | 0 | NO | ✗ |
| 537369 | Spain | Cape Verde | Jun 15 | 0–0 | 0 | 0 | 0 | NO | n/a (0-0) |
| 537370 | Saudi Arabia | Uruguay | Jun 15 | 1–1 | 0 | 0 | 0 | NO | ✗ |
| 537364 | Iran | New Zealand | Jun 16 | 2–2 | 0 | 0 | 0 | NO | ✗ |
| 537391 ★ | France | Senegal | Jun 16 | 3–1 | 0 | 0 | 0 | NO | ✗ |
| 537392 ★ | Iraq | Norway | Jun 16 | 1–4 | 0 | 0 | 0 | NO | ✗ |
| 537397 ★ | Argentina | Algeria | Jun 17 | 3–0 | 0 | 0 | 0 | NO | ✗ |
| **537398** | **Austria** | **Jordan** | **Jun 17** | **3–1** | **4** | **1** | **10** | **YES** | **✓** |

★ = DATA-18A/18B benchmark match for shadow diff gate

---

## 3. Benchmark Match Status (Gate-Critical)

The shadow diff endpoint at `/api/debug/authority-compare` requires all 4 benchmark
matches to show `enrichmentApplied=true` and `goalsLengthMatch=true` for GREEN gate.

| Benchmark | matchId | Score | Goals in snapshot | Gate result |
|-----------|---------|-------|------------------|-------------|
| Germany vs Curaçao | 537351 | 7–1 | 0 | **RED** |
| France vs Senegal | 537391 | 3–1 | 0 | **RED** |
| Iraq vs Norway | 537392 | 1–4 | 0 | **RED** |
| Argentina vs Algeria | 537397 | 3–0 | 0 | **RED** |

**All 4 benchmark matches would return RED today. DATA-18C shadow validation is blocked.**

---

## 4. Enrichment Source Analysis

**Why Austria vs Jordan (537398) is enriched while all others are not:**

Austria vs Jordan snapshot age: 1.0 h (built ~08:30 UTC Jun 17).
All other match snapshots age: 5.2 h (built ~04:18 UTC Jun 17 by prewarm).

Austria vs Jordan was finished AFTER the 04:18 UTC prewarm. When its snapshot was
built fresh, `assembleSnapshot()` called `getMatchDetail(537398)` which hit the live FD
API endpoint `/matches/537398`. The FD API match detail endpoint returns:
- `goals[]` — full scorer array
- `bookings[]` — yellow/red cards
- `substitutions[]` — all subs
- `lineups` — starting XI + bench

This data populated the snapshot without needing ESPN or AF enrichment providers.

For the 18 other matches: their snapshots were rebuilt by the prewarm at 04:18 UTC from
KV-cached match detail entries. Those KV entries were populated from bulk feed requests
(`/competitions/WC/matches?status=FINISHED`) which do NOT include goals/cards/subs/lineups.
The bulk feed only includes score and status. So `needsEnrichment=true` triggered for all,
but both ESPN (no IDs) and AF enrichment either failed or returned empty results.

**Root: prewarm reads KV-cached detail (no goals) instead of calling `/matches/{id}` live.**

---

## 5. ESPN ID Coverage

`espnIdCount: 0` — zero ESPN lookup keys exist in KV.

Key: `goalradar:espn:lookup:{fdMatchId}` — 30-day TTL.

The last ESPN ID mapping was written more than 30 days ago, or the keys were never
populated for this tournament's match IDs. Since the WC started June 11 (6 days ago),
and the 30-day TTL should still be valid, the most likely explanation is:

- ESPN ID lookups were never successfully resolved for the current WC 2026 match IDs
- OR: ESPN ID lookup writes failed silently during the enrichment attempts

Without ESPN IDs, `enrichMatchWithEspnEvents()` skips entirely — the function calls
`getOrLookupEspnId(fdId)` which returns null when no lookup key exists. No ESPN event
fetch is attempted. This is the complete failure of the ESPN enrichment path.

**AF enrichment:** `ENABLE_AF_ENRICHMENT=true` is set. Austria vs Jordan's 10 substitutions
confirm a provider IS populating subs data. However, the 18 older matches got 0 subs too,
suggesting AF enrichment was also unsuccessful for those matches at 04:18 UTC.

---

## 6. Enrichment Impact on Authority Cache

The `buildCanonicalMatch()` function in `canonical-match.ts` sets:
```typescript
enrichmentAttempted: (snapshot?.match?.goals?.length ?? 0) === 0 — cannot determine from snapshot alone
enrichmentApplied:   (snapshot?.match?.goals?.length ?? 0) > 0
```

With current KV state:
- 18 matches → `enrichmentApplied: false`
- 1 match → `enrichmentApplied: true` (Austria vs Jordan only)
- 1 match → `enrichmentApplied: false` (Spain 0-0, no enrichment needed or possible)

The Authority Cache built today would have `enrichmentApplied: false` for 95% of FINISHED
matches. This makes the shadow diff endpoint's `enrichmentApplied` check fail for all 4
benchmark matches.
