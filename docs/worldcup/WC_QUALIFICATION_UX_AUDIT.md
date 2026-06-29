# WC_QUALIFICATION_UX_AUDIT.md — DATA-18WC.8D Phase 4

**Date:** 2026-06-24
**Method:** Production page fetches, qualification engine analysis

---

## 1. QUALIFICATION STATUS FROM PRODUCTION

Based on Groups page standings (2026-06-24, 2 matchdays played in most groups):

### Groups with 2 Matchdays Played

| Group | 1st (QUALIFIED) | 2nd | 3rd | 4th (Last) |
|-------|----------------|-----|-----|-----------|
| A | Mexico 6pts ✅ | Korea Rep 3pts | Czechia 1pt | South Africa 1pt |
| B | Canada 4pts | Switzerland 4pts | Bosnia-H. 1pt | Qatar 1pt |
| C | Brazil 4pts | Morocco 4pts | Scotland 3pts | Haiti 0pt |
| D | USA 6pts ✅ | Australia 3pts | Paraguay 3pts | Turkey 0pt |
| E | Germany 6pts ✅ | Ivory Coast 3pts | Ecuador 1pt | Curaçao 1pt |
| F | Netherlands 4pts | Japan 4pts | Sweden 3pts | Tunisia 0pt |
| G | Egypt 4pts | Iran 2pts | Belgium 2pts | New Zealand 1pt |
| H | Spain 4pts | Uruguay 2pts | Cape Verde 2pts | Saudi Arabia 1pt |
| I | France 6pts ✅ | Norway 6pts ✅ | Senegal 0pt | Iraq 0pt |
| J | Argentina 6pts ✅ | Austria 3pts | Algeria 3pts | Jordan 0pt |
| K | Portugal 4pts | Colombia 3pts (1G) | Congo DR 1pt (1G) | Uzbekistan 0pt |
| L | England 4pts | Ghana 4pts | Panama 1pt | Croatia 1pt |

**Mathematically qualified (6pts from 2 games):** Mexico, USA, Germany, France, Norway, Argentina — 6 teams

**Mathematically eliminated:** Iraq 0pts (2/2 games played, max 3pts achievable but need at least ~4 for qualification) — PROBABLE but not yet confirmed since matchday 3 still to play

---

## 2. AUDIT QUESTIONS

### Q1. Which teams are mathematically qualified?
Confirmed qualified (6pts from 2 matches): Mexico, USA, Germany, France, Norway, Argentina

These are shown on the Group I page: "France: Qualified — finished 1st in Group I" ✅

### Q2. Which teams are eliminated?
From Group I page: "Iraq: Eliminated from top-two contention. Must win remaining matches and hope for a best-third qualification." ✅

Teams with 0pts from 2 games are in very poor position. Teams with 0pts and 1 game remaining (Group K: Uzbekistan 0pts/2G) are eliminated.

### Q3. Which teams are in contention?
Group I page shows: "Senegal: 3rd-Place Race" with 1 match remaining. This means the engine correctly identifies Senegal as a best-third candidate.

### Q4. Which pages show qualification information?
| Page | Shows qualification? |
|------|---------------------|
| WC Hub | ✅ Hub shows qualification badges on the group table (WCGroupTable component with qualMap) |
| Groups page | ✅ Shows "Advances to knockout stage" / "Possible best third-place" color coding |
| Group/[slug] page | ✅ Shows full qualification summary with status per team |
| Team/[slug] page | ✅ Shows individual team qualification badge "Qualified — finished 1st in Group I" |
| Fixtures page | ❌ No qualification information |
| Bracket page | ❌ No qualification information |
| Match page | ❌ No qualification information |

### Q5. Which pages should show qualification but don't?
- **Fixtures page**: Could benefit from showing qualified team indicators on fixture rows
- **Results page**: No qualification markers on result rows
- These are P3 (cosmetic), not blocking

### Q6. Are qualification badges visible enough?
| Page | Assessment |
|------|-----------|
| Group I page | ✅ Clearly labeled: "Qualified", "3rd-Place Race", "In Contention", "Eliminated" with color coding |
| France team page | ✅ "✅ Qualified — finished 1st in Group I" prominently placed |
| Hub group table | **❌ Cannot assess** — hub group standings are wrong (0pts/wrong teams), so qualification badges are also wrong |
| Groups page | ✅ Color-coded rows (green = qualified, yellow = possible third) |

### Q7. Is qualification status consistent everywhere?
**INCONSISTENT** due to the hub bug.

- Group I page correctly shows France as "Qualified"
- France team page correctly shows "Qualified"
- Hub Group I shows Colombia, Poland, Ivory Coast, New Zealand (WRONG TEAMS) — qualification engine runs on wrong data

A user comparing the hub to the groups page would see completely different qualification pictures.

---

## 3. QUALIFICATION ENGINE ASSESSMENT

The `calculateQualificationStatus()` engine appears to work correctly when fed valid standings data:
- France/Norway at 6pts → QUALIFIED
- Iraq at 0pts/2G → ELIMINATED/THIRD_PLACE_CONTENDER
- Senegal at 0pts/2G → 3RD_PLACE_RACE

The engine is **correct** but **fed wrong data on the hub**. The groups page and group/[slug] pages feed the engine correct data and show correct results.

---

## 4. SEVERITY RATINGS

| Finding | Severity | Evidence |
|---------|---------|---------|
| Hub qualification badges based on wrong teams/0pts | **P0** | Hub shows Group I = Colombia/Poland/Ivory Coast/New Zealand, all 0pts |
| France team page qualification badge correct | ✅ GREEN | "✅ Qualified — finished 1st in Group I" |
| Groups page qualification encoding correct | ✅ GREEN | Color-coded rows confirmed |
| Group/[slug] qualification summary correct | ✅ GREEN | Group I page shows correct per-team analysis |
