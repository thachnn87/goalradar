# MATCH_SOURCE_INVENTORY.md
## DATA-18WC.MATCH.TRUTH — Phase 1: Data Source Inventory

---

## Single Entry Point

Every component on the match detail page derives its data from one function:

```
getOrBuildMatchSnapshot(numericId: number): Promise<MatchSnapshot>
```

Location: `src/lib/match-snapshot.ts`

This function is wrapped with `React.cache()` at line ~1 of the module, which means
multiple callers in the same request get the **same resolved promise** — not a second fetch.

---

## React.cache() Deduplication

All callers below resolve to the same snapshot instance per request:

| Caller | Location | Purpose |
|--------|----------|---------|
| `generateMetadata()` | `page.tsx:50` | SEO title/description/OG |
| `MatchDetailPage` (main) | `page.tsx:~2230` | All above-fold rendering |
| `BelowTheFoldDeferred` | `page.tsx:~2420` | Below-fold streaming subtree |
| `HeadToHeadDeferred` | `page.tsx:~2430` | H2H Suspense boundary |
| `WCGroupSectionDeferred` | `page.tsx:~2450` | WC group standings Suspense |

`React.cache()` guarantees: if `getOrBuildMatchSnapshot(123)` is called 5 times in one
render cycle, the function body executes once. All 5 callers receive the identical object.

---

## MatchSnapshot Type

```typescript
type MatchSnapshot = {
  match:          MatchDetail;      // the canonical match object
  headToHead:     HeadToHead | null;
  standings:      StandingEntry[] | null;
  wcGroupMatches: Match[] | null;   // other matches in same WC group
  wcAllMatches:   Match[] | null;   // all WC matches for bracket context
  generatedAt:    string;           // ISO timestamp of snapshot build
};
```

`snapshot.match` is the single object passed to every component.

---

## 8-Source Priority Chain (inside getOrBuildMatchSnapshot)

Sources are tried in priority order. First hit wins. No source is allowed to
**replace** a higher-priority result — only fill missing enrichment fields.

| Priority | Source | KV Key | TTL | Role |
|----------|--------|--------|-----|------|
| 1 | KV snapshot | `goalradar:match:{id}` | 30s live / 7d finished | Full cached MatchDetail |
| 2 | KV detail endpoint | `goalradar:/matches/{id}` | 60s | Provider detail from FD |
| 3 | Provider (football-data.org) | — | live fetch | Primary data source |
| 4 | Provider failover (api-football) | — | live fetch | FD failover |
| 5 | Authority:v1 | `goalradar:wc:authority:v1` | 30–900s | TBD knockout slot resolution |
| 6 | Live cache overlay | `goalradar:live:matches` | 30s | Live score/minute overlay |
| 7 | Static WC fallback | `src/data/wc-2026/fixtures.json` | ∞ | Bundled fixtures — never null |
| 8 | ESPN / API-Football enrichment | — | per-call | Goals/cards for finished WC matches with empty events |

---

## Per-Source Detail

### Source 1 — KV Snapshot
- Written by the data ingestion pipeline when a match state changes
- TTL: 30s during live play (matches ingestion refresh rate), 7 days after FINISHED
- On cache HIT: full MatchDetail returned immediately, no provider call

### Source 2 — KV Detail
- Key written when the provider `/matches/{id}` endpoint is fetched and cached
- TTL: 60s
- Used as a faster alternative to a live provider hit

### Source 3 — Provider (football-data.org)
- `GET /v4/matches/{id}` — authoritative for status, score, events
- Used when KV misses

### Source 4 — Provider failover (api-football)
- Only called if Source 3 fails (network error / rate limit)

### Source 5 — Authority:v1
- KV key `goalradar:wc:authority:v1` (WC) or `goalradar:authority:v1` (all)
- Used for: resolving TBD slots in knockout rounds (e.g. "Winner Group A")
- NOT used as a live source — status from authority is NOT used to override snapshot status

### Source 6 — Live Cache Overlay
- `getCurrentLiveMatches()` from `wc-live-ssot.ts`
- Same KV key as `/live` page and home page: `goalradar:live:matches`
- When match ID is found in live cache, score/minute is overlaid onto the snapshot
- Enforces ONE LIVE DATASET rule — same data as all other surfaces

### Source 7 — Static WC Fallback
- Bundled `fixtures.json` loaded at build time
- Last resort — ensures the page never 500s even if all KV and API fail
- Used for schedule/teams; score fields are null

### Source 8 — ESPN / API-Football Enrichment
- Applied only to FINISHED WC matches where `match.goals.length === 0` (DATA-15C.1 fix)
- Fetches goals/bookings from secondary providers to fill empty event arrays
- Does not change the canonical score — only populates event details

---

## Concurrency Model

H2H and Standings are fetched **in parallel** within `assembleSnapshot()`:

```typescript
const [h2h, standings] = await Promise.all([
  fetchHeadToHead(homeTeamId, awayTeamId),
  fetchStandings(competitionId, season),
]);
```

The match data itself must complete before either can start (IDs come from the match).

---

## Rule: ONE DATASET

The match page MUST NOT hold two MatchDetail objects or two score values simultaneously.
All data flows from `snapshot.match` — there is no secondary data object.

See MATCH_VIEWMODEL.md for enforcement.
