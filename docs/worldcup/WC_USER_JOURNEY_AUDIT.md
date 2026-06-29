# WC_USER_JOURNEY_AUDIT.md — DATA-18WC.8D Phase 8

**Date:** 2026-06-24
**Method:** Trace each user scenario through confirmed production page evidence

---

## SCENARIO 1: "Who qualified from Group A?"

**User path:**

1. Visit `https://www.goalradar.org/world-cup-2026` (hub)
2. Scroll to Group A standings section

**What the user sees on the hub:**
```
Group A: USA 0pts, France 0pts, Switzerland 0pts, Japan 0pts
```

**Reality:** Group A is Mexico, Korea Republic, Czechia, South Africa. Mexico (6pts) is mathematically qualified.

**User experience:**
- User sees Group A = USA/France/Switzerland/Japan (completely wrong)
- All teams have 0 points — looks like no matches have been played
- No qualification badge visible (all 0pts triggers "undecided" or no badge)
- User may click through to Group A page

3. Navigate to Group A page: `https://www.goalradar.org/world-cup-2026/group-a`

**What the user sees:**
```
Group A: Mexico 6pts (W2), Korea Rep 3pts, Czechia 1pt, South Africa 1pt
Mexico: Qualified ✅
```

**Confusion point:** The hub showed Group A = USA/France/Switzerland/Japan with 0pts. The group page shows completely different teams with real points. A user would be confused — did the groups change? Did the hub show a different competition?

**Result:** User eventually finds correct answer on the group page, but only after navigating away from the hub and encountering a contradiction. 

**Journey verdict:** ❌ BROKEN — hub provides wrong answer, requires corrective navigation

---

## SCENARIO 2: "What are France's upcoming matches?"

**User path:**

1. Visit `https://www.goalradar.org/world-cup-2026/teams/france`

**What the user sees:**
```
🇫🇷 Fixtures load once the tournament begins
Check back from 11 June 2026
View full schedule →
```

**Reality:** France has group stage match 3 still to play (France vs Norway or Senegal, matchday 3). France has also played June 16 and June 22 — those should appear as recent results.

**User experience:**
- "Fixtures load once the tournament begins" — user knows the tournament started June 11
- "Check back from 11 June 2026" — it IS June 24, user is confused
- Clicks "View full schedule →" which links to `/world-cup-2026/fixtures`

2. Navigate to `/world-cup-2026/fixtures`

**What the user sees:**
```
47 matches — Upcoming matches & kick-off times
[47 finished/cancelled entries]
No upcoming fixtures shown
```

**User experience:**
- The fixtures page title says "Upcoming matches & kick-off times" but contains only finished matches
- France's matches (if present) are in the past, not filtered for France
- User cannot find France's upcoming match here

3. Navigate to `/world-cup-2026/bracket`

**What the user sees:**
```
1st Group I vs 2nd Group G — 5 Jul, 21:00 UTC
```

France as 1st Group I will play 2nd Group G on 5 July. This is visible on the bracket but requires:
- User knowing France finished 1st in Group I
- Understanding the bracket seeding logic
- Looking at the right bracket slot

**Result:** User cannot easily find France's upcoming fixture. The "canonical" team page is broken. The fixture IS visible on the bracket with effort, but not in any direct fixture listing.

**Journey verdict:** ❌ BROKEN — team page placeholder blocks discovery; bracket requires domain knowledge

---

## SCENARIO 3: "Show me the knockout bracket"

**User path:**

1. Visit `https://www.goalradar.org/world-cup-2026` (hub)
2. Hub shows bracket mini-widget (confirmed) — R32 slots with "TBD" teams and dates

**What the user sees on the hub:**
```
Knockout Stage
R32: [TBD] vs [TBD] — 2 Jul
[...]
```

3. Click to bracket page: `https://www.goalradar.org/world-cup-2026/bracket`

**What the user sees:**
```
🏆 Knockout Bracket — FIFA World Cup 2026 · 32 matches · 6 rounds

Round of 32 — 16 matches (2–9 July 2026)
1st Group A vs 3rd (B/C/D) — 2 Jul 17:00 UTC
1st Group C vs 3rd (D/E/F) — 2 Jul 21:00 UTC
[...all 16 R32 matches with group seedings...]

Round of 16 — 8 matches (12–15 July)
[...]

Quarter-finals — 4 matches (17–18 July)
Semi-finals — 2 matches (21–22 July)
Third Place Play-off — 25 July, MetLife
The Final — 26 July 2026, MetLife
```

**User experience:** Clear, complete, understandable. TBD team slots are labeled with group seedings (1st Group A etc.) — a user can work out when their team plays if they know the group result.

**Result:** User gets a complete, correct bracket picture.

**Journey verdict:** ✅ WORKS — bracket is the best-functioning page in the WC section

---

## SCENARIO 4: "Check France's World Cup results"

**User path:**

1. Visit `https://www.goalradar.org/world-cup-2026/teams/france`

**What the user sees:**
```
Qualification Status: ✅ Qualified — finished 1st in Group I
Group I Standing: France 2 +5 2-0-0 6pts
Route to the Final: Groups [Current] → R32 → R16 → QF → SF → 🏆 Final
Fixtures load once the tournament begins — Check back from 11 June 2026
```

**Results visible:** NONE. Team page shows placeholder, not France's 2 wins (3-1 Senegal, 3-0 Iraq).

2. User tries to find results → navigates to `/world-cup-2026/results`

**What the user sees:**
```
46 played, 139 goals, 3.0 avg
France 3-0 Iraq — [date]
France 3-1 Senegal — [date]
[45 other matches not filtered for France]
```

The results page shows all 46 matches. France's matches ARE present but not filterable by team name. User must scroll through 46 results.

3. User tries `/world-cup-2026/results?team=france` — this URL likely doesn't exist as a valid filter (not confirmed).

**Result:** France results exist on the results page but require manual scanning. Team page shows no match history despite being the primary team-specific page.

**Journey verdict:** ❌ DEGRADED — results page has the data but no team filter; team page fails completely

---

## SCENARIO 5: "Who has qualified for the knockout stage?"

**User path:**

1. Visit `https://www.goalradar.org/world-cup-2026/groups`

**What the user sees:**
```
All 12 groups with correct standings and color-coding:
- Mexico 6pts (Qualified ✅)
- USA 6pts (Qualified ✅)
- Germany 6pts (Qualified ✅)
- France 6pts (Qualified ✅)
- Norway 6pts (Qualified ✅)
- Argentina 6pts (Qualified ✅)
[other groups with 1st/2nd colored green or yellow]
```

**User experience:** Complete, correct, visual. Color coding makes it easy to identify qualified teams.

2. User also tries hub: shows wrong teams, 0pts, no qualification badges → misleading

**Result:** Groups page gives a correct answer. Hub gives a wrong answer for the same question.

**Journey verdict:** ✅ WORKS via groups page / ❌ BROKEN via hub

---

## USER JOURNEY SUMMARY

| Scenario | Entry Page | Outcome | Verdict |
|----------|-----------|---------|---------|
| 1. Who qualified from Group A? | Hub | Wrong teams, no answer | ❌ BROKEN |
| | Group A page | Correct: Mexico qualified | ✅ WORKS |
| 2. France's upcoming matches? | France team page | Placeholder, dead end | ❌ BROKEN |
| | Fixtures page | No upcoming shown | ❌ BROKEN |
| | Bracket page | Visible with effort | ⚠️ PARTIAL |
| 3. Show the knockout bracket | Hub → bracket | Complete, all 6 rounds | ✅ WORKS |
| 4. France's match results | France team page | No results shown | ❌ BROKEN |
| | Results page | Present, not filterable | ⚠️ PARTIAL |
| 5. Who has qualified? | Groups page | Correct, 6 qualified teams | ✅ WORKS |
| | Hub | Wrong data, can't answer | ❌ BROKEN |

**Hub is the primary discovery surface and it consistently provides wrong answers.** Every scenario that starts on the hub either fails outright or requires corrective navigation to a secondary page.

---

## DEAD ENDS

A dead end is a page state that gives the user no useful information and no actionable next step.

1. **Hub upcoming section:** "No upcoming fixtures available — Upcoming matches will appear here once scheduled" — no link to bracket or fixture archive
2. **France team page fixtures:** "Fixtures load once the tournament begins" — link to fixtures page which is also empty of upcoming
3. **Fixtures page:** Shows only finished matches despite being titled "Upcoming matches & kick-off times"
4. **Group I page upcoming:** "No upcoming fixtures for this group yet" — despite 2 matches remaining

All 4 dead ends converge on the same root cause: upcoming KV feed absent.
