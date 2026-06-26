# PRODUCTION_CAPABILITY — DATA-18WC.PHASE0

**Date:** 2026-06-26
**Status:** VERIFIED from source code ✅

---

## What This Document Covers

Verified data flow from provider → cache → authority → page for each field category. No live production API calls were made during this audit. All findings are based on source code, KV key patterns, and architecture tracing.

---

## Match Score + Status

**Flow:** FD bulk feed → authority:v1 → listing pages
**Flow:** FD getMatch → KV detail → snapshot → match page

| Check | Result | Notes |
|---|---|---|
| FD provides score.fullTime | ✅ Present | High reliability |
| Authority:v1 preserves score | ✅ Present | FD score restored after enrichment |
| Score drift guard | ✅ Present | Rebuilds snapshot if mismatch detected |
| Live score overlay | ✅ Present | goalradar:live:matches overlaid onto authority |
| Fallback (API fail) | ✅ DR snapshot | 30-day TTL |

**Verdict:** PRODUCTION READY — redundant coverage with self-healing.

---

## Match Events (Goals / Cards / Subs)

**Flow (WC FINISHED):** FD getMatch → AF enrichment (primary) → ESPN enrichment (fallback) → snapshot → match page
**Flow (League FINISHED):** FD getMatch → snapshot → match page

| Check | Result | Notes |
|---|---|---|
| WC FINISHED matches enriched | ✅ Three-layer coverage | FD → AF → ESPN fallback chain |
| Unenriched snapshot guard | ✅ Present | Detects goals=0, score>0; triggers rebuild |
| League match events | ✅ FD primary only | No enrichment needed |
| Assist data | ⚠️ Frequently null | Not a data quality issue; often genuinely absent |
| Lineups | ⚠️ Partial | FD occasionally; ESPN for FINISHED WC |

**Verdict:** PRODUCTION READY for goals/cards/subs. Lineups are partial but functional.

---

## Standings

**Flow:** FD getStandings → KV (6h TTL) → group pages, standings page, qualification engine

| Check | Result | Notes |
|---|---|---|
| FD WC standings | ✅ Available | 12 groups, full StandingTable[] |
| FD league standings | ✅ Available | PL, PD, BL1, SA, FL1, CL |
| KV TTL | ✅ 6h WC / 1h league | Fresh enough for group stage |
| Fallback (KV miss) | ✅ Static skeleton | groups.json + teams.json |
| Qualification engine input | ✅ StandingTable[] | Engine runs on each standings read |

**Verdict:** PRODUCTION READY.

---

## Knockout Bracket

**Flow:** authority:v1 → knockout-vm.ts → bracket pages, round pages

| Check | Result | Notes |
|---|---|---|
| All 104 WC matches in authority | ✅ Present | Built from FD + authority:v1 |
| Knockout stage filtering | ✅ Present | knockout-vm.ts filters by stage |
| TBD slot labels | ✅ Present | "1st Group A" injected when team.id=0 |
| TBD rebuild | ✅ Present | 5-min TTL + rebuild lock for team resolution |
| Bracket post group stage | ✅ Present | Standings feed into labelToTeam() |

**Verdict:** PRODUCTION READY.

---

## Team Pages

**Flow:** FD getTeam → KV (6h TTL) → team page
**Flow:** wc-all-teams.ts → WC team pages (static)

| Check | Result | Notes |
|---|---|---|
| FD TeamDetail (name, coach, squad) | ✅ Available | 6h KV cache |
| Team recent matches | ✅ Available | getTeamMatches() last 10 |
| WC qualification card | ✅ Present | runningCompetitions check → qualification engine |
| Static WC team data (48 teams) | ✅ Present | wc-all-teams.ts covers all 48 |
| Featured team pages (6) | ✅ Present | Rich content in wc-teams.ts |
| Non-featured team pages (42) | ✅ Present | Minimal content from wc-all-teams.ts |
| FIFA rankings | ⚠️ Static only | Hardcoded at tournament start; not live |
| Team photo / crest | ✅ FD crest URL | CDN-hosted by FD |

**Verdict:** PRODUCTION READY. FIFA rankings are static (acceptable for WC 2026 duration).

---

## Head-to-Head

**Flow:** FD getHeadToHead → KV snapshot → match page deferred section

| Check | Result | Notes |
|---|---|---|
| H2H data available | ✅ Present | FD endpoint only |
| API-Football H2H | ❌ Not implemented | Throws NotFoundError |
| H2H in snapshot | ✅ Present | headToHead field in MatchSnapshot |
| H2H render | ✅ Present | HeadToHeadDeferred Suspense in match page |

**Verdict:** PRODUCTION READY (single provider dependency on FD).

---

## Venue Pages

**Flow:** wc-venues.ts → static render → venue pages

| Check | Result | Notes |
|---|---|---|
| All 16 venues documented | ✅ Present | Full VenueData per venue |
| Capacity, city, country | ✅ Present | Static |
| Transport options | ✅ Present | VenueTransport[] per venue |
| FAQ content | ✅ Present | VenueFaq[] per venue |
| Nearest airport | ✅ Present | nearestAirport, distanceFromCity |
| Match schedule | ✅ Present | VenueMatchInfo[] per venue |
| Stadium photos | ❌ Not present | No photo assets |

**Verdict:** PRODUCTION READY for text content. Photos would enhance but are not a blocker.

---

## Match Page (Full)

| Section | Data source | Status | Notes |
|---|---|---|---|
| Hero score | Snapshot / live cache | ✅ | Live overlay active |
| Goals section | Snapshot.match.goals | ✅ | Enriched for WC |
| Cards section | Snapshot.match.bookings | ✅ | Enriched for WC |
| Subs section | Snapshot.match.substitutions | ✅ | Enriched for WC |
| Lineups section | Snapshot.match.lineups | ⚠️ | Partial availability |
| Match report (narrative) | Story Engine | ✅ | WC/League/Group templates |
| H2H section | Snapshot.headToHead | ✅ | FD only |
| Group standings | Snapshot.standings | ✅ | For WC group matches |
| WC group matches | Snapshot.wcGroupMatches | ✅ | Group context |
| FAQs | buildFaqs() | ✅ | 5–8 Q&A per match |
| JSON-LD (SportsEvent) | JsonLd component | ✅ | All matches |
| JSON-LD (Article) | MatchReport component | ✅ | All matches |
| JSON-LD (FAQPage) | MatchFaqJsonLd | ✅ | All matches |
| Referees | Snapshot.match.referees | ✅ | FD only |
| Venue | Snapshot.match.venue | ✅ | Name only |

**Verdict:** PRODUCTION READY for all core sections. Lineups partial (cosmetic only).

---

## Known Production Risks

| Risk | Severity | Detection | Mitigation |
|---|---|---|---|
| FD rate limit (10 req/min) | High | 429 in logs | Rate-safe mode + AF failover |
| WC enrichment fails (AF+ESPN both miss) | Medium | goals=0 on FINISHED scored match | Self-heal guard (repair-lock) |
| Authority:v1 stale during concurrent group matches | Medium | Bracket shows wrong teams | 5-min TTL + 1-min cron |
| H2H absent (FD times out) | Low | null in snapshot | Graceful null → no H2H section |
| Static WC data outdated (team swap) | Medium | Wrong team in group | Manual update required |
| AF IDs mismatched for WC match | Low | No enrichment | ESPN fallback covers it |
| Score drift after enrichment | Low | Score mismatch logged | Score drift guard rebuilds |
