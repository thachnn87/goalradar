# Programmatic SEO Plan — GROWTH-1
## GoalRadar · Sprint GROWTH-1 · Audit Only (no implementation)

Generated: 2026-06-10 — **one day before kickoff (June 11, 2026)**.
The pre-tournament window is effectively closed; prioritization below weights
pages that capture **during-tournament** search demand, which dwarfs
pre-tournament volume anyway.

---

## Phase 1 — Keyword Mapping: Existing Coverage vs Gaps

### Already covered (existing routes)

| Intent cluster | Route(s) | Status |
|----------------|----------|--------|
| schedule / fixtures | `/world-cup-2026-schedule`, `/world-cup-2026/fixtures`, `/schedule` | ✅ |
| results / scores | `/world-cup-2026-results`, `/world-cup-2026/matches` | ✅ |
| standings / table | `/world-cup-2026-standings`, `/standings` | ✅ |
| groups | `/world-cup-2026-groups`, `/world-cup-2026/groups`, `/world-cup-2026/group-{a–l}` (12) | ✅ |
| bracket / knockout overview | `/world-cup-2026-bracket`, `/world-cup-2026/bracket` | ✅ |
| predictions hub | `/world-cup-2026-predictions`, `/world-cup-2026/predictions` | ✅ |
| winner prediction | `/world-cup-2026/winner-predictions` | ✅ |
| golden boot prediction | `/world-cup-2026/golden-boot-predictions` | ✅ |
| group predictions | `/world-cup-2026/group-{a–h}-predictions` (8) | ✅ |
| per-match prediction | `/predict/{id}-{home}-vs-{away}` (~104 WC + league) | ✅ |
| per-match detail | `/match/{id}-{home}-vs-{away}` (~400–600 incl. leagues) | ✅ |
| "X vs Y live score" | `/{home}-vs-{away}-live-score` alias → 308 to match page (72) | ✅ |
| WC team pages | `/world-cup-2026/teams/{slug}` (48) + featured nations (7) | ✅ |
| watch live / streaming | `/world-cup-2026-live-stream`, `/watch-live` + 9 country pages, `/streaming-guide` | ✅ |
| TV guide | `/world-cup-2026-tv-guide`, `/tv-schedule` + 34 country pages | ✅ |
| venues / stadiums | `/world-cup-2026/venues` + 16 venue pages, `/host-cities` | ✅ |
| today / tomorrow | `/world-cup-2026/matches-today`, `/matches-tomorrow` | ✅ |
| league teams | `/teams/{id}-{slug}` (~100–150 from standings) | ✅ |

Current indexable surface: **~330 WC URLs + ~600 league/match URLs**.

### Missing high-intent pages (the gaps)

| # | Intent cluster | Example queries | Gap |
|---|---------------|-----------------|-----|
| G1 | **Match prediction aliases** | "usa vs paraguay prediction", "england vs croatia prediction" | `/predict/{id}` exists but is not reachable by the natural query slug. The `-live-score` alias pattern proves the model; no `-prediction` equivalent exists. |
| G2 | **Knockout round pages** | "world cup 2026 final", "world cup final date", "round of 32 world cup", "quarter finals schedule" | Only an all-in-one bracket page. "World Cup final" alone is one of the highest-volume queries of the entire tournament. |
| G3 | **Top scorers (live tracker)** | "world cup top scorers", "world cup 2026 golden boot standings", "who has scored the most goals" | Only a *prediction* page exists. The live stats race during the tournament is a different, much larger query. **No scorers API support in `api.ts` yet** (football-data.org exposes `/competitions/WC/scorers`). |
| G4 | **Date pages** | "world cup matches june 15", "world cup games saturday" | Only today/tomorrow exist. 39 match days in the tournament. |
| G5 | **Head-to-head pages** | "usa vs mexico head to head", "brazil vs argentina h2h record" | H2H data already fetched per match (`getHeadToHead`) but has no standalone landing page. |
| G6 | **"How to watch X vs Y"** | "how to watch usa vs paraguay", "what channel is england game on" | Country-level watch pages exist, but no per-match watch pages. |
| G7 | **Player pages** | "messi world cup 2026", "mbappe goals" | No player data source available. |
| G8 | **Tickets** | "world cup 2026 tickets", "final tickets price" | No page; affiliate potential. |

---

## Phase 2 — Programmatic Opportunities & Page Counts

| ID | Page type | URL pattern | Est. URL count | Data source |
|----|-----------|-------------|---------------|-------------|
| G1 | Prediction aliases | `/{home}-vs-{away}-prediction` → 308 to `/predict/{id}` | **72–104** (group stage at launch; knockouts as teams resolve) | Existing — clone of `[alias]` route, suffix `-prediction` |
| G2 | Knockout round pages | `/world-cup-2026/round-of-32`, `/round-of-16`, `/quarter-finals`, `/semi-finals`, `/third-place`, `/final` | **6** | Existing — `fetchAllWCMatches` filtered by `stage` |
| G3 | Top scorers tracker | `/world-cup-2026/top-scorers` (+ optional flat `/world-cup-2026-top-scorers`) | **1–2** | **NEW provider endpoint** `/competitions/WC/scorers` + KV seeding via orchestrator |
| G4 | Date pages | `/world-cup-2026/matches/{june-11 … july-19}` | **39** | Existing — `fetchAllWCMatches` grouped by date (same logic as results page) |
| G5 | H2H pages | `/h2h/{home}-vs-{away}` or `/world-cup-2026/{home}-vs-{away}-h2h` | **72–104** | Existing — `getHeadToHeadCached` (KV) keyed by fixture |
| G6 | Per-match watch pages | `/watch/{home}-vs-{away}` | 72–104 (×N countries = explosion if done wrong) | Existing TV/watch country data + match data; **keep to 1 page per match**, geo-sections within |
| G7 | Player pages | `/players/{slug}` | ~800 (26 × 48 squads) | ❌ No data source — not feasible |
| G8 | Tickets guide | `/world-cup-2026-tickets` | **1** | Editorial content only |

Total realistic new URL surface: **~190–260 pages**, nearly all generated from
data already in KV.

---

## Phase 3 — Internal Linking Plan

Existing link infrastructure to plug into (no new components needed):

| New page type | Linked FROM | Mechanism |
|---------------|------------|-----------|
| G1 prediction aliases | Not linked (alias pattern) — discovered via sitemap + canonical, like `-live-score` | sitemap/4 addition; `alternates.canonical` → `/predict/{id}` |
| G2 round pages | `WCPageNav` (every WC page), bracket page (per-round headings link out), hub page nav grid, match pages of that stage (`Breadcrumb`: Home → WC 2026 → Final) | `WCPageNav` + `WCRelatedLinks` props; sitemap/2 |
| G3 top scorers | `WCPageNav`, hub page, golden-boot-predictions page (natural sibling: "see the live race"), results page stats strip, team pages | `WCRelatedLinks`; sitemap/2 at high priority |
| G4 date pages | matches-today/tomorrow ("full calendar" prev/next-day links), schedule page (each day heading links to its page), results page date headings | Day-by-day prev/next chain = strong crawl path; sitemap/2 |
| G5 H2H pages | match page (H2H section header → "full head-to-head"), predict page, team pages | Existing H2H section already renders the data; add header link; sitemap/4 |
| G6 watch-match pages | match page ("how to watch" box), watch-live country pages, tv-schedule pages | sitemap/2 |
| G8 tickets | hub page, venue pages, footer | sitemap/1 |

All new pages reachable within **≤2 hops** of the homepage (hub → page), consistent
with the current crawl-depth profile.

---

## Phase 4 — Prioritization

Scoring: traffic potential (during-tournament search volume) ÷ implementation
cost, weighted by WC relevance window.

### HIGH

| ID | Page type | Traffic | Cost | Rationale |
|----|-----------|---------|------|-----------|
| G2 | **Knockout round pages (6)** | Very high | Very low | "World Cup final" is a top-5 tournament query; 6 static-ish pages reusing existing match data. Round pages peak sequentially June 28 → July 19 — they will rank if indexed in the next 1–2 weeks. |
| G1 | **Prediction aliases (~104)** | High | Very low | Direct clone of the proven `-live-score` alias route (1 file). "X vs Y prediction" is the highest-converting pre-match query, repeated 104 times. Each is a pure 308 + canonical — zero content cost, zero provider cost. |
| G4 | **Date pages (39)** | High | Low | Same grouping logic as the results page. "World cup matches june 15" repeats 39× and queries spike exactly the day before each date. Prev/next chain gives crawl coverage. |
| G3 | **Top scorers tracker (1)** | Very high | **Medium** | Only entry needing a new provider endpoint (`/competitions/WC/scorers`) + orchestrator KV seeding (must respect PERF-7 zero-provider-render rule: page reads KV only). Single page, but "world cup top scorers" sustains huge volume all 39 days. |

### MEDIUM

| ID | Page type | Traffic | Cost | Rationale |
|----|-----------|---------|------|-----------|
| G5 | H2H pages (~104) | Medium | Low–Medium | Data already in KV per fixture, but H2H queries are mostly for rivalry fixtures (maybe 20 of 104). Risk: thin content for first-meeting pairs (many WC debutants have zero shared history) → soft-404 risk. Gate: only generate when H2H has ≥3 prior meetings. |
| G8 | Tickets guide (1) | Medium | Low | One editorial page; monetizable via affiliates. Resale market keeps demand alive all tournament. Compliance review needed for affiliate disclosure. |
| G6 | Per-match watch pages (~104) | Medium | Medium | Real demand ("what channel is the usa game on") but overlaps existing TV/watch country pages — duplicate-content risk needs careful canonical design. One page per match with geo-sections; do NOT multiply by country. |

### LOW

| ID | Page type | Traffic | Cost | Rationale |
|----|-----------|---------|------|-----------|
| G7 | Player pages (~800) | High in theory | **Blocked** | No player/squad data source on football-data.org free tier. Would require a new provider. Revisit only if a data source materializes. |
| — | Flat group aliases (`/world-cup-2026-group-a`) | Low | Low | Duplicates existing `/world-cup-2026/group-a`; canonical dilution risk outweighs gain. **Do not build.** |
| — | City travel guides | Low | High | Out of scope for a scores site; weak topical authority. |

---

## Phase 5 — Recommended Rollout Order

| Order | Sprint | Pages | URLs | Complexity | Why this order |
|-------|--------|-------|------|-----------|----------------|
| 1 | GROWTH-2a | **G2 knockout round pages** | 6 | XS (1 template, stage filter) | Highest volume per page; needs indexing lead time before Round of 32 (June 28). Ship first. |
| 2 | GROWTH-2b | **G1 prediction aliases** | ~104 | XS (clone `[alias]` route) | Near-zero cost; every day before each match is captured demand. Sitemap/4 addition included. |
| 3 | GROWTH-2c | **G4 date pages** | 39 | S (date grouping + prev/next nav) | Demand spikes daily starting June 11; each day's page earns its traffic on its own date. |
| 4 | GROWTH-3 | **G3 top scorers** | 1–2 | M (new provider method + orchestrator seeding + KV-only page) | Highest sustained single-page volume; medium cost because it touches the provider layer — must follow PERF-6/7 patterns (cron-seeded KV, `readKVOnly` page). |
| 5 | GROWTH-4 | **G5 H2H pages** (gated ≥3 meetings) + **G8 tickets** | ~25 + 1 | S–M | After the core demand is captured; H2H needs thin-content gating; tickets needs affiliate/compliance review. |
| — | Deferred | G6 watch-match, G7 players | — | — | G6 pending duplicate-content design; G7 blocked on data. |

**Estimated total new indexable URLs from sprints 1–5: ~175.**

### Constraints carried forward from prior sprints (binding on implementation)

1. **Zero provider render** (PERF-7A): every new page must use `*Cached` /
   `readKVOnly` variants. G3 is the only one requiring new provider plumbing,
   and it must be cron-seeded, never request-path.
2. **Sitemap hygiene** (SITEMAP-3 / SEO-6): alias pages (G1) get
   `alternates.canonical` to their target and are listed in sitemap/4 only;
   no redirect sources in sitemaps; new static groups go in sitemap/2.
3. **No thin pages**: H2H gating; date pages must render a meaningful empty
   state for rest days (4 in the calendar).
4. `vercel.json` untouched; routing additions via app router + `next.config.ts`.
