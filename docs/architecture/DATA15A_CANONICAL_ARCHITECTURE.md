# DATA-15A Canonical Architecture
## Provider-Agnostic Match Identity Layer — Design (Phases 2–6)

Date: 2026-06-16
Status: Design + dormant skeleton. No production snapshot logic or existing cache keys modified.
Companion: `DATA15A_IDENTITY_AUDIT.md` (Phase 1), `src/lib/match-identity.ts` (skeleton).

---

## Phase 2 — Canonical Identity Model

```typescript
interface MatchIdentity {
  canonicalId: string;   // "wc2026_537364"
  competition: string;   // "WC"
  kickoffUtc:  string;   // "2026-06-16T01:00Z"
  homeTeam:    string;   // normalised token "iran"
  awayTeam:    string;   // normalised token "new zealand"
  naturalKey:  string;   // "iran|new zealand|2026-06-16T01:00Z"

  fdMatchId?:   number;  // 537364
  espnEventId?: number;  // 760427
  afFixtureId?: number;  // (absent for WC 2026 — see R6)

  createdAt: number;
  updatedAt: number;
}
```

### Canonical ID format — Recommendation

Two candidates were specified:

| Option | Example | Deterministic | Stable forever | Provider-independent | Fragility |
|--------|---------|---------------|----------------|----------------------|-----------|
| **A. FD-anchored** | `wc2026_537364` | ✅ | ✅ (FD IDs never change) | ✅ (naming is ours, not a provider's) | None |
| B. Natural-key | `wc2026_iran_new-zealand_2026-06-15` | ⚠️ depends on normalisation | ⚠️ breaks on reschedule / rename | ✅ | High |

**Recommendation: Option A — `wc2026_{fdMatchId}`.**

Rationale:
- FD is **already** the system's authority for fixtures, scores, status, and standings (see ownership matrix). Anchoring the canonical ID to the FD ID formalises what is already true.
- FD match IDs are globally unique and immutable → deterministic and collision-free with zero normalisation logic.
- Option B is fragile: (1) team-name normalisation can drift between providers (the exact bug the layer exists to kill), (2) a kickoff reschedule changes the date segment, (3) two legs of the same pairing (group + knockout) would need extra disambiguation.
- Option B's value — resolving identity from provider data when no FD ID is in hand — is preserved as the **`naturalKey`** field + `goalradar:idx:nat:{naturalKey}` reverse index, without making it the primary key.

The canonical ID is opaque downstream; only the identity layer parses it. A human-readable `slug` for URLs remains a separate display concern (unchanged from today's `{fdId}-home-vs-away`).

---

## Phase 3 — Identity Store (`src/lib/match-identity.ts`)

Skeleton delivered. Public surface:

| Function | Signature | Role |
|----------|-----------|------|
| `resolveCanonicalId` | `(competition, fdMatchId) → string` | Mint deterministic canonical ID |
| `buildIdentityKey` | `(canonicalId) → string` | `goalradar:identity:{id}` |
| `buildReverseIndexKey` | `(provider, id) → string` | `goalradar:idx:{provider}:{id}` |
| `buildNaturalKey` | `({home,away,kickoffUtc}) → string` | Deterministic `{h}\|{a}\|{ts}` (mirrors AF) |
| `saveIdentity` | `(MatchIdentity) → Promise<void>` | Write record + all reverse indexes (additive, idempotent) |
| `loadIdentity` | `(canonicalId \| {provider,id} \| {naturalKey}) → Promise<MatchIdentity\|null>` | Read by any key |
| `resolveProviderIds` | `(ref) → Promise<{fdMatchId,espnEventId,afFixtureId}\|null>` | Provider-ID subset |
| `normaliseTeam` | `(name) → string` | **Single** consolidated normaliser |

### KV Schema (authoritative)

| Key | Value | TTL | Notes |
|-----|-------|-----|-------|
| `goalradar:identity:{canonicalId}` | `MatchIdentity` JSON | 60 d | Source of truth for the mapping |
| `goalradar:idx:fd:{fdMatchId}` | `canonicalId` string | 60 d | Reverse: FD ID → canonical |
| `goalradar:idx:espn:{espnEventId}` | `canonicalId` string | 60 d | Reverse: ESPN ID → canonical |
| `goalradar:idx:af:{afFixtureId}` | `canonicalId` string | 60 d | Reverse: AF ID → canonical |
| `goalradar:idx:nat:{naturalKey}` | `canonicalId` string | 60 d | Reverse: natural key → canonical |

**Namespace decision (R1):** the spec proposed `goalradar:fd:{id}` / `goalradar:espn:{id}` / `goalradar:af:{id}`. We use the **`goalradar:idx:` prefix** instead. The bare-provider form collides under `kv.scan()` with the existing enrichment keys `goalradar:espn:event:*`, `goalradar:espn:lookup:*`, `goalradar:af:events:*`, `goalradar:af:lookup:*`. The `idx:` prefix gives the reverse indexes their own scan namespace and is the single deviation from the proposed schema.

TTL 60 d covers the full tournament window (a WC 2026 runs ~mid-June to mid-July). The mapping is stable, so the identity record deliberately outlives the short-TTL provider event caches (12h ESPN / 7d AF).

---

## Phase 4 — Match Merge Engine (design only, NOT implemented)

```
buildCanonicalMatch(fd: MatchDetail, espn?: EspnMatchEvents, af?: CachedAFEvents) → CanonicalMatch
```

`CanonicalMatch` = the FD match, with the identity attached and the highest-priority source applied per field.

### Ownership Matrix — Source of Truth

| Field | Primary | Fallback(s) | Notes |
|-------|---------|-------------|-------|
| **score** | FD | live overlay (`goalradar:live:matches`, FD-sourced) when IN_PLAY/PAUSED | FD is fixture authority; live cache supersedes only while live |
| **status** | FD + live overlay | — | Overlay guards on `live.status` (LIVE-2B) |
| **minute** | live cache (FD polling) | — | Only meaningful while live |
| **standings** | FD (`getStandingsCached`) | static WC fallback | FD only |
| **goals** | **ESPN** | AF (if available) | WC 2026: ESPN sole source (AF plan blocked, R6) |
| **assists** | ESPN | AF | Positional participant parse (DATA-13C) |
| **cards** | ESPN | AF | By `type.id` 94/95/96 |
| **subs** | ESPN | AF | Positional `[0]=in,[1]=out` |
| **lineups** | ESPN (`rosters`) | AF | Researched DATA-14A; not yet implemented |
| **stats** | computed from events (ESPN) | AF real stats if available | FD free tier omits stats |
| **venue** | FD | AF (`afDetail.venue`), ESPN (`gameInfo`) | FD usually present |
| **attendance** | AF / ESPN `gameInfo` | — | Not currently captured |
| **referee** | AF / ESPN `gameInfo` | — | Not currently captured |

### Recommended priority order (per field class)

1. **Fixture spine** (identity, teams, competition, kickoff, score, status, standings) → **FD always wins.** It is the authority and the canonical anchor.
2. **Live mutations** (in-play score, status, minute) → **live cache overlay** supersedes FD detail while `isLiveStatus(live.status)`.
3. **Event detail** (goals, assists, cards, subs, lineups) → **ESPN first** for WC 2026, **AF second** if/when its plan permits. Never FD (free tier omits these).
4. **Auxiliary** (venue, attendance, referee, stats) → **FD → AF → ESPN**, first non-null wins; stats computed from events when no provider supplies them.

**Team-ID reconciliation (carried from DATA-14A):** event objects from ESPN/AF carry provider team IDs. `buildCanonicalMatch` must rewrite each event's `team` to the FD team object (by `normaliseTeam`) so downstream filters (`g.team.id === match.homeTeam.id`) work. This logic, currently in `applyEspnEvents`, moves into the merge engine.

---

## Phase 5 — Migration Plan

`Current cache → Identity layer → Snapshot v2`, staged and reversible. **No production writes occur until a stage is flag-enabled.**

| Stage | Action | Writes? | Flag | Reversible |
|-------|--------|---------|------|------------|
| **S0 (this sprint)** | Deploy dormant `match-identity.ts`. Imported by nothing. | None | `IDENTITY_LAYER_ENABLED=false` | Delete file |
| **S1 Backfill** | Offline script reads existing `goalradar:espn:lookup:*` + FD snapshots, mints identities, calls `saveIdentity`. Skips `'__NOT_FOUND__'` sentinels (R4). | New `goalradar:identity:*` / `idx:*` only | manual script | `kv.del` the new keys |
| **S2 Dual-write** | In enrichment, after resolving a provider ID, also `saveIdentity()` (additive). Old keys still written and still authoritative. | New keys + existing keys | `IDENTITY_LAYER_ENABLED=true` | Flag OFF |
| **S3 Read cutover** | Enrichment resolves provider IDs via `resolveProviderIds()` first; falls back to old resolvers on miss. | Same as S2 | `IDENTITY_READ_PATH=true` | Flag OFF → old resolvers |
| **S4 Snapshot v2** | `MatchSnapshot` gains `identity: MatchIdentity`. `buildCanonicalMatch` replaces inline `applyEspnEvents`/`applyEvents`. | Snapshot key (v2 shape) | `SNAPSHOT_V2=true` | Flag OFF → v1 builder |
| **S5 Decommission** | Remove `af-id-map`/`espn-id-map` resolution duplication; keep event-payload caches. | — | — | Revert commit |

### Rollback strategy

- **Every stage is flag-gated and additive.** Identity keys (`goalradar:identity:*`, `goalradar:idx:*`) are a brand-new namespace; the old keys (`goalradar:match:*`, `goalradar:espn:*`, `goalradar:af:*`) are never mutated or deleted before S5.
- **Instant rollback at S2–S4:** set the relevant flag to `false`. The legacy resolution path (`resolveEspnMatchId` / `resolveAfFixtureId`) remains intact and authoritative throughout, so disabling the flag restores prior behaviour with zero data loss.
- **S1 backfill rollback:** `kv.scan('goalradar:identity:*')` + `kv.scan('goalradar:idx:*')` → `kv.del`. No legacy key touched.
- **S4 snapshot rollback:** v2 adds an optional `identity` field; the v1 reader ignores unknown fields, so a flag flip back to the v1 builder is safe even with v2 records present.
- **DR untouched:** `goalradar:dr:*` keys are never part of the identity layer; disaster recovery is unaffected at every stage.

---

## Phase 6 — Validation

Provider IDs confirmed this session (ESPN live; AF blocked by free-plan season restriction, R6).

| FD ID | Match | ESPN Event ID | AF Fixture ID | Expected canonicalId |
|-------|-------|---------------|---------------|----------------------|
| 537352 | Ivory Coast vs Ecuador | 760423 | _unavailable_ (plan) | `wc2026_537352` |
| 537358 | Sweden vs Tunisia | 760424 | _unavailable_ (plan) | `wc2026_537358` |
| 537364 | Iran vs New Zealand | 760427 | _unavailable_ (plan) | `wc2026_537364` |

### Example identity record (537364)

```json
{
  "canonicalId": "wc2026_537364",
  "competition": "WC",
  "kickoffUtc":  "2026-06-16T01:00Z",
  "homeTeam":    "iran",
  "awayTeam":    "new zealand",
  "naturalKey":  "iran|new zealand|2026-06-16T01:00Z",
  "fdMatchId":   537364,
  "espnEventId": 760427,
  "createdAt":   1750000000000,
  "updatedAt":   1750000000000
}
```

Reverse indexes written:
```
goalradar:idx:fd:537364    → "wc2026_537364"
goalradar:idx:espn:760427  → "wc2026_537364"
goalradar:idx:nat:iran|new zealand|2026-06-16T01:00Z → "wc2026_537364"
```
(`goalradar:idx:af:*` not written — no AF fixture ID for WC 2026.)

**Note on AF availability (R6):** `GET /fixtures?league=1&season=2026` on the current AF plan returns `"Free plans do not have access to this season, try from 2022 to 2024."` AF enrichment is therefore dormant for WC 2026 regardless of `ENABLE_AF_ENRICHMENT=true`. ESPN is the sole active enricher. The identity model keeps `afFixtureId` optional so AF can be slotted in later (paid plan / different season) with no schema change.

---

## Migration Checklist

- [ ] **S0** Merge dormant `match-identity.ts` (flag OFF). ✅ skeleton delivered, `tsc` clean.
- [ ] **S0** Confirm nothing imports `match-identity.ts` in production paths.
- [ ] **S1** Write backfill script: scan `goalradar:espn:lookup:*`, read FD snapshots, mint + `saveIdentity`. Skip `'__NOT_FOUND__'`.
- [ ] **S1** Verify backfilled `naturalKey` matches existing `goalradar:af:lookup:WC:2026` keys byte-for-byte (R2).
- [ ] **S1** Spot-check reverse indexes resolve for 537352 / 537358 / 537364.
- [ ] **S2** Add `saveIdentity()` call in `enrichMatchWithEspnEvents` after ID resolve (behind flag). Old keys still written.
- [ ] **S2** Add `saveIdentity()` call in `enrichMatchWithAFEvents` (behind flag) for non-WC competitions where AF works.
- [ ] **S2** Monitor: identity record count == enriched match count; no write errors in logs.
- [ ] **S3** Route `resolveEspnMatchId` / `resolveAfFixtureId` through `resolveProviderIds()` first, legacy fallback on miss (behind `IDENTITY_READ_PATH`).
- [ ] **S3** Consolidate `ESPN_ALIASES` + `CANONICAL_ALIASES` into `normaliseTeam`; verify no AF table key changes (R2).
- [ ] **S4** Extend `MatchSnapshot` with optional `identity` field; implement `buildCanonicalMatch` with ownership matrix; move team-ID reconciliation out of `applyEspnEvents`.
- [ ] **S4** Snapshot v2 behind `SNAPSHOT_V2`; v1 reader must ignore the new field.
- [ ] **S5** Remove duplicated resolution logic from `af-id-map.ts` / `espn-id-map.ts`; keep event-payload caches.
- [ ] **Rollback drills**: verify each flag flip (S2/S3/S4) restores prior behaviour; verify `kv.del` of `idx:*`/`identity:*` is clean.
- [ ] **Constraint check**: no change to `goalradar:match:*`, `goalradar:espn:event:*`, `goalradar:af:events:*` keys or `buildSnapshot` until S4.

---

## Deliverables Status

| Deliverable | Status |
|-------------|--------|
| `DATA15A_IDENTITY_AUDIT.md` | ✅ |
| `DATA15A_CANONICAL_ARCHITECTURE.md` | ✅ (this doc) |
| `src/lib/match-identity.ts` skeleton | ✅ (dormant, `tsc` clean) |
| Migration checklist | ✅ (above) |

**Constraints honoured:** no production snapshot logic modified, no existing cache keys changed, skeleton is flag-gated and imported by nothing.
