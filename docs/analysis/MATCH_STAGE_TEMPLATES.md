# MATCH_STAGE_TEMPLATES — DATA-18WC.MATCH-STORY

**Date:** 2026-06-26
**Status:** IMPLEMENTED ✅

---

## WC Group Stage Template

**Trigger:** `matchType === 'WC_GROUP'`

**Sections:**
1. Introduction
2. First Half *(shared)*
3. Second Half *(shared)*
4. Group Stage Impact
5. FIFA World Cup 2026

**Introduction examples:**

*FINISHED, home win:*
> Morocco claimed a crucial 2–1 victory over Belgium in the Group E stage of the FIFA World Cup 2026 on Wednesday, 18 June 2026. The three points strengthen Morocco's position in Group E and advance their World Cup qualification push. It was a statement performance that put the rest of the group on notice.

*FINISHED, draw:*
> Germany and Spain shared a 1–1 draw in the Group B stage of the FIFA World Cup 2026 on Monday, 16 June 2026. Both sides take a point from a tightly contested encounter, leaving the Group B standings delicately poised. With further matches to come, both teams will be keeping a close eye on results elsewhere in Group B.

*UPCOMING:*
> Brazil face Argentina in Group C of the FIFA World Cup 2026 on Friday, 20 June 2026. With a place in the knockout rounds at stake, both sides are fully aware of the importance of every point in Group C.

**Group Stage Impact examples:**

*Home win:*
> The three points are vital for Morocco as they push for a place in the knockout rounds. Belgium must now respond quickly — with every point in Group E mattering, there is no room for dropped points. The Group E standings will be closely watched as the group stage continues.

*Draw:*
> Both sides take a point from a competitive encounter. The Group B standings remain tight, and the final round of group matches could yet decide who advances. Teams looking to qualify will need to monitor all results across the group carefully.

---

## WC Knockout: Round of 32 Template

**Trigger:** `matchType === 'WC_KNOCKOUT'` + `stage === 'LAST_32'`

**Sections:**
1. Introduction
2. First Half *(shared)*
3. Second Half *(shared)*
4. Road to the Final
5. FIFA World Cup 2026

**Introduction examples:**

*FINISHED, winner:*
> South Africa advance to the Round of 16 of the FIFA World Cup 2026 after a 2–1 Round of 32 victory over Canada on Sunday, 29 June 2026. Canada's World Cup journey comes to an end — eliminated at the Round of 32. It was a hard-fought knockout tie that South Africa ultimately won when it mattered most.

*FINISHED, draw at 90:*
> South Africa and Canada could not be separated after 90 minutes in this FIFA World Cup 2026 Round of 32 on Sunday, 29 June 2026, the score level at 1–1 at full time. In knockout football there must be a winner — the match would continue into extra time, and if still level, a penalty shootout.

*UPCOMING:*
> South Africa face Canada in the FIFA World Cup 2026 Round of 32 on Sunday, 29 June 2026. The winner advances to the Round of 16 — the loser is eliminated. There is no second chance in knockout football: just 90 minutes to determine which nation continues their World Cup journey.

**Road to the Final examples:**

*Winner decided:*
> South Africa advance to the Round of 16 — one step closer to a World Cup Final appearance. Canada are eliminated, their 2026 World Cup over. The road to the Final continues for South Africa.

*Draw at 90:*
> A knockout match requires a winner. Extra time will be played, and if the score remains level after 30 additional minutes, a penalty shootout will determine who advances to the Round of 16. In World Cup knockout football, every save, every kick and every decision can define a nation's legacy.

---

## WC Knockout: Round of 16 Template

**Stage:** `LAST_16` → next: "Quarter-finals"

*UPCOMING intro:*
> France face Portugal in the FIFA World Cup 2026 Round of 16 on Thursday, 3 July 2026. The winner advances to the Quarter-finals — the loser is eliminated. There is no second chance in knockout football.

*Road to the Final (winner):*
> France advance to the Quarter-finals — one step closer to a World Cup Final appearance. Portugal are eliminated, their 2026 World Cup over. The road to the Final continues for France.

---

## WC Knockout: Quarter-finals Template

**Stage:** `QUARTER_FINALS` → next: "Semi-finals"

*UPCOMING intro:*
> England face Netherlands in the FIFA World Cup 2026 Quarter-finals on Sunday, 6 July 2026. The winner advances to the Semi-finals — the loser is eliminated.

*Road to the Final (winner):*
> England advance to the Semi-finals — one step closer to a World Cup Final appearance. Netherlands are eliminated, their 2026 World Cup over. The road to the Final continues for England.

---

## WC Knockout: Semi-finals Template

**Stage:** `SEMI_FINALS` → next: "Final"

*UPCOMING intro:*
> Argentina face Germany in the FIFA World Cup 2026 Semi-finals on Wednesday, 9 July 2026. The winner advances to the Final — the loser is eliminated. There is no second chance in knockout football.

*Road to the Final (winner):*
> Argentina advance to the Final — one step closer to a World Cup Final appearance. Germany are eliminated, their 2026 World Cup over. For Argentina, one game separates them from the ultimate prize. The road to the Final continues for Argentina.

---

## WC Knockout: Third Place Play-off Template

**Stage:** `THIRD_PLACE` → next: null
**Section 4 heading:** "The Bronze Medal" (not "Road to the Final")

*UPCOMING intro:*
> Germany take on Netherlands in the FIFA World Cup 2026 Third Place Play-off on Saturday, 12 July 2026. Both sides were beaten in the Semi-finals and now compete for the bronze medal and a final chance to finish on the podium.

*The Bronze Medal (winner):*
> Germany finish the FIFA World Cup 2026 in third place — an outstanding achievement at the world's greatest tournament. The bronze medal is a reward for a remarkable run, and one that the players and their nation will cherish. Meanwhile, the two finalists prepare for the ultimate encounter.

---

## WC Knockout: Final Template

**Stage:** `FINAL` → next: null
**Section 4 heading:** "The World Cup Champion"

*UPCOMING intro:*
> Brazil face France in the FIFA World Cup 2026 Final on Sunday, 19 July 2026 — the culmination of the greatest tournament on earth. One team will be crowned World Champion. The world will be watching as these two nations battle for the ultimate prize in football.

*FINISHED, winner intro:*
> Brazil are the FIFA World Cup 2026 champions after a 2–1 victory over France in the Final on Sunday, 19 July 2026. A historic moment for Brazil and their nation — the most coveted trophy in world football is theirs. It was a performance that will be remembered for generations.

*The World Cup Champion:*
> Brazil are World Champions — the pinnacle of international football achieved on the grandest stage. The journey through the tournament, the knockouts won, the rivals overcome — it all culminates in this historic moment. Brazil will forever be remembered as the 2026 FIFA World Cup champions.

---

## STANDARD Template

**Trigger:** all non-WC competitions

**Sections:**
1. Introduction
2. First Half *(shared)*
3. Second Half *(shared)*
4. Result Impact
5. Competition Context

**League vocabulary permitted:** "three points", "league table", "campaign", "season", "standings", "title race"

*FINISHED, home win:*
> Arsenal secured a 3–1 victory over Chelsea in Matchday 28 of the Premier League on Sunday, 8 March 2026. The home side delivered a confident performance, taking all three points in front of their supporters and putting down a firm marker to the rest of the competition.

*Result Impact, away win:*
> Three points on the road is always a significant achievement, and Chelsea will be delighted to collect maximum points from this trip. Arsenal now face the task of responding in their next encounter, with this defeat a reminder of the unforgiving nature of top-level football. The result will have an effect on the wider standings, adding further intrigue to the Premier League table.
