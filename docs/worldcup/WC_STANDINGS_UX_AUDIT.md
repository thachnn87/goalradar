# WC_STANDINGS_UX_AUDIT.md — DATA-18WC.8D Phase 3

**Date:** 2026-06-24
**Method:** Production page fetches

---

## 1. PRODUCTION EVIDENCE

### `/world-cup-2026/groups` Page (correct)
All 12 groups visible with correct teams, real points, real W/D/L:
```
Group A: Mexico 6pts (2W), Korea Rep 3pts, Czechia 1pt, South Africa 1pt
Group B: Canada 4pts, Switzerland 4pts, Bosnia-H. 1pt, Qatar 1pt
Group C: Brazil 4pts, Morocco 4pts, Scotland 3pts, Haiti 0pt
Group D: USA 6pts (2W), Australia 3pts, Paraguay 3pts, Turkey 0pt
Group E: Germany 6pts (2W), Ivory Coast 3pts, Ecuador 1pt, Curaçao 1pt
Group F: Netherlands 4pts, Japan 4pts, Sweden 3pts, Tunisia 0pt
Group G: Egypt 4pts, Iran 2pts, Belgium 2pts, New Zealand 1pt
Group H: Spain 4pts, Uruguay 2pts, Cape Verde 2pts, Saudi Arabia 1pt
Group I: France 6pts, Norway 6pts, Senegal 0pt, Iraq 0pt
Group J: Argentina 6pts, Austria 3pts, Algeria 3pts, Jordan 0pt
Group K: Portugal 4pts, Colombia 3pts (1 game), Congo DR 1pt (1 game), Uzbekistan 0pt
Group L: England 4pts, Ghana 4pts, Panama 1pt, Croatia 1pt
```

### WC Hub Group Standings Section (wrong)
```
Group A: USA 0pts, France 0pts, Switzerland 0pts, Japan 0pts
Group B: Canada 0pts, England 0pts, Denmark 0pts, South Korea 0pts
Group C: Mexico 0pts, Spain 0pts, Serbia 0pts, Australia 0pts
Group D: Costa Rica 0pts, Germany 0pts, Türkiye 0pts, Morocco 0pts, Iran 0pts  ← 5 teams!
Group E: Panama 0pts, Portugal 0pts, Senegal 0pts, Saudi Arabia 0pts
Group F: Honduras 0pts, Netherlands 0pts, Nigeria 0pts, Qatar 0pts
Group G: Argentina 0pts, Egypt 0pts, Iraq 0pts  ← only 3 teams
Group H: Brazil 0pts, Belgium 0pts, Cameroon 0pts, Jordan 0pts
Group I: Colombia 0pts, Poland 0pts, Ivory Coast 0pts, New Zealand 0pts
Group J: Uruguay 0pts, Croatia 0pts, South Africa 0pts, Peru 0pts
Group K: Ecuador 0pts, Ghana 0pts, Ukraine 0pts  ← only 3 teams
Group L: Venezuela 0pts, Austria 0pts, Algeria 0pts, Bolivia 0pts
```

---

## 2. AUDIT QUESTIONS

### Q1. Are all 12 groups visible?
**YES on Groups page** ✅  
**YES on Hub but with WRONG DATA** ❌  
**YES on Group/[slug] pages** ✅  

### Q2. Are groups complete (correct number of teams)?
**YES on Groups page and Group/[slug] pages** ✅  
**NO on Hub** ❌ — Hub shows Group D with 5 teams, Groups G and K with only 3 teams  

### Q3. Are rankings correct?
**YES on Groups page** ✅  
**NO on Hub** ❌ — All teams ranked 1–4 with 0 points regardless of actual results  

### Q4. Are points correct?
**YES on Groups page** ✅ (France 6pts, Mexico 6pts, etc.)  
**NO on Hub** ❌ — ALL teams show 0 points  

### Q5. Are goal differences correct?
**YES on Groups page** ✅  
**NO on Hub** ❌ — All show +0/−0  

### Q6. Are tie-breakers correct?
**YES on Groups page (ordering looks correct)** ✅  
**N/A on Hub** — all 0pts, ordering arbitrary  

### Q7. Can standings disappear after deployment?
**YES** ⚠️  
Both pages use `getStandingsCached('WC')` from the same KV cache. If the standings KV expires AND the orchestrator is stalled (current state), standings would fall to DR (7d TTL). If DR also expired, the groups page would show an API error fallback (empty tables). The hub would show an empty group table.

Currently the standing KV appears to be serving correct data for the groups page — but the hub's ISR cache is stale.

### Q8. Are standings rebuilt from static fallback?
**No static fallback exists.** The groups page has `apiError = true` branch but renders nothing for groups when it fails. The hub has an empty `groupTables = []` fallback which shows nothing. No hardcoded standings are used.

### Q9. Is user ever shown placeholder standings?
**YES — ON THE HUB.** The hub currently shows placeholder-style data (all teams with 0 points, wrong group assignments). A first-time user on the hub would see an apparently live tournament where no matches have been played — which contradicts the "Recent Results" section on the same page showing France 3-0 Iraq.

---

## 3. HUB STANDINGS BUG — ROOT CAUSE ANALYSIS

**Evidence:** Hub group standings show pre-tournament seedings (wrong teams, 0 points). Groups page shows correct live standings. Both use `getStandingsCached('WC').standings.filter(s => s.type === 'TOTAL')`.

**Most likely cause:** The hub ISR page HTML was baked when the standings KV either:
(a) Contained pre-tournament seedings (before FD updated WC 2026 groups with match data), OR
(b) The hub's ISR cache pre-dates the WC draw (before the actual groups A-L were finalized)

The ongoing orchestrator stall prevents `revalidateWCPaths()` from being called, which means the hub ISR HTML is not being refreshed with the current standings from KV.

**Cross-page contradiction:** The hub simultaneously shows:
- Group I: Colombia 0pts, Poland 0pts, Ivory Coast 0pts, New Zealand 0pts (WRONG)
- Recent Results: France 3-0 Iraq (CORRECT)

A user sees France beating Iraq in "Recent Results" but France doesn't appear in any Group I standings on the same page. This is deeply confusing.

---

## 4. SEVERITY RATINGS

| Finding | Severity | Evidence |
|---------|---------|---------|
| Hub shows wrong teams in groups, all 0 points | **P0** | Confirmed production HTML |
| Hub Group D shows 5 teams (impossible in WC 2026) | **P0** | Confirmed production HTML |
| Hub standings contradict hub results section | **P0** | Same page shows France in results but not in Group I standings |
| Groups page standings correct | ✅ GREEN | Confirmed |
| Group/[slug] page standings correct | ✅ GREEN | Confirmed for Group I |
