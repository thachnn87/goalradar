# DATA-18J.2 Phase 3 — Snapshot Fingerprint Comparison

Date: 2026-06-17  **AUDIT ONLY.**

Two code paths produce a `MatchSnapshot`. Their construction differs in ways that leave a durable
signature in KV.

| Field | A. buildSnapshot → `assembleSnapshot` (match-snapshot.ts:454) | B. seedMatch → `buildPartialSnapshot` (worldcup.ts:212) |
|-------|---------------------------------------------------------------|----------------------------------------------------------|
| `headToHead` | `getHeadToHeadCached(matchId)` → **object (non-null when H2H cached)** | **`null` — hardcoded (worldcup.ts:223)** |
| `standings` | `getStandingsCached('WC')` (StandingsResult or null) | `isWC && hasGroup ? standings : null` (passed in) |
| `wcGroupMatches` | from `getUpcomingMatchesCached`+`getRecentMatchesCached`, dedup | filtered from `allMatches` arg |
| `wcAllMatches` | upcoming ∪ recent (dedup) | `allMatches` filtered to WC (dedup) |
| `match.goals/bookings/subs` | **AF + ESPN enriched** (→ goals>0 for scored) | **AF only** (→ goals=0 when AF down) |
| `match.lineups` | ESPN may populate (DATA-16) | **never populated** (no ESPN) |
| **detail key co-write** | none (reads detail) | **writes `goalradar:/matches/{id}` in same op (337)** |
| write mechanism | `writeKVSnapshot` (guard 275-289) | **raw `kv.set` (380), no guard** |
| `generatedAt` | per page visit (scattered) | per cron batch (clustered across matches) |

---

## Strongest signatures

1. **`headToHead === null`** — definitive for path B. `buildPartialSnapshot` hardcodes it
   (`headToHead: null`, worldcup.ts:223); `assembleSnapshot` sets it from cache.
   *Not remotely readable:* the H2H section is Suspense-streamed (page.tsx:2311) and the only debug
   endpoints expose score/goals, not `headToHead`. Confirmable only with a raw-snapshot dump
   (no such endpoint exists; building one is out of scope — no deploy).

2. **`lineups` absent + `goals=0` while ESPN cache has events** — path B (AF-only) signature.
   Production: `snapGoals=0` for all 5, ESPN cache holds goals 3..8. ✅ readable, matches B.

3. **`detailAge == snapshotAge`** — path B writes both keys together (337+380); path A writes only
   the snapshot. Production: both = 37.9 min for all 5. ✅ readable, matches B.

4. **Clustered `generatedAt`** — path B is a batch loop; path A is per-request.
   Production: all 5 identical at 37.9 min. ✅ readable, matches B.

---

## Verdict

Three of four signatures are **directly observed in production** and all point to **path B
(`seedMatch`/`buildPartialSnapshot`)**. The fourth (`headToHead===null`) is consistent and is the
construction-level proof, but is not remotely readable without adding an endpoint (excluded by the
no-deploy constraint). The observed trio is already sufficient to fingerprint the writer as B.
