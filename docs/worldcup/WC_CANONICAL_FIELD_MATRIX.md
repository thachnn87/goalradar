# WC_CANONICAL_FIELD_MATRIX.md — DATA-18WC.9C Phase 1

**Date:** 2026-06-24
**Method:** Full source read of types.ts, canonical-match.ts, all providers, all cache layers, all consumer pages

---

## 1. FIELD OWNERSHIP DEFINITIONS

- **Primary owner**: Provider whose value is used when no other source has fresher data
- **Secondary owner**: Provider whose value overrides the primary under specific conditions
- **Enrichment**: Provider that adds fields not present in the primary response
- **Cache writer**: Which layer persists the value to KV
- **Snapshot writer**: Which path writes the per-match `goalradar:match:{id}` key
- **Authority writer**: Whether `goalradar:wc:authority:v1` includes this field

---

## 2. MATCH IDENTITY FIELDS

### `id` (Match.id)
| Attribute | Value |
|-----------|-------|
| Type | `number` |
| Primary owner | football-data.org (FD) |
| Secondary owner | api-football (different ID space — requires `af-id-map.ts` translation) |
| Enrichment | ESPN (uses its own `espnMatchId`, separate field) |
| Cache writer | kv-cache.ts (inside KVEntry<MatchDetail>) |
| Snapshot writer | match-snapshot.ts (writeKVSnapshot key = `goalradar:match:{id}`) |
| Authority writer | Yes — CanonicalMatch.id = fdMatch.id |
| Consumer pages | ALL pages — routing, React keys, link generation |
| Normalization | None — FD integer ID passed through directly |
| Poison risk | LOW — numeric ID is unlikely to drift across providers |

### `utcDate` (Match.utcDate)
| Attribute | Value |
|-----------|-------|
| Type | `string` (ISO 8601) |
| Primary owner | FD |
| Secondary owner | api-football (different timezone handling possible) |
| Enrichment | None |
| Cache writer | kv-cache.ts |
| Snapshot writer | match-snapshot.ts |
| Authority writer | Yes — CanonicalMatch.utcDate = fdMatch.utcDate |
| Consumer pages | All pages — display, sort, date grouping, kickoff countdown |
| Normalization | None — raw string from FD |
| Poison risk | MEDIUM — FD sometimes shifts kickoff times; api-football failover may have different UTC offset |

### `competition.code` (Match.competition.code)
| Attribute | Value |
|-----------|-------|
| Type | `string` (e.g., `'WC'`, `'PL'`) |
| Primary owner | FD |
| Secondary owner | api-football (mapped via COMPETITION_MAP, `normaliseCompetition()`) |
| Enrichment | None |
| Cache writer | kv-cache.ts |
| Snapshot writer | match-snapshot.ts |
| Authority writer | Yes — CanonicalMatch.competitionCode |
| Consumer pages | match page (`competition?.code === 'WC'`), WC hub routing |
| Normalization | api-football: `Object.keys(COMPETITION_MAP).find(k => COMPETITION_MAP[k].leagueId === league.id)` |
| Poison risk | LOW |

---

## 3. STATUS & STATE FIELDS

### `status` (Match.status)
| Attribute | Value |
|-----------|-------|
| Type | `MatchStatus` (8-value union) |
| Primary owner | FD — raw JSON cast, NO normalization |
| Secondary owner | api-football — STATUS_MAP normalization, 13 codes |
| Enrichment | ESPN — NEVER modifies status |
| Cache writer | kv-cache.ts (inside Match/MatchDetail) + live-cache.ts (inside `{ matches }`) |
| Snapshot writer | match-snapshot.ts — `writeKVSnapshot` guard: `if (isLiveStatus(status)) return` |
| Authority writer | Yes — buildCanonicalMatch resolves via STATE_RANK; canonical state derived from resolved status |
| Consumer pages | ALL pages — routing, badge display, metadata title, classify bucket, TTL tier |
| Normalization | **FD: NONE. AF: STATUS_MAP. Gap: `"LIVE"`, `"AWARDED"` from FD pass through raw** |
| Poison risk | **CRITICAL — confirmed production incident (match 537412 status="LIVE")** |

### `state` (CanonicalMatch.state — derived)
| Attribute | Value |
|-----------|-------|
| Type | `'scheduled' \| 'live' \| 'finished' \| 'cancelled'` |
| Derived from | `deriveState(resolvedStatus)` in canonical-match.ts |
| Owner | canonical-match.ts (derived, not stored in base Match) |
| Cache writer | authority-cache.ts (stored inside CanonicalMatch in authority envelope) |
| Consumer pages | WC hub, fixtures, schedule — classifyMatchState() checks `match.state` first |
| Normalization | Derived deterministically from resolved status — inherits any status poison |
| Poison risk | **CRITICAL — if status="LIVE" arrives, deriveState("LIVE") falls to default `'cancelled'` (wrong)** |

### `minute` (Match.minute — optional)
| Attribute | Value |
|-----------|-------|
| Type | `number \| null \| undefined` |
| Primary owner | FD (present in in-play responses) |
| Secondary owner | api-football (not directly mapped) |
| Live source | live-cache.ts — `LiveEntry.minute` |
| Cache writer | kv-cache.ts (inside Match), live-cache.ts (inside Match[]) |
| Snapshot writer | match-snapshot.ts |
| Authority writer | Yes — CanonicalMatch.minute from resolved live entry |
| Consumer pages | match page (live clock display), WC hub |
| Normalization | None |
| Poison risk | LOW — display-only, doesn't affect routing |

---

## 4. SCORE FIELDS

### `score.fullTime.home` / `score.fullTime.away`
| Attribute | Value |
|-----------|-------|
| Type | `number \| null` |
| Primary owner | FD results feed |
| Secondary owner | Snapshot (if newer than FD `lastUpdated`) |
| Score resolution | canonical-match.ts Step 3: snapshot score used only if FINISHED + snapshot newer + non-null |
| Enrichment | ESPN — NEVER provides score |
| Cache writer | kv-cache.ts |
| Snapshot writer | match-snapshot.ts |
| Authority writer | Yes — CanonicalMatch.score |
| Consumer pages | match page (score display), WC hub (result rows), fixtures page |
| Normalization | None — FD integer values |
| Poison risk | MEDIUM — score-drift was a proven issue (DATA-18WC.7B); guard exists in buildCanonicalMatch |

### `score.halfTime.home` / `score.halfTime.away`
| Attribute | Value |
|-----------|-------|
| Primary owner | FD |
| Consumer pages | match page only |
| Poison risk | LOW — display-only, no routing decisions |

### `score.winner`
| Attribute | Value |
|-----------|-------|
| Type | `'HOME_TEAM' \| 'AWAY_TEAM' \| 'DRAW' \| null` |
| Primary owner | FD |
| Consumer pages | match page (winner styling), WC hub result rows |
| Normalization | None |
| Poison risk | LOW |

### `score.duration`
| Attribute | Value |
|-----------|-------|
| Type | `'REGULAR' \| 'EXTRA_TIME' \| 'PENALTY_SHOOTOUT'` |
| Primary owner | FD |
| Consumer pages | match page ("AET", "Penalties" label) |
| Poison risk | LOW |

---

## 5. TEAM FIELDS

### `homeTeam` / `awayTeam` (Team)
| Attribute | Value |
|-----------|-------|
| Fields | `id, name, shortName, tla, crest` |
| Primary owner | FD (comment: "FD-authoritative team record") |
| Secondary owner | api-football — `normaliseTeam()` builds synthetic shortName/tla from name |
| Enrichment | None |
| Cache writer | kv-cache.ts (inside Match) |
| Snapshot writer | match-snapshot.ts |
| Authority writer | Yes — CanonicalMatch.homeTeam/awayTeam |
| Consumer pages | ALL pages — team name, crest image, team page link |
| Normalization | FD: none. AF: shortName = name (no separate shortName in AF), tla = name.slice(0,3).toUpperCase() |
| Poison risk | MEDIUM — AF failover produces synthetic shortName/tla; crest URLs differ between providers |

---

## 6. STAGE & TOURNAMENT CONTEXT FIELDS

### `stage` (Match.stage)
| Attribute | Value |
|-----------|-------|
| Type | `string` (e.g., `'GROUP_STAGE'`, `'LAST_32'`, `'QUARTER_FINALS'`) |
| Primary owner | FD |
| Secondary owner | api-football — `parseRound()` maps league round string to stage |
| Cache writer | kv-cache.ts |
| Snapshot writer | match-snapshot.ts |
| Authority writer | Yes — CanonicalMatch.stage = fdMatch.stage |
| Consumer pages | fixtures page (stage grouping), bracket |
| Normalization | FD: none. AF: parseRound() maps "Round of 32" → `'LAST_32'`, etc. |
| Poison risk | MEDIUM — AF parseRound() uses string matching; unexpected round formats produce raw string |

### `group` (Match.group)
| Attribute | Value |
|-----------|-------|
| Type | `string \| null` (e.g., `'GROUP_A'`) |
| Primary owner | FD |
| Secondary owner | api-football — `parseRound()` extracts group letter |
| Cache writer | kv-cache.ts |
| Snapshot writer | match-snapshot.ts |
| Authority writer | Yes — CanonicalMatch.group = fdMatch.group |
| Consumer pages | match page (breadcrumbs, group table), WC hub (group filter) |
| Normalization | AF: parseRound() produces `'GROUP_A'` format from "Group Stage - 1" strings |
| Poison risk | MEDIUM — if group string format differs between providers, group page routing breaks |

### `matchday` (Match.matchday)
| Attribute | Value |
|-----------|-------|
| Type | `number \| null` |
| Primary owner | FD |
| Secondary owner | api-football — `parseRound()` extracts matchday number |
| Cache writer | kv-cache.ts |
| Authority writer | Yes — CanonicalMatch.matchday = fdMatch.matchday |
| Consumer pages | match page (display), metadata |
| Poison risk | LOW |

---

## 7. EVENT FIELDS (MatchDetail only)

### `goals` (MatchDetail.goals)
| Attribute | Value |
|-----------|-------|
| Type | `Goal[]` |
| Primary owner | ESPN enrichment (via espn-id-map.ts) |
| Secondary owner | api-football (via af-id-map.ts, when ENABLE_AF_ENRICHMENT=true) |
| Prewarm default | `[]` (toMatchDetail() in worldcup.ts sets goals=[]) |
| Cache writer | match-snapshot.ts (writeKVSnapshot) — inside MatchDetail within MatchSnapshot |
| Snapshot writer | match-snapshot.ts |
| Authority writer | Yes — CanonicalMatch.goals = snapshot.match.goals ?? [] |
| Consumer pages | match page (goal timeline, scorer list, metadata description) |
| Normalization | ESPN parser: minute normalization (cumulative vs per-half), injuryTime=null always |
| Poison risk | MEDIUM — team ID reconciliation guard (C2_TEAM_ID) catches mismatches; ESPN team IDs vs FD team IDs |

### `bookings` (MatchDetail.bookings)
| Attribute | Value |
|-----------|-------|
| Type | `Booking[]` |
| Primary owner | ESPN enrichment |
| Secondary owner | api-football enrichment |
| Prewarm default | `[]` |
| Cache writer | match-snapshot.ts |
| Authority writer | Yes — CanonicalMatch.cards = snapshot.match.bookings ?? [] |
| Consumer pages | match page (card timeline) |
| Normalization | ESPN: type.id mapping (94→YELLOW, 95→RED, 96→YELLOW_RED) |
| Poison risk | LOW — display-only |

### `substitutions` (MatchDetail.substitutions)
| Attribute | Value |
|-----------|-------|
| Type | `Substitution[]` |
| Primary owner | ESPN enrichment |
| Secondary owner | api-football enrichment |
| Prewarm default | `[]` |
| Cache writer | match-snapshot.ts |
| Authority writer | Yes — CanonicalMatch.substitutions |
| Consumer pages | match page (subs timeline) |
| Normalization | ESPN: participant ordering (index 0=playerIn, index 1=playerOut) |
| Poison risk | LOW |

### `lineups` (MatchDetail.lineups)
| Attribute | Value |
|-----------|-------|
| Type | `{ home: Lineup; away: Lineup } \| null \| undefined` |
| Primary owner | ESPN enrichment (`parseLineups()`) |
| Prewarm default | Not in Match; null unless ESPN provides it |
| Cache writer | match-snapshot.ts |
| Authority writer | **NO** — CanonicalMatch does NOT include lineups (intentionally excluded) |
| Consumer pages | match page only (lineup section) |
| Normalization | ESPN: rosters[0]=home, rosters[1]=away (positional assumption) |
| Poison risk | LOW — only match page, never affects routing |

---

## 8. VENUE & OFFICIALS FIELDS

### `venue` (MatchDetail.venue)
| Attribute | Value |
|-----------|-------|
| Type | `string \| null` |
| Primary owner | FD (per-match detail only — NOT in bulk feeds) |
| Prewarm default | `null` (toMatchDetail() sets venue=null) |
| Cache writer | match-snapshot.ts |
| Authority writer | Yes — CanonicalMatch.venue = matchDetail?.venue ?? null |
| Consumer pages | match page, metadata |
| Normalization | None |
| Poison risk | LOW — display-only |

### `referees` (MatchDetail.referees)
| Attribute | Value |
|-----------|-------|
| Type | `Referee[]` |
| Primary owner | FD (per-match detail only) |
| Prewarm default | `[]` (toMatchDetail() sets referees=[]) |
| Cache writer | match-snapshot.ts |
| Authority writer | Yes — CanonicalMatch.referee = first referee in array |
| Consumer pages | match page (referee display) |
| Normalization | None |
| Poison risk | LOW |

### `attendance`
| Attribute | Value |
|-----------|-------|
| Status | **NOT IMPLEMENTED** — not in Match or MatchDetail types |
| Note | FD v4 does not return attendance in the match response |

---

## 9. FORMATION FIELDS

### `formations`
| Attribute | Value |
|-----------|-------|
| Status | **NOT IMPLEMENTED** — not in Match or MatchDetail types |
| Note | Formation data is available in ESPN lineup response but not extracted |

---

## 10. LASTUPDATE / TIMESTAMP FIELDS

### `lastUpdated` (Match.lastUpdated)
| Attribute | Value |
|-----------|-------|
| Type | `string` (ISO 8601) |
| Primary owner | FD |
| Authority writer | CanonicalMatch.lastUpdated = max(fdMatch.lastUpdated, snapshot.generatedAt) |
| Consumer pages | match page (JSON-LD `dateModified`) |
| Normalization | None |
| Poison risk | LOW |

---

## 11. FIELD OWNERSHIP SUMMARY TABLE

| Field | FD | AF | ESPN | Authority | Snapshot | Live Cache | Consumer Pages |
|-------|----|----|------|-----------|----------|-----------|---------------|
| id | ✅ PRIMARY | ✅ SECONDARY | ❌ | ✅ | ✅ | ✅ | ALL |
| utcDate | ✅ PRIMARY | ✅ SECONDARY | ❌ | ✅ | ✅ | ✅ | ALL |
| **status** | ✅ PRIMARY (unguarded) | ✅ SECONDARY (STATUS_MAP) | ❌ | ✅ | ✅ (guarded) | ❌ | ALL |
| score.fullTime | ✅ PRIMARY | ✅ SECONDARY | ❌ | ✅ | ✅ | ❌ | ALL |
| score.winner | ✅ PRIMARY | ✅ SECONDARY | ❌ | ✅ | ✅ | ❌ | Match, Hub |
| homeTeam/awayTeam | ✅ PRIMARY | ✅ SECONDARY (synthetic) | ❌ | ✅ | ✅ | ✅ | ALL |
| stage | ✅ PRIMARY | ✅ SECONDARY (parseRound) | ❌ | ✅ | ✅ | ❌ | Fixtures, Bracket |
| group | ✅ PRIMARY | ✅ SECONDARY (parseRound) | ❌ | ✅ | ✅ | ❌ | Match, Hub |
| matchday | ✅ PRIMARY | ✅ SECONDARY | ❌ | ✅ | ✅ | ❌ | Match |
| goals | ❌ | ❌ SECONDARY (af-enrichment) | ✅ PRIMARY | ✅ | ✅ | ❌ | Match |
| bookings | ❌ | ❌ SECONDARY | ✅ PRIMARY | ✅ | ✅ | ❌ | Match |
| substitutions | ❌ | ❌ SECONDARY | ✅ PRIMARY | ✅ | ✅ | ❌ | Match |
| lineups | ❌ | ❌ | ✅ PRIMARY | ❌ NOT IN AUTHORITY | ✅ | ❌ | Match only |
| venue | ✅ PRIMARY (detail only) | ❌ | ❌ | ✅ | ✅ | ❌ | Match |
| referees | ✅ PRIMARY (detail only) | ❌ | ❌ | ✅ | ✅ | ❌ | Match |
| minute | ✅ (FD live) | ❌ | ❌ | ✅ (from live cache) | ✅ | ✅ | Match, Hub |
| competition.code | ✅ PRIMARY | ✅ SECONDARY | ❌ | ✅ | ✅ | ✅ | ALL |
| attendance | ❌ NOT PRESENT | ❌ | ❌ | ❌ | ❌ | ❌ | — |
| formations | ❌ NOT PRESENT | ❌ | partial | ❌ | ❌ | ❌ | — |
