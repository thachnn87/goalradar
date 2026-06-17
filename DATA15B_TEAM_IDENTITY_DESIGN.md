# DATA-15B Team Identity Design
## Provider-Agnostic Team Identity Layer (Proposal)

Date: 2026-06-17
Status: **Design proposal only.** No code, no production writes. Companion to
`DATA15A_CANONICAL_ARCHITECTURE.md` (Match Identity) and the negative-cache audit.

---

## 1. Motivation

The match-level layer (DATA-15A) canonicalises *fixtures*. But cross-provider
mapping ultimately bottoms out on **team names**, and those are fragmented:

| Alias map | File | Scope | Example entries |
|-----------|------|-------|-----------------|
| `CANONICAL_ALIASES` | af-id-map.ts | FD↔AF | czechia, bosnia-herzegovina, korea republic |
| `ESPN_ALIASES` | providers/espn.ts | FD↔ESPN | usa, ivory coast, dominican republic |
| `CANONICAL_ALIASES` | match-identity.ts (15A) | merged superset | union of the above |

Three partial, hand-maintained, **drifting** maps. The DATA-15B audit found the
direct cost: `Türkiye` (ESPN) vs `Turkey` (FD) has no alias in `ESPN_ALIASES`, so
match 537346 fails to resolve, writes a 30-day false-negative sentinel, and shows
a 2-0 match as "goalless" in production.

There is also a second, distinct team-ID problem (from DATA-14A): event objects
carry **provider team IDs** (ESPN Iran = 469) that don't equal FD team IDs, so
`g.team.id === match.homeTeam.id` filters fail until reconciled. Both problems are
"the same team, identified differently by each provider" — a Team Identity Layer
solves both.

---

## 2. Goals

1. **One** team-name normaliser, replacing all three alias maps.
2. **Complete, not reactive:** the 48 WC 2026 teams are known in advance, so the
   table can be authored once and exhaustively, not patched per discovered gap.
3. Bidirectional ID mapping: `(provider, providerTeamId) ↔ canonicalTeamId` and
   `name → canonicalTeamId`.
4. Centralise the DATA-14A event-team-ID reconciliation.
5. Provider-extensible: add a provider by registering its names/IDs once.

---

## 3. Model

```typescript
interface TeamIdentity {
  canonicalId:   string;   // stable slug, e.g. "turkiye"  (NOT a provider ID)
  canonicalName: string;   // display name, e.g. "Türkiye"
  fifaCode?:     string;   // "TUR" — stable 3-letter, ideal natural anchor
  confederation?: string;  // "UEFA" (optional, useful for grouping)

  // Provider identifiers (filled as discovered / seeded)
  fdTeamId?:   number;
  espnTeamId?: number;
  afTeamId?:   number;

  // All known name variants across providers, lowercased + diacritics-stripped.
  // The normaliser matches against this set.
  aliases: string[];       // ["turkey", "turkiye", "türkiye", "tur"]
}
```

### Canonical ID recommendation

Use a **stable lowercase slug anchored on the FIFA 3-letter code** where possible
(`tur`, `civ`, `nzl`) or a clean team slug (`turkiye`, `ivory-coast`). Rationale:

- Provider-independent (unlike anchoring on FD team ID, which privileges FD and is
  numeric/opaque).
- FIFA codes are stable, unique within the tournament, and already exist for all
  48 teams.
- Human-readable for debugging, unlike numeric provider IDs.

(Contrast with DATA-15A's *match* canonical ID, which anchors on the FD match ID:
for matches, FD is the fixture authority and IDs are guaranteed unique; for teams,
the FIFA code is the better cross-provider-neutral anchor.)

---

## 4. KV Schema

| Key | Value | TTL | Purpose |
|-----|-------|-----|---------|
| `goalradar:teamid:{canonicalId}` | `TeamIdentity` JSON | none / tournament | Source of truth |
| `goalradar:teamidx:fd:{fdTeamId}` | canonicalId | tournament | Reverse: FD → canonical |
| `goalradar:teamidx:espn:{espnTeamId}` | canonicalId | tournament | Reverse: ESPN → canonical |
| `goalradar:teamidx:af:{afTeamId}` | canonicalId | tournament | Reverse: AF → canonical |
| `goalradar:teamidx:name:{normalisedName}` | canonicalId | tournament | Reverse: any alias → canonical |

Uses the `teamidx:` prefix (consistent with DATA-15A R1) to avoid `kv.scan`
collisions. For the WC use case the whole 48-team table is small enough to also
ship as a **static bundled seed** (`src/data/worldcup/teams.json`), making the KV
layer a cache/override rather than the only source — no cold-miss risk.

---

## 5. API surface (proposed `src/lib/team-identity.ts`)

| Function | Signature | Role |
|----------|-----------|------|
| `canonicalTeamId` | `(name: string) → string \| null` | Normalise any provider name → canonical slug (replaces all 3 alias maps) |
| `resolveTeamByProviderId` | `(provider, id) → TeamIdentity \| null` | ESPN team 469 → Iran identity |
| `toFdTeam` | `(providerTeam, canonical) → Team` | Rewrite an event's team to the FD `Team` object (centralises DATA-14A reconciliation) |
| `loadTeamIdentity` | `(canonicalId) → TeamIdentity \| null` | Read record |
| `seedTeamIdentities` | `(teams: TeamIdentity[]) → void` | One-time load from static WC table |

`canonicalTeamId` is the single normaliser. `findEspnMatch`, `buildMappingKey`
(AF), and `buildNaturalKey` (15A match layer) all call it instead of their local
`normaliseName`/`normaliseTeamName`.

---

## 6. How it fixes the audit findings

| Finding | Fix via Team Identity Layer |
|---------|------------------------------|
| F1/F2 537346 false negative (turkey/türkiye) | `turkiye` identity lists `["turkey","türkiye","turkiye","tur"]`; both FD and ESPN names resolve to the same canonicalId → match resolves |
| Alias-map drift (3 files) | All replaced by one `canonicalTeamId()` backed by a complete seed |
| DATA-14A event team-ID mismatch | `toFdTeam()` resolves ESPN/AF team IDs → FD `Team` via `teamidx:espn:*` / `teamidx:af:*` |
| Future provider expansion | Register the new provider's names/IDs in the seed; no new alias map |

---

## 7. Relationship to Match Identity (DATA-15A)

```
Team Identity Layer   →  canonicalTeamId(home), canonicalTeamId(away)
        │                          │
        └──────────────┬───────────┘
                       ▼
Match Identity Layer   buildNaturalKey({home, away, kickoffUtc})  → naturalKey
                       resolveCanonicalId("WC", fdMatchId)        → wc2026_537364
```

The match layer's `naturalKey` becomes **robust** only once team names are
canonicalised — otherwise the same drift that breaks ESPN resolution would break
the natural-key reverse index. **Team Identity is a prerequisite for the match
layer's natural-key path to be reliable.**

---

## 8. Migration sketch (no production writes this sprint)

| Stage | Action | Reversible |
|-------|--------|-----------|
| T0 | Author static `teams.json` (48 WC teams, all known aliases incl. FD+ESPN+AF names) | delete file |
| T1 | Add dormant `team-identity.ts` reading the static seed; flag `TEAM_IDENTITY_ENABLED=false` | flag off |
| T2 | Route `findEspnMatch` / AF `buildMappingKey` through `canonicalTeamId` (flag-gated); legacy maps remain as fallback | flag off |
| T3 | Route DATA-14A event team rewrite through `toFdTeam` | flag off |
| T4 | Remove the three local alias maps once parity is confirmed | revert commit |

Rollback at every stage is a flag flip; the static seed is additive and the legacy
alias maps stay in place until T4.

---

## 9. Validation (using audit data)

| Provider | Name seen | `canonicalTeamId` | Resolves to |
|----------|-----------|-------------------|-------------|
| FD | "Turkey" | `turkiye` | Türkiye identity (TUR) |
| ESPN | "Türkiye" | `turkiye` | same |
| FD | "Czechia" | `czech-republic` | Czech Republic |
| ESPN | "Côte d'Ivoire" | `ivory-coast` | Ivory Coast |
| FD | "Cape Verde Islands" | `cape-verde` | Cape Verde |
| ESPN event team id 469 | (Iran) | via `teamidx:espn:469` | Iran (FD id) |

With the seed in place, 537346 Australia vs Turkey resolves to ESPN 760421, the
false-negative sentinel never gets written, and the page shows the real 2-0
scorers.

---

## 10. Recommendation

Build the Team Identity Layer **before** activating the DATA-15A match natural-key
path. It is small (48 known teams), high-leverage (kills an entire class of
false-negative sentinels and the event-team-ID mismatch), and a hard prerequisite
for reliable cross-provider matching. Pair it with the split positive/negative TTL
from the negative-cache audit so that any *future* unseen alias gap self-heals in
hours instead of persisting for the tournament.
