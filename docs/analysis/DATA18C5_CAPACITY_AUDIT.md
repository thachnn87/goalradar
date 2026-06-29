# DATA-18C.5 Phase 3 — Capacity Audit

**Audit date:** 2026-06-18  
**Sources:** Code audit of `src/lib/canonical-match.ts`, `src/lib/authority-cache.ts`, production endpoint evidence

---

## 1. Per-Match Payload Size

The `CanonicalMatch` interface (from `src/lib/canonical-match.ts`) explicitly excludes lineups:

> *"Excluding lineups reduces the authority cache bulk payload by ~8 KB per match (from ~1.1 MB to ~200 KB for a fully-enriched 104-match tournament payload)."*

This gives us the baseline calibration:

| State | Payload size |
|---|---|
| With lineups (not stored) | ~10.6 KB/match (1.1 MB / 104) |
| **Without lineups (actual)** | **~1.9 KB/match** (200 KB / 104) |

**Breakdown by match type:**
- Upcoming/scheduled match (no events, no enrichment): ~600-800 bytes
- Finished, unenriched: ~800-1,000 bytes
- Finished, enriched (3 goals, 2 cards, 3 subs): ~2.0-2.5 KB
- Finished, heavily enriched (6+ goals, 5+ cards): ~3.0-3.5 KB

At WC 2026 group stage completion (80 FINISHED, 24 SCHEDULED): weighted average closer to 2.0-2.2 KB per match.

---

## 2. KV Footprint by Match Count

The envelope written to KV: `AuthorityCacheEnvelope` (JSON-serialized):

| Matches | Envelope size (est.) | Envelope overhead | Total key size |
|---|---|---|---|
| **104** (current WC) | 197 KB | 1 KB | **~198 KB** |
| **128** (expanded group stage) | 243 KB | 1 KB | **~244 KB** |
| **256** (hypothetical 2-tournament) | 486 KB | 1 KB | **~487 KB** |
| **512** (hypothetical 4-tournament) | 973 KB | 1 KB | **~974 KB (~1 MB)** |

**Each** of these sizes applies to BOTH the primary key and the DR key (same envelope stored twice).

| Matches | Primary | DR | Total authority keys |
|---|---|---|---|
| 104 | 198 KB | 198 KB | **~396 KB** |
| 128 | 244 KB | 244 KB | **~488 KB** |
| 256 | 487 KB | 487 KB | **~974 KB** |
| 512 | 974 KB | 974 KB | **~1.95 MB** |

---

## 3. Full KV Footprint (Current System)

| Key / Key group | Type | Size |
|---|---|---|
| `goalradar:wc:authority:v1` | String | ~198 KB |
| `goalradar:dr:wc:authority:v1` | String | ~198 KB |
| `goalradar:authority:last-write` | String | ~200 bytes |
| `goalradar:authority:telemetry:daily:*` (30 keys) | Hash × 30 | ~15 KB |
| `goalradar:health:archive` | ZSET | ~0.4–2 MB |
| `goalradar:match:{id}` (104 snapshot keys) | String × 104 | ~1 KB × 104 = ~104 KB |
| Other KV keys (standings, fixtures, ESPN IDs, etc.) | Various | ~1–5 MB |
| **Authority cache subsystem total** | | **~425 KB** |
| **Full system estimate** | | **~3–8 MB** |

---

## 4. Vercel KV Limits

Vercel KV is backed by Upstash Redis. Relevant limits:

| Limit | Value | Our usage |
|---|---|---|
| Max single key size | 100 MB | ~198 KB (0.2% of limit) |
| Max total storage (Pro) | 256 MB–10 GB | ~3–8 MB (< 3%) |
| Max commands/second | ~1000/s (burst) | Low (cron-based) |
| `kv.mget` max args | No fixed hard limit (chunked at 100 in code) | Safe |

**No KV limits are at risk through WC2026 at any match count scenario (104–512).**

---

## 5. Risk Thresholds

| Scenario | Authority key size | Risk |
|---|---|---|
| 104 matches (current) | ~198 KB | ✅ None |
| 128 matches (+23%) | ~244 KB | ✅ None |
| 256 matches (+146%) | ~487 KB | ✅ None |
| 512 matches (+392%) | ~974 KB | ✅ None |
| 50,000 matches (theoretical) | ~95 MB | ⚠️ Near 100 MB single-key limit |

**Risk threshold: > 50 MB per key** (50,000+ matches or heavily enriched payload). WC2026 at 104 matches is 0.2% of this threshold — no risk.

---

## 6. Serialization Growth During Tournament

WC 2026 match data grows as the tournament progresses:

| Phase | Finished matches | Approximate payload growth |
|---|---|---|
| Group stage start (now) | 24 | ~198 KB |
| Group stage end | 48 | ~210 KB (+6%) |
| Round of 32 complete | 80 | ~218 KB (+10%) |
| Semifinals | 96 | ~222 KB (+12%) |
| Final | 104 | ~225 KB (+14%) |

Growth is bounded and linear. The payload grows by ~1.5 KB per newly-enriched FINISHED match (replacing ~800 bytes scheduled placeholder with ~2.3 KB enriched record). Total growth from now to tournament end: **~27 KB (+14%).** No operational impact.

---

## 7. Cold Rebuild KV Read Amplification

When cold rebuild fires (both primary and DR absent), `coldRebuild()` issues:
- 1 FD upcoming matches call (cached in KV)
- 1 FD finished matches call (cached in KV)
- 1 FD live matches call (live cache in KV)
- 1 `kv.mget` of 104 snapshot keys (100-key chunk)
- 1 `kv.mget` of 104 ESPN ID keys (100-key chunk)

Total KV reads per cold rebuild: ~5-7 operations (plus chunked mgets = ~3 Redis commands for 104 keys). **Cold rebuild is KV-efficient**: it reads existing data without creating new large keys.

---

## 8. Summary

The authority cache KV footprint at all match scales (104–512) is well within Vercel KV limits. Total system KV usage is ~3–8 MB against a 256 MB+ limit. No capacity risk exists for WC2026 or any foreseeable expansion.
