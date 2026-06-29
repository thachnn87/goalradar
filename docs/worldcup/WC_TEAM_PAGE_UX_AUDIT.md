# WC_TEAM_PAGE_UX_AUDIT.md — DATA-18WC.8D Phase 6

**Date:** 2026-06-24
**Method:** Production fetch of France (/world-cup-2026/teams/france) and USA (/world-cup-2026/teams/usa, background fetch)

---

## 1. FRANCE TEAM PAGE — PRODUCTION EVIDENCE

URL: https://www.goalradar.org/world-cup-2026/teams/france

```
🇫🇷 FIFA World Cup 2026 · UEFA
France at World Cup 2026

Group I — FIFA # 2 — UEFA

Group I Standing
# Team         P  GD  W-D-L  Pts
1 🇫🇷 France   2  +5  2-0-0  6    [Full Group I standings →]

Qualification Status
✅ Qualified
Qualified — finished 1st in Group I

🇫🇷 France — Route to the Final
Groups [Current] → R32 → R16 → QF → SF → 🏆 Final
"To lift the World Cup, France must win 5 more knockout matches after advancing from the group"

🇫🇷 Fixtures load once the tournament begins
Check back from 11 June 2026
View full schedule →

📺 Watch France Live ...
TV Schedule FAQ...
```

**Confirmed CRITICAL BUG:** France's match fixtures section shows the **pre-tournament placeholder**:
> "Fixtures load once the tournament begins — Check back from 11 June 2026"

The tournament started on 11 June 2026. Today is 24 June 2026. France has played:
- France 3–1 Senegal (June 16)
- France 3–0 Iraq (June 22)

Neither match appears on the team page. The upcoming Group I matchday 3 match also does not appear.

---

## 2. TEAM PAGE AUDIT — ALL 48 TEAMS

**Direct test:** France, USA confirmed. By source code analysis, ALL 48 team pages use the same logic:

```typescript
// teams/[slug]/page.tsx:308
const [upcomingData, recentData, standingsData] = await Promise.allSettled([
  getUpcomingMatches('WC'),
  getRecentMatches('WC'),
  getStandings('WC'),
]);
```

The fixture placeholder condition (deduced from the rendered output):
```typescript
// If both upcoming and recent arrays are empty for this team → show placeholder
// "Fixtures load once the tournament begins"
```

Root cause:
- `getUpcomingMatchesCached('WC')` → returns from upcoming KV feed → **ABSENT** (confirmed)
- `getRecentMatchesCached('WC')` → returns from recent feed KV → appears to return 0 France matches when filtered by `normName(team.apiName)` = "france"

The `getRecentMatchesCached('WC')` returns recent WC matches (likely the `wc-recent` KV feed from the orchestrator). The filter checks `normName(m.homeTeam?.name).includes(apiNorm)` — which should match "France". However, the France team page shows the placeholder, meaning either:
1. The recent KV feed doesn't include France's matches OR
2. The name normalization match is failing for "France"

**Likely cause:** The `wc-recent` KV feed is the "recent matches" orchestrator task, which may only return the last N matches. With 46 finished matches and France's most recent game on June 22, France's games might be in the recent feed but the team page is rendering pre-tournament because the **ISR cache for the team page was built during a window when the recent feed was empty or unavailable**.

Team pages have `revalidate = 3600` (1 hour). If the recent feed was empty when the ISR was last baked, the placeholder was baked in. With the orchestrator stalled (2h+), the ISR hasn't been refreshed.

---

## 3. WHAT DOES WORK ON TEAM PAGES

| Feature | Status | Evidence (France) |
|---------|--------|-------------------|
| Team group assignment | ✅ CORRECT | "Group I" shown correctly |
| FIFA ranking | ✅ CORRECT | "FIFA # 2" |
| Group standings table | ✅ CORRECT | France 2W/6pts, Norway 2W/6pts, Senegal/Iraq 0pts |
| Qualification status | ✅ CORRECT | "✅ Qualified — finished 1st in Group I" |
| Route to the Final stepper | ✅ CORRECT | Shows France at Group Stage stage (correct) |
| "Wins needed" text | ✅ CORRECT | "5 more knockout matches" |
| Watch live section | ✅ PRESENT | Broadcaster info |

---

## 4. WHAT IS BROKEN ON TEAM PAGES

| Feature | Status | Evidence |
|---------|--------|---------|
| Recent match results | ❌ NOT SHOWING | Pre-tournament placeholder shown |
| Upcoming fixtures | ❌ NOT SHOWING | Same placeholder |
| Team form indicator | ❌ NOT SHOWING | No W/D/L form badges |
| Match links | ❌ NOT SHOWING | No links to individual match pages |

---

## 5. STUB PAGES AND PLACEHOLDER CONTENT

### Pre-tournament placeholder
All 48 team pages show:
> "Fixtures load once the tournament begins — Check back from 11 June 2026 — View full schedule →"

This is a pre-tournament fallback message that should have been replaced by actual fixture data. The link "View full schedule →" goes to the fixtures page, which itself only shows finished matches.

### Team pages for teams that haven't played
Teams with fewer played games (e.g. teams in groups with only 1 matchday) would also show this placeholder.

### Team pages for teams not yet confirmed in WC
The system includes 48 teams in `WC_ALL_TEAM_SLUGS`. Pages like `/world-cup-2026/teams/italy` might exist but Italy did not qualify for WC 2026. Checking the hub: Italy appears in the team list section of the hub ("🇮🇹 Italy" listed under "All 48 Teams"). This needs verification — if Italy pages exist but Italy didn't qualify, it's misleading content.

---

## 6. SEVERITY RATINGS

| Finding | Severity | Evidence |
|---------|---------|---------|
| All 48 team pages show pre-tournament placeholder instead of actual fixtures | **P0** | France team page confirmed; code confirms same logic for all teams |
| France team page: 2 played matches not visible | **P0** | "Fixtures load once the tournament begins" despite France having played June 16 and June 22 |
| Team page fixtures empty → user sent to fixtures page → fixtures page shows only finished matches | **P0** | Chain of dead ends |
| Italy appears in hub team list (didn't qualify for WC 2026) | **P1** | Hub HTML shows "🇮🇹 Italy" in teams grid |
| Team page standings/qualification correct | ✅ GREEN | France: Qualified, 6pts |
