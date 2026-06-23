# TEAM SOURCE MAP — DATA-18TEAM.1B Phase 1

**Task:** DATA-18TEAM.1B Production Team Cache Validation
**Date:** 2026-06-23
**Method:** code trace (read-only) + git HEAD vs working-tree comparison.

> **Critical framing:** this map distinguishes the **committed/deployed** code
> (what production actually runs) from the **working-tree** code (the uncommitted
> DATA-18TEAM.1 fix). They differ materially — see the ⚠️ rows.

---

## Layer-by-layer

| Layer | Component | KV key | TTL | Fallback | Reader | Writer |
|-------|-----------|--------|-----|----------|--------|--------|
| Route | `src/app/teams/[slug]/page.tsx` | — | — | `notFound()` / "Team Data Unavailable" card | parses `extractTeamId(slug)` → `getTeamCached(id)` | — |
| Reader (DEPLOYED) | `getTeamCached()` HEAD `api.ts:672` | `goalradar:/teams/{id}` | L1 1h | **none — `return data ?? null`** | `readKVOnly` | — |
| Reader (working tree) ⚠️ | `getTeamCached()` `api.ts:693` | `goalradar:/teams/{id}` | L1 1h, SWR | `withKVCache → providerManager.getTeam` (writes KV) | `readKVOnly` then provider | provider-on-miss |
| Provider | `providerManager.getTeam(id)` `providers/manager.ts:271` | — | live | FD → api-football failover | — | — |
| Provider impl | `FootballDataProvider.getTeam` `football-data.ts:224` | — | — | — | `GET /v4/teams/{id}` (`X-Auth-Token`) | — |
| Warming (DEPLOYED) | orchestrator HEAD | — | — | — | — | **none — no team phase exists** |
| Warming (working tree) ⚠️ | orchestrator Phase 4 `route.ts:221` | `goalradar:/teams/{id}` | `TEAM_FRESH` 6h / `TEAM_STALE` 24h | min-interval 6h, cap 25/run | — | `refreshEndpoint('/teams/{id}')` |
| Extract (working tree) ⚠️ | `extractTeamIdsFromStandings()` `refresh.ts:318` | reads `goalradar:/competitions/{code}/standings` | — | `[]` on miss | `kv.get` | — |
| Standings (DEPLOYED) | orchestrator `standings-{code}` task | `goalradar:/competitions/{code}/standings` | — | — | — | `refreshEndpoint` → `providerManager.getStandings` |

---

## KV key contract — write vs read (verified, MATCHES)

| Side | Expression | Result |
|------|-----------|--------|
| Write (working-tree warming) | `` `${KV_PREFIX}${endpoint}` `` = `` `goalradar:/teams/${id}` `` | `goalradar:/teams/762` |
| Read | `readKVOnly('/teams/'+id)` → `` `goalradar:${key}` `` | `goalradar:/teams/762` |

**No key mismatch.** **No id/slug mismatch** — both sides use the numeric
football-data id; slug is cosmetic (`extractTeamId` strips it). Routing works
(HTTP 200, renders the card). These are ruled out as causes.

---

## Standings shape (relevant to warming)

`extractTeamIdsFromStandings` reads `entry.data.standings[].table[].team.id`.
Stored shape = `providerManager.getStandings(code)` = `{ standings: StandingTable[] }`
where `StandingTable.table: StandingEntry[]` and `StandingEntry.team: Team{id}`
(`types.ts:72,76,83`). **Shape matches** — the extractor would work once deployed,
provided the WC standings KV entry is present (the orchestrator's `standings-wc`
task writes it).

---

## The deployed-vs-working-tree gap (the whole story)

| File | HEAD (deployed) | Working tree (uncommitted) |
|------|-----------------|----------------------------|
| `api.ts` `getTeamCached` | KV-read-only, null on miss | + provider fallback on miss |
| `api.ts` `getStandingsCached` | empty `[]` for WC on miss | + static-group merge/fallback |
| `refresh.ts` | no `extractTeamIdsFromStandings` | + `extractTeamIdsFromStandings()` |
| `orchestrator/route.ts` | no team phase | + Phase 4 team warming |

`git diff HEAD --stat`: 3 files, +126/−9, **uncommitted**. `wc-static-groups.ts`
(the new import) is already committed, so committing the 3 files is build-safe.

**Phase 1 complete.** The deployed read path has no writer for `goalradar:/teams/{id}`
and no self-heal; the writer + self-heal exist only in the uncommitted working tree.
