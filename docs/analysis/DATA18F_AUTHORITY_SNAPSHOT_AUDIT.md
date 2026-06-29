# DATA-18F Phase 1 — Authority Cache vs Match Snapshot Full Audit

Date: 2026-06-17  
Commit: `0c963a8` (DATA-18E Phase 4)

---

## Audit Scope

For every FINISHED WC 2026 match, compare:

| Field | Authority Source | Snapshot Source | KV Key |
|-------|-----------------|-----------------|--------|
| Score | `CanonicalMatch.score.fullTime` | `MatchSnapshot.match.score.fullTime` | `goalradar:wc:authority:v1` vs `goalradar:match:{id}` |
| State | `CanonicalMatch.state` | derived from `MatchSnapshot.match.status` | same |
| enrichmentApplied | `CanonicalMatch.enrichmentApplied` | `MatchSnapshot.match.enrichmentApplied` (if present) | same |
| Goals count | `CanonicalMatch.goals.length` | `MatchSnapshot.match.goals.length` | same |
| Lineup presence | N/A — authority cache excludes lineups by design | `MatchSnapshot.match.lineups.home/away.players.length > 0` | snapshot only |

---

## Architecture: Why Two Sources Exist

**Authority Cache** (`goalradar:wc:authority:v1`):
- Written by `writeAuthorityCache()` in the orchestrator cron
- Contains all 104 WC matches as `CanonicalMatch[]`
- Excludes lineups (reduces payload ~8 KB/match, from ~1.1 MB to ~200 KB)
- Built from: FD feeds + live cache + per-match snapshots + ESPN ID lookups
- TTL: 30s (live), 300s (today), 900s (normal)
- DR copy: `goalradar:dr:wc:authority:v1` (7-day TTL)

**Match Snapshot** (`goalradar:match:{id}`):
- Written by `buildPartialSnapshot()` / `prewarm/worldcup.ts`
- Contains full `MatchDetail` + H2H + standings + lineups for a single match
- Enriched via AF events (goals, cards, substitutions) and ESPN events (lineups)
- TTL: 7 days (FINISHED), 6h (UPCOMING), 30s (LIVE)
- DR copy: `goalradar:dr:match:{id}` (30-day TTL)

**Key relationship:** The authority cache is built FROM match snapshots. If a snapshot is enriched, the authority cache built after it will also be enriched. Drift occurs when the authority cache was built BEFORE a snapshot was repaired, or when a snapshot expires and rebuilds unenriched.

---

## Drift Classification

| Severity | Condition | User Impact | Action |
|----------|-----------|-------------|--------|
| **GREEN** | All fields match | None | None |
| **YELLOW** | enrichmentApplied, goalsCount, or lineup mismatch only | None — scores correct | Log only; repair-enrichment cron fixes within 24h |
| **RED** | score mismatch OR snapshot missing | Wrong score displayed to users | Immediate repair required |

---

## Expected State Post DATA-18E

After `AUTHORITY_CACHE_ENABLED=true` is set:

| Match State | Authority Built At | Snapshot State | Expected Drift |
|-------------|-------------------|----------------|----------------|
| FINISHED, scored, enriched | After DATA-18D.3 repair | Enriched (7d TTL) | GREEN |
| FINISHED, 0-0 draw | After DATA-18D.3 | Goals=0 correct | GREEN |
| FINISHED, just completed | Within 30 min of FT | Snapshot present (7d TTL) | GREEN — prewarm runs every 30 min |
| FINISHED, snapshot expired | After 7 days with no prewarm | Snapshot rebuilt on next page load | YELLOW temporarily |

---

## Invariants Guaranteed by DATA-18D.2

1. **No DR poisoning**: `writeDRSnapshot()` refuses to write `score>0, goals=0` snapshots
2. **No prewarm DR poisoning**: `prewarm/worldcup.ts seedMatch()` skips DR write if unenriched
3. **Downgrade guard**: `writeKVSnapshot()` checks DR before writing unenriched primary; promotes enriched DR if available
4. **Cold-start proof**: simulation confirmed 4/4 matches rebuild enriched in <500ms

---

## Monitoring Endpoint

`GET /api/debug/authority-drift?secret=$CRON_SECRET`

Returns per-match GREEN/YELLOW/RED with drift reasons.  
Run after every authority cache write to confirm consistency.

---

## Live Audit (to be populated post Phase 5 deployment)

| Metric | Value |
|--------|-------|
| Total FINISHED matches audited | (run endpoint post-deploy) |
| GREEN | (run endpoint) |
| YELLOW | (run endpoint) |
| RED | (run endpoint) |
| Score drifts | (run endpoint) |
| Snapshot missing | (run endpoint) |
| Audit timestamp | (run endpoint) |
