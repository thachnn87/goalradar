# DATA-15A Identity Audit
## Cross-Provider Match Mapping — Current State (Phase 1)

Date: 2026-06-16
Status: Audit only — no code changes in this phase.

---

## 1. Every Existing Match Cache Key

Catalogued from `grep goalradar:` across `src/`.

### Match data caches

| Key | Value | TTL | Owner | Purpose |
|-----|-------|-----|-------|---------|
| `goalradar:match:{id}` | `MatchSnapshot` | tier-aware (FINISHED 7d / UPCOMING ≤6h / LIVE not written) | match-snapshot.ts | Composite snapshot served to match page |
| `goalradar:dr:match:{id}` | `MatchSnapshot` | 30 d | match-snapshot.ts | Disaster-recovery copy |
| `goalradar:/matches/{id}` | `MatchDetail` | SWR-managed | api.ts / kv-cache.ts | Raw FD match detail |
| `goalradar:dr:/matches/{id}` | `MatchDetail` | 7 d | prewarm/worldcup.ts | DR copy of detail |
| `goalradar:live:matches` | `KVLiveEntry` (all live) | 30 s | live-cache.ts / refresh.ts | Single authority for IN_PLAY/PAUSED |
| `goalradar:dr:live:matches` | `KVLiveEntry` | 7 d | refresh.ts | DR copy of live |
| `goalradar:dr:{key}` | varies | varies | kv-cache.ts | Generic DR wrapper |
| `goalradar:lock:{logKey}` | lock token | short | kv-cache.ts | Write lock |
| `goalradar:lock:snapshot:{id}` | lock token | short | match-snapshot.ts | Snapshot build lock |

### Provider-mapping & enrichment caches

| Key | Value | TTL | Owner | Purpose |
|-----|-------|-----|-------|---------|
| `goalradar:af:lookup:WC:2026` | `Record<naturalKey, afFixtureId>` | 24 h | af-id-map.ts | FD→AF lookup table (whole tournament, one key) |
| `goalradar:af:events:{fdId}` | `CachedAFEvents` | 7 d | af-id-map.ts | AF enrichment payload per match |
| `goalradar:espn:lookup:{fdId}` | ESPN event ID string \| `'__NOT_FOUND__'` | 30 d | espn-id-map.ts | FD→ESPN ID per match |
| `goalradar:espn:event:{fdId}` | `CachedEspnEvents` | 12 h | espn-id-map.ts | ESPN enrichment payload per match |

### Infrastructure / ancillary

| Key | Purpose |
|-----|---------|
| `goalradar:prewarm:match-ids` | seeded prewarm IDs |
| `goalradar:prewarm:metrics`, `goalradar:prewarm:last-run` | prewarm telemetry |
| `goalradar:revalidation:last-run` | ISR revalidation record |
| `goalradar:rate-safe:active` | rate-limit guard flag |
| `goalradar:sitemap:matches`, `goalradar:sitemap:teams` | sitemap caches |
| `goalradar:debug:canary:{ts}` | KV health canary |

---

## 2. Every Provider-Mapping Key (the mapping problem, isolated)

| Provider | FD→provider ID mapping | Event payload | Mapping granularity |
|----------|------------------------|---------------|---------------------|
| **AF** | `goalradar:af:lookup:WC:2026` (one table, naturalKey→afId) | `goalradar:af:events:{fdId}` | Whole tournament in 1 key |
| **ESPN** | `goalradar:espn:lookup:{fdId}` (one key per match) | `goalradar:espn:event:{fdId}` | Per match |

**Two different mapping strategies for the same problem:**
- AF: a single tournament-wide table keyed by deterministic `{home}|{away}|{kickoffUtc}`, refreshed every 24h via `refreshAfLookupTable()` (1 AF API call).
- ESPN: a per-match lookup key, lazily resolved on first enrichment via `findEspnMatch()` (scoreboard scan), stored 30 days with a `'__NOT_FOUND__'` sentinel.

There is **no shared identity** — FD ID is the implicit join key, and each provider re-implements its own resolution and caching.

---

## 3. All Lookup Paths

```
buildSnapshot(fdId)                                    [match-snapshot.ts:343]
  └─ needsEnrichment = FINISHED && WC && goals===0
       ├─ AF_ENRICHMENT_ENABLED?
       │    └─ enrichMatchWithAFEvents(match)          [af-id-map.ts:218]
       │         ├─ kv.get(goalradar:af:events:{fdId}) → HIT? apply & return
       │         ├─ resolveAfFixtureId(match)          [af-id-map.ts:116]
       │         │    └─ kv.get(goalradar:af:lookup:WC:2026)[buildMappingKey(match)]
       │         ├─ ApiFootballProvider.getMatch(afId) (2 AF calls)
       │         └─ kv.set(goalradar:af:events:{fdId}, 7d)
       │
       └─ ESPN_ENRICHMENT_ENABLED && still goals===0?
            └─ enrichMatchWithEspnEvents(match)        [espn-id-map.ts:140]
                 ├─ kv.get(goalradar:espn:event:{fdId}) → HIT? apply & return
                 ├─ resolveEspnMatchId(match)          [espn-id-map.ts:79]
                 │    ├─ kv.get(goalradar:espn:lookup:{fdId}) → HIT? return
                 │    ├─ findEspnMatch(home, away, utcDate)  [providers/espn.ts:229]
                 │    │    └─ ESPN scoreboard scan (UTC date, then prev-day)
                 │    └─ kv.set(goalradar:espn:lookup:{fdId}, 30d)  [fire-and-forget]
                 ├─ getEspnMatchEvents(espnId)         [providers/espn.ts:278]
                 └─ kv.set(goalradar:espn:event:{fdId}, 12h)  [fire-and-forget]
```

**Two independent resolution chains, both keyed off the FD match object, neither aware of the other.**

---

## 4. All Duplicate Logic

| Concern | af-id-map.ts | espn-id-map.ts | providers/espn.ts | Duplication |
|---------|--------------|----------------|-------------------|-------------|
| Team-name normalisation | `normaliseTeamName()` + `CANONICAL_ALIASES` | — | `normaliseName()` + `ESPN_ALIASES` | **2 alias maps**, partially overlapping, can drift |
| Deterministic match key | `buildMappingKey()` = `{home}\|{away}\|{ts}` | — | (implicit in scoreboard scan by name+date) | Same concept, one implemented |
| Provider-ID resolution | `resolveAfFixtureId()` | `resolveEspnMatchId()` | `findEspnMatch()` | Parallel implementations |
| Event payload cache schema | `CachedAFEvents` | `CachedEspnEvents` | — | Near-identical shapes (goals/bookings/subs/+id/+enrichedAt) |
| `applyEvents()` merge | `applyEvents()` | `applyEspnEvents()` (+ team-ID resolution from DATA-14A) | — | Two merge functions; only ESPN one resolves team IDs |
| KV-enabled guard | `KV_ENABLED` const | `KV_ENABLED` const | — | Repeated literal |
| Fire-and-forget cache write | yes | yes | — | Repeated pattern |

**Alias-map drift is the highest-value duplication to eliminate.** `ESPN_ALIASES` includes `united states→usa`, `república dominicana→…` that `CANONICAL_ALIASES` (AF) lacks; AF includes none of the ESPN-only entries. A team enriched by one provider can normalise differently than the other.

---

## 5. Migration Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | **Reverse-index namespace collision.** Spec proposed `goalradar:fd:{id}` / `goalradar:espn:{id}` / `goalradar:af:{id}`. A `kv.scan('goalradar:af:*')` or `goalradar:espn:*` would sweep BOTH the new index keys AND the existing `goalradar:af:events:*` / `goalradar:espn:event:*` / `goalradar:espn:lookup:*` keys. | High | Use `goalradar:idx:{provider}:{id}` prefix (adopted in skeleton). Keeps reverse indexes in their own scan namespace. |
| R2 | **Alias-map consolidation changes existing keys.** AF's `goalradar:af:lookup:WC:2026` is keyed by `buildMappingKey()` using `CANONICAL_ALIASES`. If the identity layer's merged alias map normalises a name differently, the natural key won't match the existing AF table. | Medium | Identity `buildNaturalKey()` mirrors AF's exact format. Treat the merged alias map as a superset; verify no existing AF entry changes token. Backfill, don't rewrite, the AF table. |
| R3 | **FD-anchored canonical ID assumes FD entry.** `wc2026_{fdId}` requires every match to enter via FD. A match seen only via a provider (no FD ID) can't mint a canonical ID. | Low | All matches currently enter via FD (FD is fixture authority). Natural-key index covers the provider-only edge case for resolution; minting still needs FD. |
| R4 | **Stale provider IDs.** ESPN lookup uses a `'__NOT_FOUND__'` sentinel (30d). If ESPN later publishes a match, the sentinel suppresses re-resolution. Identity layer would inherit this if backfilled blindly. | Medium | Don't copy `'__NOT_FOUND__'` sentinels into identity records; treat absence of an ID as "unresolved", not "negative". |
| R5 | **Dual-write divergence during migration.** While both old keys and identity records are written, a failure of one but not the other yields inconsistent state. | Medium | Identity writes are additive and best-effort; old path remains authoritative until cutover. Flag-gated (`IDENTITY_LAYER_ENABLED`). |
| R6 | **AF unavailable for WC 2026 on current plan** (confirmed this session: AF free plan returns `"Free plans do not have access to this season, try from 2022 to 2024"`). `afFixtureId` will be absent for all WC 2026 matches regardless of design. | Info | Identity model keeps `afFixtureId` optional. ESPN is the de-facto sole enricher for WC 2026. Document AF as dormant. |
| R7 | **TTL mismatch across layers.** ESPN event cache 12h, AF events 7d, snapshot 7d, proposed identity 60d. A short-TTL provider cache can expire under a long-lived identity record. | Low | Identity stores the mapping (stable), not the event payload (volatile). Mapping outliving payload is correct and desired. |
| R8 | **No production-write constraint this sprint.** DATA-15A forbids touching snapshot logic / existing keys. | — | Skeleton is dormant (`IDENTITY_LAYER_ENABLED` default OFF), imported by nothing. |

---

## 6. Audit Conclusion

The system already has a **de-facto canonical ID: the FD match ID.** Every cache and both provider mappings are keyed off it. The fragmentation is not in the *identity* but in the *resolution and normalisation logic*, which is duplicated per provider with drifting alias maps and two different caching strategies.

The canonical identity layer should therefore:
1. Formalise FD ID as the canonical anchor (`wc2026_{fdId}`).
2. Consolidate the two alias maps into one normaliser.
3. Provide bidirectional provider-ID lookup (forward: canonical→provider; reverse: provider→canonical) so future providers register once.
4. Remain additive — existing keys and snapshot logic untouched until a flagged cutover.

See `DATA15A_CANONICAL_ARCHITECTURE.md` for the model, KV schema, ownership matrix, and migration plan.
