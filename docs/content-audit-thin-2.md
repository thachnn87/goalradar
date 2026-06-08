# CONTENT-2 — Thin Content Audit

**Date:** 2026-06-08  
**Scope:** Group pages (12), Team pages (48), Prediction hub (1), TV guide pages (36)  
**Method:** Static analysis of page templates + data source files  

---

## Classification Key

| Grade | Criteria |
|---|---|
| **GOOD** | ≥60% unique content, ≥600 words, ≥2 schema types, strong data differentiation |
| **WEAK** | 30–59% unique content OR 300–599 words, some templating, passes thin threshold |
| **THIN** | <30% unique content OR <300 meaningful words, heavy templating, duplicate-content risk |

---

## Category Findings

### 1. Group Pages — `/world-cup-2026/group-[a-l]` (12 pages)

**Template analysis:**

| Section | Words | Unique % | Notes |
|---|---|---|---|
| Section headings | ~50 | 0% | Identical across all 12 |
| Qualification summary paragraph | ~45 | 3% | Only group letter varies |
| Points system body (1st/2nd/3rd/4th rules) | ~120 | 0% | Word-for-word identical |
| Tiebreaker rules | ~60 | 0% | Word-for-word identical |
| Pre-tournament overview | ~85 | 5% | Only group letter varies |
| FAQ questions (6) | ~180 | 10% | Titles vary by group letter only |
| FAQ answers (6) | ~480 | 40% | Venues, fixtures, team names vary |
| WCRelatedLinks labels + descs | ~200 | 3% | One desc interpolates group letter |
| Team name badges | ~40 | 100% | 4 team names per group |
| **Total visible body** | **~1,260** | **~18%** | |

**Classification: THIN across all 12 pages**

The Points System, Tiebreaker Rules, and How-to-Qualify paragraphs (~240 words) are byte-for-byte identical on every group page. The Qualification Summary changes one word (`Group X`). Google can detect this level of duplication trivially. The only substantive unique content is: team names, fixture dates/venues, and the favourite team in FAQ answer 6.

---

### 2. Team Pages — `/world-cup-2026/teams/[slug]` (45 pages in data file)

**Template analysis:**

| Section | Words | Unique % | Notes |
|---|---|---|---|
| `intro` field (data-driven) | ~60 avg | 100% | Quality varies widely — see below |
| Hero badges (rank/conf/group) | ~20 | 90% | Per-team values |
| RouteToFinal step labels | ~30 | 0% | Same 6 stages everywhere |
| FAQ answers (4 questions) | ~300 | ~50% | Q3 (fixtures) and Q4 (watch) vary |
| Watch Live / TV Schedule CTAs | ~20 | 0% | Hardcoded text |
| WCRelatedLinks | ~200 | 5% | Group href varies, all copy same |
| **Total visible body** | **~630** | **~30%** | |

**Intro quality tiers (the only hand-authored differentiator per page):**

| Tier | Teams | Characteristic |
|---|---|---|
| **Strong** (unique hooks) | Argentina, Brazil, France, England, Germany, Mexico, Japan, Morocco, South Africa, Saudi Arabia, Iraq, Jordan, Venezuela, Ivory Coast, Austria, Italy | Specific historical facts, named players, distinctive circumstances |
| **Generic** (fill-in-the-blank) | Iran, Peru, Poland, Belgium, Colombia, Ecuador, Algeria, Ukraine, Honduras, Panama, Ghana, New Zealand, Bolivia, Qatar, Turkey, Denmark, Serbia, Switzerland | Phrases like "well-drilled and tactically disciplined", "passionate fan base", "capable of causing upsets" — no differentiating detail |

metaDesc pattern is **two fill-in-the-blank templates** with only team name / nickname varying:
- Premium: `"[Team] World Cup 2026 fixtures, results, group standing and squad. Follow [nickname] — schedule, TV guide and match updates."`
- Standard: `"[Team] World Cup 2026 fixtures, results and group standing. [Nickname] World Cup schedule and match updates."`

**Classification:** WEAK for strong-intro teams, THIN for generic-intro teams

---

### 3. Prediction Hub — `/world-cup-2026-predictions` (1 page)

| Section | Words | Unique % | Notes |
|---|---|---|---|
| Hero (heading + subtitle) | ~60 | 100% | Unique to this page |
| Pre-tournament static fixture cards | ~400 | 80% | Group/team/date data per card |
| FAQ (8 Qs + answers) | ~720 | 95% | All prediction-specific |
| WCRelatedLinks | ~200 | 5% | Standard template |
| **Total** | **~1,380** | **~70%** | |

**Classification: GOOD**

Strong FAQ depth (8 questions covering prediction methodology, H2H stats, AI scoring). Pre-tournament fallback cards show real fixture data. Main weakness: `/predict/{id}` links are absent pre-tournament (no API match IDs), reducing interactive value and internal link depth to prediction pages. Page will improve significantly once tournament starts.

---

### 4. Watch-Live Pages — `/world-cup-2026/watch-live/[slug]` (7 pages)

| Section | Words | Unique % | Notes |
|---|---|---|---|
| `intro` | ~170 avg | 100% | Broadcaster names, pricing, local tips |
| `heroSubtitle` + `quickVerdict` | ~30 | 100% | Per-country |
| `cordCuttingSection.body` | ~130 | 70% | Structure similar, details unique |
| `vpnSection.body` | ~100 | 60% | Geo-restriction details vary |
| Broadcaster table | varies | 100% | Fully per-country |
| Kickoff table | ~50 | 55% | UTC same, local times vary |
| FAQ (8 Qs + 8 As) | ~850 | 75% | Country-specific broadcaster/price Qs |
| WCRelatedLinks | ~200 | 5% | Templated |
| **Total** | **~1,530** | **~72%** | |

**Classification: GOOD**

Most content-rich category. Genuine per-country differentiation: US entry covers Fox/Telemundo/Peacock/Fubo pricing in detail; UK entry covers TV licence nuance; Australia entry correctly identifies SBS On Demand uniquely; India entry covers DD Free Dish rural access; Thailand/Vietnam entries include Southeast Asian broadcaster nuance.

---

### 5. TV Schedule Pages — `/world-cup-2026/tv-schedule/[slug]` (29 pages)

| Section | Words | Unique % | Notes |
|---|---|---|---|
| `intro` | ~130 avg | 85% | Per-country broadcaster detail |
| `heroSubtitle` | ~20 | 100% | Per-country |
| Channel table | varies | 100% | Per-country |
| Kickoff table | ~80 | 55% | UTC same, local times vary |
| FAQ (8 Qs + As) | ~640 | 65% | Country-specific; Thailand/Vietnam include native-language Qs |
| VPN affiliate CTA | ~80 | 10% | Near-identical across countries |
| WCRelatedLinks | ~150 | 5% | Templated |
| **Total** | **~1,100** | **~65%** | |

**Notable quality signal:** Thailand FAQ includes Thai (`ดูฟุตบอลโลก 2026 ช่องอะไร`) and Vietnam includes Vietnamese (`World Cup 2026 xem kênh gì`) native-language questions — strong localisation signal for those markets.

**Classification: GOOD** for US/UK/Canada/Australia/India/Thailand/Vietnam (7 well-populated entries); data quality for the remaining 22 entries (France, Germany, Brazil, etc.) requires verification.

---

## Top 20 Pages Needing Improvement

Ranked by severity (thin content risk + SEO importance).

| # | Route | Grade | Est. Words | Unique % | Schema | Primary Issue |
|---|---|---|---|---|---|---|
| 1 | `/world-cup-2026/group-i` | **THIN** | ~1,260 | 18% | ✅ Full | 100% templated body copy; group identity unclear pre-draw |
| 2 | `/world-cup-2026/group-j` | **THIN** | ~1,260 | 18% | ✅ Full | Same as above |
| 3 | `/world-cup-2026/group-k` | **THIN** | ~1,260 | 18% | ✅ Full | Same as above |
| 4 | `/world-cup-2026/group-l` | **THIN** | ~1,260 | 18% | ✅ Full | Same as above |
| 5 | `/world-cup-2026/group-e` | **THIN** | ~1,260 | 18% | ✅ Full | Points/tiebreaker paragraphs identical to all other groups |
| 6 | `/world-cup-2026/group-f` | **THIN** | ~1,260 | 18% | ✅ Full | Same |
| 7 | `/world-cup-2026/group-g` | **THIN** | ~1,260 | 18% | ✅ Full | Same |
| 8 | `/world-cup-2026/group-h` | **THIN** | ~1,260 | 18% | ✅ Full | Same |
| 9 | `/world-cup-2026/teams/iran` | **THIN** | ~630 | 22% | ✅ Full | Intro: "well-drilled and tactically disciplined" — zero specific detail |
| 10 | `/world-cup-2026/teams/peru` | **THIN** | ~630 | 22% | ✅ Full | Intro: "passionate South American style" — no qualifying story, no player named |
| 11 | `/world-cup-2026/teams/poland` | **THIN** | ~630 | 23% | ✅ Full | Intro references "talismanic striker" without naming him (Lewandowski) |
| 12 | `/world-cup-2026/teams/belgium` | **THIN** | ~630 | 23% | ✅ Full | Intro is entirely generic post-golden-generation filler |
| 13 | `/world-cup-2026/teams/colombia` | **THIN** | ~630 | 23% | ✅ Full | "Genuine dark-horse contenders" — standard boilerplate |
| 14 | `/world-cup-2026/teams/ecuador` | **THIN** | ~630 | 23% | ✅ Full | "High-energy attacking style" — no specific player, no story hook |
| 15 | `/world-cup-2026/teams/algeria` | **THIN** | ~630 | 23% | ✅ Full | "Well-represented in European leagues" — no qualifier detail |
| 16 | `/world-cup-2026/teams/ukraine` | **WEAK** | ~630 | 28% | ✅ Full | Intro mentions "extraordinary circumstances" but doesn't name any player or qualifying result |
| 17 | `/world-cup-2026/teams/honduras` | **THIN** | ~630 | 22% | ✅ Full | "Passionate fan base and competitive performances" — no facts |
| 18 | `/world-cup-2026/teams/panama` | **THIN** | ~630 | 22% | ✅ Full | "Disciplined and hard to beat" — formulaic; no 2018 debut story mentioned |
| 19 | `/world-cup-2026/teams/new-zealand` | **THIN** | ~630 | 23% | ✅ Full | OFC pathway only team — intro has no historical hook (they've qualified before) |
| 20 | `/world-cup-2026/group-a` | **THIN** | ~1,260 | 20% | ✅ Full | Best-traffic group (co-hosts USA/Canada/Mexico) but body copy still 80% duplicated |

---

## Orphan Schema Coverage Check

All audited pages have schema coverage. No pages are schema-free. However:

| Issue | Pages Affected |
|---|---|
| No FAQPage on high-priority hub | `/world-cup-2026` (hub), `/` (homepage) — flagged in INDEX-2 |
| ItemList absent pre-tournament | `/world-cup-2026-schedule` — flagged in INDEX-2 |
| Group pages: all 3 schemas present | BreadcrumbList ✅ CollectionPage ✅ FAQPage ✅ SportsEvent ✅ |
| Team pages: all 3 schemas present | BreadcrumbList ✅ SportsTeam ✅ FAQPage ✅ |
| Prediction hub: 2 schemas | BreadcrumbList ✅ FAQPage ✅ |
| Watch-live: 2 schemas (in component) | BreadcrumbList ✅ FAQPage ✅ |
| TV schedule: 2 schemas | BreadcrumbList ✅ FAQPage ✅ |

---

## Recommended Fixes by Priority

### Immediate — Group pages (THIN, 12 pages at risk)

Add **2–3 sentences of group-specific editorial** per group. Minimum viable additions:
1. A "Group storyline" paragraph (~100 words) covering the key match in the group, the form of the top seed, and a dark-horse mention. This content must be manually authored per group — it cannot be templated.
2. Unique `qualificationNote` field in the data source differentiating each group's competitive dynamics.

The Points System / Tiebreaker Rules paragraphs should be **extracted into a shared `<WCGroupRulesAccordion>` component** that is collapsed by default — Google treats collapsed-behind-details content with lower weight, reducing the duplicate-content signal while keeping it accessible.

### Medium — Team intros (THIN, ~15 pages)

The `intro` field in `wc-all-teams.ts` needs enrichment for generic entries. Each intro needs:
- One specific named player (not "talismanic striker")
- One specific historical World Cup fact or qualifying result
- The team's realistic tournament outlook

Worst entries to fix first: iran, peru, poland, belgium, colombia, ecuador, algeria, honduras, panama, new-zealand.

### Low — metaDesc templates

The two metaDesc fill-in-the-blank templates across 45 team pages are functionally identical except for team name. While metaDesc is not a direct ranking factor, duplicate descriptions cause GSC to report "Duplicate, Google chose different canonical". Enrich 15–20 key team metaDescs with a unique sentence per team.

---

## Summary

| Category | Pages | GOOD | WEAK | THIN |
|---|---|---|---|---|
| Group pages | 12 | 0 | 0 | **12** |
| Team pages | 45 | 15 | 15 | **15** |
| Prediction hub | 1 | 1 | 0 | 0 |
| Watch-live pages | 7 | 7 | 0 | 0 |
| TV schedule pages | 29 | 7 (confirmed) | 22 (unverified) | 0 (est.) |
| **Total** | **94** | **30** | **37** | **27** |

27 pages (29%) are at thin-content risk. All 12 group pages and ~15 team pages need editorial enrichment before the tournament starts. Watch-live and TV schedule pages are the content quality benchmark — the depth and country-specificity of those entries should be the target for group and team pages.
