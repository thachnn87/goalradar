D:/projects/goalradar/WC_STANDINGS_TRUTH.md

The file has been written. Here is what the audit covers and found:

**File:** `D:/projects/goalradar/WC_STANDINGS_TRUTH.md`

**Key findings from the production HTML:**

**CONFIRMED DISCREPANCIES:**

1. **D1 (CRITICAL) — Group C standings all-zero despite confirmed results.** The Group C page quotes "Mexico | 0 | 0 | 0 | 0 | 0" but the results page confirms Mexico beat Czechia 3-0 (FT June 25), and the Mexico team page shows form W-W-W with three confirmed wins (South Korea 1-0, South Africa 2-0, Czechia 3-0). Expected: Mexico P=3, W=3, Pts=9.

2. **D2 (CRITICAL) — Group C team composition mismatch.** The Group C page lists "Mexico, Spain, Serbia, Australia" but Mexico's confirmed opponents are South Korea, South Africa, and Czechia — none of which appear in that roster. Spain/Serbia/Australia do not appear in any of Mexico's results.

3. **D3 (HIGH) — Group J standings all-zero despite confirmed results.** Croatia beat Panama 0-1 (FT June 23) and South Africa beat South Korea 1-0 (FT June 25), yet Group J shows all teams at P=0, Pts=0.

4. **D4 (HIGH) — Group J team composition mismatch.** The Group J page lists Peru instead of South Korea, and Panama is absent — but confirmed results show Croatia vs Panama and South Africa vs South Korea.

5. **D5 (MEDIUM) — Mexico team page internal contradiction.** The same page has narrative text saying "1st in Group C, 84% chance" while the standing widget shows 0 pts, 0 played.

6. **D6 (LOW) — Groups page meta says "12 groups A-L"** for what the tournament describes as a 16-group format.

The hub and groups page standings tables could not be compared because both pages were truncated at the nav element with no `<main>` content present.
