# DATA-18A Canonical Match Model
## CanonicalMatch Interface Design

Date: 2026-06-17
Status: Design only — dormant. No production activation.

---

## 1. Why Not `type CanonicalMatch = Match`

The DATA-17 alias `export type CanonicalMatch = Match` serves as a call-site label
but provides no structural guarantee. Any function that receives a `Match` satisfies
the type, meaning:

- A raw FD bulk-feed entry (no goals, no ESPN data) is a valid `CanonicalMatch`.
- A `MatchSnapshot` (extends `MatchDetail`) is a valid `CanonicalMatch`.
- There is no way to enforce that a `CanonicalMatch` has passed through the authority
  stack, or to distinguish sources at compile time.

A real interface solves this by:
1. Defining a distinct structural shape the compiler enforces.
2. Expressing field ownership explicitly (FD owns identity, ESPN owns events).
3. Carrying `source` and `enrichmentApplied` so any consumer can inspect provenance.
4. Using `state` (semantic bucket) instead of raw FD `status` (protocol string).

---

## 2. Field Ownership Rules

| Field group | Authoritative owner | Fallback | Never owned by |
|-------------|---------------------|----------|----------------|
| `id`, `fdMatchId` | FD (fixture identity) | — | ESPN, AF |
| `espnMatchId` | ESPN lookup cache | absent if unresolved | — |
| `competitionCode` | FD | — | — |
| `utcDate` | FD | — | — |
| `state` | derived from FD status + live cache + snapshot | — | — |
| `minute` | live cache (primary) | snapshot `minute` | FD bulk feed |
| `homeTeam`, `awayTeam` | FD (id, name, shortName, tla, crest) | — | ESPN |
| `score` | FD results feed | snapshot `score` | ESPN (never score) |
| `goals` | ESPN enrichment | AF (dormant) | FD bulk (no events) |
| `cards` | ESPN enrichment | AF (dormant) | — |
| `substitutions` | ESPN enrichment | AF (dormant) | — |
| `lineups` | ESPN enrichment | AF (dormant) | — |
| `venue` | FD match detail | — | — |
| `referee` | FD match detail | — | — |
| `source` | set by `buildCanonicalMatch()` | — | — |
| `lastUpdated` | max(FD lastUpdated, snapshot enrichedAt) | FD | — |
| `enrichmentApplied` | set by `buildCanonicalMatch()` | — | — |

---

## 3. The Interface

```typescript
/**
 * DATA-18A: Real CanonicalMatch interface.
 *
 * Represents a WC match that has passed through the full authority stack:
 *   FD bulk feeds (identity + status + score)
 *   + live cache overlay (IN_PLAY/PAUSED + minute)
 *   + per-match snapshot (ESPN-enriched goals/cards/subs/lineups)
 *
 * Structural contract:
 *   - FD always owns identity (fdMatchId, teams, utcDate, competitionCode).
 *   - ESPN never owns score (score comes from FD results feed).
 *   - Snapshot never downgrades a FINISHED match (forward-only state promotion).
 *   - `state` is the classified display bucket, not the raw FD status string.
 *   - `enrichmentApplied` true iff goals/cards/subs/lineups came from a provider.
 */
export interface CanonicalMatch {
  // ── Identity (FD authority) ────────────────────────────────────────────────
  /** FD match ID — primary key across the entire system. */
  id: number;

  /** Explicit alias of `id` — makes the FD provenance clear at call sites. */
  fdMatchId: number;

  /** ESPN event ID, resolved lazily via espn:lookup:{fdId}. Absent until resolved. */
  espnMatchId?: string;

  /** FD competition code, always 'WC' for World Cup matches. */
  competitionCode: string;

  /** ISO-8601 UTC kickoff datetime as provided by FD. */
  utcDate: string;

  // ── Match state ────────────────────────────────────────────────────────────
  /**
   * Semantic match state — the output of classifyMatchState() applied to the
   * merged FD status + live-cache + snapshot overlay.
   *
   * 'scheduled' = SCHEDULED or TIMED, kickoff in the future
   * 'live'      = IN_PLAY or PAUSED
   * 'finished'  = FINISHED
   * 'cancelled' = POSTPONED, CANCELLED, or SUSPENDED
   */
  state: 'scheduled' | 'live' | 'finished' | 'cancelled';

  /** Live clock minute. Present during IN_PLAY/PAUSED; absent otherwise. */
  minute?: number;

  // ── Teams (FD authority) ───────────────────────────────────────────────────
  homeTeam: CanonicalTeam;
  awayTeam: CanonicalTeam;

  // ── Score (FD results feed authority) ─────────────────────────────────────
  /**
   * Score as of the most recent FD results feed or snapshot.
   * ESPN never provides score — this field always comes from FD.
   */
  score: CanonicalScore;

  // ── Match events (ESPN enrichment authority for WC 2026) ───────────────────
  /**
   * Goal events. Empty array if match not yet enriched (enrichmentApplied=false)
   * or enrichment found no goals (genuinely 0-0 or data absent).
   * Team references use FD team IDs (reconciled from ESPN team IDs per DATA-14A).
   */
  goals: CanonicalGoal[];

  /**
   * Booking (card) events. Empty array pre-enrichment.
   * Team references use FD team IDs.
   */
  cards: CanonicalCard[];

  /** Substitution events. Empty array pre-enrichment. */
  substitutions: CanonicalSubstitution[];

  /** Starting lineups. Null if not available from enrichment. */
  lineups: CanonicalLineups | null;

  // ── Venue & officials ──────────────────────────────────────────────────────
  /** Venue name. Source: FD match detail. May be null for group-stage fixtures. */
  venue: string | null;

  /** Match referee(s). Source: FD match detail. May be null. */
  referee: CanonicalReferee | null;

  // ── Provenance ─────────────────────────────────────────────────────────────
  /**
   * Which data layers contributed to this canonical object.
   * Built by buildCanonicalMatch() — never mutated after construction.
   */
  source: CanonicalMatchSource;

  /**
   * ISO-8601 timestamp of the most recent data update across all contributing layers.
   * max(fdLastUpdated, snapshotEnrichedAt).
   */
  lastUpdated: string;

  /**
   * True iff at least one of goals/cards/substitutions/lineups came from a provider
   * enrichment pass (ESPN or AF). False for pre-enrichment or unenriched matches.
   */
  enrichmentApplied: boolean;

  // ── Tournament context ─────────────────────────────────────────────────────
  /** FD matchday number within the tournament. Null for knockout rounds. */
  matchday: number | null;

  /** FD stage string: 'GROUP_STAGE' | 'LAST_32' | 'LAST_16' | 'QUARTER_FINALS' | etc. */
  stage: string;

  /** FD group name: 'GROUP_A' … 'GROUP_L'. Null for knockout rounds. */
  group: string | null;
}
```

---

## 4. Supporting Types

```typescript
/** FD-authoritative team identity with provider IDs for reconciliation. */
export interface CanonicalTeam {
  /** FD team ID — primary key; used for event reconciliation (DATA-14A). */
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

export interface CanonicalScore {
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
  duration: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT';
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
}

export interface CanonicalGoal {
  minute: number;
  injuryTime: number | null;
  type: string;
  /** FD team ID (reconciled from ESPN team ID via applyEspnEvents — DATA-14A). */
  team: CanonicalTeam;
  scorer: { id: number; name: string };
  assist: { id: number; name: string } | null;
}

export interface CanonicalCard {
  minute: number;
  team: CanonicalTeam;
  player: { id: number; name: string };
  card: 'YELLOW' | 'RED' | 'YELLOW_RED';
}

export interface CanonicalSubstitution {
  minute: number;
  team: CanonicalTeam;
  playerOut: { id: number; name: string };
  playerIn: { id: number; name: string };
}

export interface CanonicalLineupPlayer {
  id: number;
  name: string;
  position: string | null;
  jersey: string | null;
  starter: boolean;
  formationPlace: number | null;
  subbedIn: boolean;
  subbedOut: boolean;
}

export interface CanonicalLineups {
  home: { team: CanonicalTeam; players: CanonicalLineupPlayer[] };
  away: { team: CanonicalTeam; players: CanonicalLineupPlayer[] };
}

export interface CanonicalReferee {
  id: number;
  name: string;
  nationality: string | null;
}

/**
 * Provenance record — which data layers were available when
 * buildCanonicalMatch() ran. Immutable after construction.
 */
export interface CanonicalMatchSource {
  /** Always present — FD is the fixture authority. */
  fdBulkFeed: 'scheduled' | 'results' | 'all';

  /** Present if the live cache contained an entry for this match ID. */
  liveCache?: { observedAt: string };

  /**
   * Present if a per-match snapshot existed in KV at build time.
   * snapshotVersion tracks the snapshot schema version for compatibility.
   */
  snapshot?: {
    enrichedAt: string;
    enrichmentSource: 'espn' | 'af' | 'none';
    snapshotVersion: number;
  };

  /** The ISO-8601 timestamp when buildCanonicalMatch() ran. */
  builtAt: string;
}
```

---

## 5. Mapping from Existing Types

| `CanonicalMatch` field | Sourced from `Match` / `MatchDetail` / `MatchSnapshot` |
|-----------------------|--------------------------------------------------------|
| `id` | `Match.id` |
| `fdMatchId` | `Match.id` (explicit copy) |
| `espnMatchId` | `MatchSnapshot.espnMatchId` |
| `competitionCode` | `Match.competition.code` |
| `utcDate` | `Match.utcDate` |
| `state` | derived via `classifyMatchState(match, todayUTC)` |
| `minute` | `Match.minute` (live cache overlay) |
| `homeTeam` / `awayTeam` | `Match.homeTeam` / `Match.awayTeam` |
| `score` | `Match.score` |
| `goals` | `MatchDetail.goals` (from snapshot after enrichment) |
| `cards` | `MatchDetail.bookings` (from snapshot) |
| `substitutions` | `MatchDetail.substitutions` (from snapshot) |
| `lineups` | `MatchDetail.lineups` (from snapshot) |
| `venue` | `MatchDetail.venue` (from snapshot) |
| `referee` | `MatchDetail.referees[0]` (from snapshot) |
| `lastUpdated` | max(`Match.lastUpdated`, `MatchSnapshot.enrichedAt`) |
| `enrichmentApplied` | `goals.length > 0 \|\| cards.length > 0 \|\| substitutions.length > 0` |
| `matchday` | `Match.matchday` |
| `stage` | `Match.stage` |
| `group` | `Match.group` |

---

## 6. Invariants

1. **FD identity is immutable.** `fdMatchId`, `competitionCode`, `utcDate`, `homeTeam.id`, `awayTeam.id` never come from ESPN or AF.
2. **Score is FD-only.** `score.fullTime` is never overwritten by ESPN events.
3. **State is forward-only.** `buildCanonicalMatch()` never produces `state='scheduled'` if the snapshot says FINISHED.
4. **Event team IDs are reconciled.** All `goals[].team.id`, `cards[].team.id`, `substitutions[].team.id` are FD team IDs — the ESPN→FD reconciliation from DATA-14A is applied before populating these fields.
5. **`enrichmentApplied` is honest.** It is `false` for a 0-0 match that was enriched but genuinely had no events.
