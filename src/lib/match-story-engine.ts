/**
 * Match Story Engine — DATA-18WC.MATCH-STORY
 *
 * ONE source for every match narrative. Three templates, zero league language
 * inside knockout or WC context. Delete this comment before production review.
 *
 * Templates:
 *   WC_KNOCKOUT — winner advances / loser eliminated / road to Final
 *   WC_GROUP    — group points / qualification push / group standings
 *   STANDARD    — league table / three points / campaign (only here)
 */

import type { MatchDetail, Match, StandingEntry } from '@/lib/types';
import type { QualificationStatus } from '@/lib/wc-qualification';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ReportSection {
  heading: string;
  paragraphs: string[];
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type MatchType = 'WC_KNOCKOUT' | 'WC_GROUP' | 'STANDARD';
type MatchState = 'FINISHED' | 'LIVE' | 'UPCOMING' | 'CANCELLED';
type Winner = 'HOME' | 'AWAY' | 'DRAW' | null;

export interface StoryContext {
  home:             string;
  homeS:            string;
  away:             string;
  awayS:            string;
  comp:             string;
  compFull:         string;
  matchType:        MatchType;
  stage:            string;
  stageLabel:       string;
  nextStageLabel:   string | null;
  groupLabel:       string | null;
  matchState:       MatchState;
  winner:           Winner;
  ftH:              number;
  ftA:              number;
  htH:              number | null;
  htA:              number | null;
  secondHalfGoals:  number;
  totalGoals:       number;
  matchDate:        string;
  matchLabel:       string;
}

// ---------------------------------------------------------------------------
// Stage vocabulary
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<string, string> = {
  LAST_32:        'Round of 32',
  LAST_16:        'Round of 16',
  QUARTER_FINALS: 'Quarter-finals',
  SEMI_FINALS:    'Semi-finals',
  THIRD_PLACE:    'Third Place Play-off',
  FINAL:          'Final',
  GROUP_STAGE:    'Group Stage',
};

const STAGE_NEXT: Record<string, string> = {
  LAST_32:        'Round of 16',
  LAST_16:        'Quarter-finals',
  QUARTER_FINALS: 'Semi-finals',
  SEMI_FINALS:    'Final',
};

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

export function buildStoryContext(match: MatchDetail): StoryContext {
  const home  = match.homeTeam.name     ?? 'The home side';
  const away  = match.awayTeam.name     ?? 'The away side';
  const homeS = match.homeTeam.shortName || home;
  const awayS = match.awayTeam.shortName || away;
  const comp  = match.competition?.name ?? 'the competition';

  const { score, status, matchday } = match;
  const stageKey = match.stage ?? '';

  const ftH        = score.fullTime.home  ?? 0;
  const ftA        = score.fullTime.away  ?? 0;
  const htH        = score.halfTime.home  ?? null;
  const htA        = score.halfTime.away  ?? null;
  const totalGoals = ftH + ftA;

  const isWC         = match.competition?.code === 'WC';
  const hasGroup     = !!(match.group);
  const isGroupStage = hasGroup || stageKey === 'GROUP_STAGE';
  const isKnockout   = isWC && !isGroupStage && !!stageKey && stageKey !== 'GROUP_STAGE';

  let matchType: MatchType;
  if      (isWC && isGroupStage) matchType = 'WC_GROUP';
  else if (isWC && isKnockout)   matchType = 'WC_KNOCKOUT';
  else                           matchType = 'STANDARD';

  const compFull = isWC ? 'FIFA World Cup 2026' : comp;

  const groupLabel = match.group
    ? match.group.replace(/^GROUP_/, '')
    : null;

  const stageLabel     = STAGE_LABELS[stageKey] ?? stageKey.replace(/_/g, ' ');
  const nextStageLabel = STAGE_NEXT[stageKey]   ?? null;

  const matchDate = new Date(match.utcDate).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });

  let matchLabel: string;
  if (isGroupStage && groupLabel) {
    matchLabel = `Group ${groupLabel}`;
  } else if (stageLabel && stageKey !== 'GROUP_STAGE') {
    matchLabel = stageLabel;
  } else if (matchday) {
    matchLabel = `Matchday ${matchday}`;
  } else {
    matchLabel = stageKey.replace(/_/g, ' ');
  }

  let matchState: MatchState;
  if      (status === 'IN_PLAY' || status === 'PAUSED')                             matchState = 'LIVE';
  else if (status === 'FINISHED')                                                    matchState = 'FINISHED';
  else if (status === 'CANCELLED' || status === 'SUSPENDED' || status === 'POSTPONED') matchState = 'CANCELLED';
  else                                                                               matchState = 'UPCOMING';

  let winner: Winner = null;
  if (matchState === 'FINISHED') {
    if      (score.winner === 'HOME_TEAM') winner = 'HOME';
    else if (score.winner === 'AWAY_TEAM') winner = 'AWAY';
    else                                   winner = 'DRAW';
  }

  const secondHalfGoals =
    matchState === 'FINISHED' && htH !== null && htA !== null
      ? (ftH - htH) + (ftA - htA)
      : totalGoals;

  return {
    home, homeS, away, awayS, comp, compFull,
    matchType, stage: stageKey, stageLabel, nextStageLabel, groupLabel,
    matchState, winner, ftH, ftA, htH, htA, secondHalfGoals, totalGoals,
    matchDate, matchLabel,
  };
}

// ---------------------------------------------------------------------------
// Shared sections — identical across all match types
// ---------------------------------------------------------------------------

function buildFirstHalf(ctx: StoryContext): ReportSection {
  const { homeS, awayS, htH, htA, matchState } = ctx;
  let p: string;

  if (htH !== null && htA !== null) {
    if (htH > htA) {
      p =
        `${homeS} made a strong start to the match, taking the initiative in the opening exchanges ` +
        `and translating their dominance into a ${htH}–${htA} lead at half-time. ` +
        `Their pressing game and organisation in the final third made life difficult for ${awayS} throughout the opening 45 minutes. ` +
        `The hosts went into the break with confidence, having firmly established control of the encounter.`;
    } else if (htA > htH) {
      p =
        `${awayS} were the brighter side in the opening period, working hard against a home side that struggled to impose themselves. ` +
        `Clinical in front of goal, the visitors went into the half-time break with a ${htH}–${htA} advantage. ` +
        `The first half showed ${awayS}'s composure and tactical discipline, as ${homeS} looked to find a way back into the game.`;
    } else {
      p =
        `The opening 45 minutes produced an absorbing battle with neither side able to break the deadlock, ` +
        `the teams heading into the interval level at ${htH}–${htA}. ` +
        `Both sets of players were disciplined defensively, with moments of quality at both ends of the pitch. ` +
        `The first half laid the foundation for what would be a tightly contested second period.`;
    }
  } else if (matchState === 'UPCOMING') {
    p =
      `The first half is expected to set the tone for the match, with both ${homeS} and ${awayS} looking to take an early grip on proceedings. ` +
      `${homeS} will aim to use home advantage from the off, while ${awayS} will stay disciplined and alert to counter-attacking opportunities. ` +
      `The tactical shape and energy in the opening 45 minutes will be crucial in determining how the game unfolds.`;
  } else {
    p =
      `The first half is currently in progress, with both teams fighting for possession and territory. ` +
      `${homeS} will want to use their home support as a twelfth player, while ${awayS} look to stay compact and take their chances when they arrive.`;
  }

  return { heading: 'First Half', paragraphs: [p] };
}

function buildSecondHalf(ctx: StoryContext): ReportSection {
  const { homeS, awayS, ftH, ftA, htH, htA, secondHalfGoals, matchState } = ctx;
  let p: string;

  if (matchState === 'FINISHED') {
    if (htH !== null && htA !== null && htH === ftH && htA === ftA) {
      p =
        `The second half largely mirrored the first, with ${homeS} and ${awayS} continuing to test each other ` +
        `without managing to alter the scoreline. ` +
        `Despite both teams pushing for a goal that would have changed the match, the defences stood firm and the score remained ${ftH}–${ftA}. ` +
        `Substitutions and tactical adjustments were made by both managers but ultimately could not break the deadlock.`;
    } else if (secondHalfGoals === 0) {
      p =
        `After the break, both sides remained committed and organised at the back, denying each other any clear scoring chances. ` +
        `The second period was a patient, tactical battle that neither team was willing to lose by taking unnecessary risks. ` +
        `The final score of ${ftH}–${ftA} was a fair reflection of a match where defensive quality prevailed.`;
    } else {
      const lead = htH !== null && htA !== null ? `from ${htH}–${htA} ` : '';
      p =
        `The second half saw the match open up further, with ${secondHalfGoals} more goal${secondHalfGoals === 1 ? '' : 's'} added ${lead}to bring the final score to ${ftH}–${ftA}. ` +
        `Both managers made tactical changes in an effort to influence the outcome, with substitutions and shifts in formation creating new dynamics on the pitch. ` +
        `The closing stages were played at a high tempo as the decisive moments came thick and fast.`;
    }
  } else if (matchState === 'UPCOMING') {
    p =
      `The second half will be where decisive moments are likely to be found, particularly if the match is finely poised at the interval. ` +
      `Fitness, bench depth and managerial decisions will all play a key role as the game enters its latter stages. ` +
      `The second period should produce the defining moments of the encounter.`;
  } else {
    p =
      `The second half will be crucial in determining the outcome. ` +
      `Whoever can impose their game plan most effectively after the break is likely to emerge victorious. ` +
      `Both sides will be pushing hard for the decisive goal.`;
  }

  return { heading: 'Second Half', paragraphs: [p] };
}

// ---------------------------------------------------------------------------
// STANDARD template — leagues, domestic cups, Champions League, etc.
// Only template where league vocabulary is permitted.
// ---------------------------------------------------------------------------

function buildStandardReport(ctx: StoryContext): ReportSection[] {
  const {
    home, homeS, away, awayS, compFull, matchLabel, matchDate,
    matchState, winner, ftH, ftA,
  } = ctx;
  const labelInfix = matchLabel ? ` in ${matchLabel} of` : ' in';

  // Introduction
  let intro: string;
  if (matchState === 'CANCELLED') {
    intro =
      `The ${compFull} fixture between ${home} and ${away}, scheduled for ${matchDate}, was cancelled. ` +
      `No result was recorded. Follow GoalRadar for rescheduled fixture information and all ${compFull} coverage.`;
  } else if (matchState === 'FINISHED') {
    if (winner === 'HOME') {
      intro =
        `${home} secured a ${ftH}–${ftA} victory over ${away}${labelInfix} the ${compFull} on ${matchDate}. ` +
        `The home side delivered a confident performance, taking all three points in front of their supporters ` +
        `and putting down a firm marker to the rest of the competition. ` +
        `It was a result that underlined ${homeS}'s quality and their ability to perform under pressure.`;
    } else if (winner === 'AWAY') {
      intro =
        `${away} produced an impressive ${ftH}–${ftA} victory at ${home}${labelInfix} the ${compFull} on ${matchDate}. ` +
        `The visitors were clinical throughout, travelling back with three valuable points from what is always a demanding fixture. ` +
        `It was a display that highlighted ${awayS}'s strength and their credentials as genuine contenders this season.`;
    } else {
      intro =
        `${home} and ${away} shared the spoils in a ${ftH}–${ftA} draw${labelInfix} the ${compFull} on ${matchDate}. ` +
        `In a closely fought contest, neither team could find the decisive moment that would have separated the sides, ` +
        `and both will take a point from an encounter that ultimately reflected the balance between the two squads.`;
    }
  } else if (matchState === 'LIVE') {
    intro =
      `${home} are currently locked in a ${compFull} encounter against ${away}. ` +
      `The match is live — follow the score above for real-time updates. ` +
      `Both sides are competing hard for a result that could prove significant in the context of their season.`;
  } else {
    intro =
      `${home} are set to host ${away}${labelInfix} the ${compFull} on ${matchDate}. ` +
      `The fixture promises to be a compelling contest between two sides with plenty at stake. ` +
      `Both managers will have prepared their squads meticulously, knowing that the points on offer could have a real bearing on their campaign.`;
  }

  // Result Impact
  let resultImpact: string;
  if (matchState === 'FINISHED') {
    if (winner === 'HOME') {
      resultImpact =
        `The victory delivers three vital points to ${homeS}, boosting their position and strengthening confidence heading into their next fixture. ` +
        `For ${awayS}, it is a result to put behind them quickly as they refocus on their next challenge. ` +
        `Every point in ${compFull} carries weight, and this result shapes the outlook for both clubs as the season continues.`;
    } else if (winner === 'AWAY') {
      resultImpact =
        `Three points on the road is always a significant achievement, and ${awayS} will be delighted to collect maximum points from this trip. ` +
        `${homeS} now face the task of responding in their next encounter, with this defeat a reminder of the unforgiving nature of top-level football. ` +
        `The result will have an effect on the wider standings, adding further intrigue to the ${compFull} table.`;
    } else {
      resultImpact =
        `A draw sees both teams share a point, a result that will generate mixed feelings depending on where each side sits in their campaign. ` +
        `For the team with higher ambitions, a point may feel like two dropped; for the other, it could represent a valuable addition to their tally. ` +
        `The ${compFull} table remains finely balanced, and this result adds another layer to what promises to be an exciting remainder of the season.`;
    }
  } else if (matchState === 'LIVE') {
    resultImpact =
      `With the match still ongoing, the full impact of the result remains to be seen. ` +
      `Every goal and tactical shift could prove decisive for both sides' seasons. ` +
      `The points awarded here carry real significance in ${compFull}.`;
  } else {
    resultImpact =
      `The three points on offer in this fixture will be crucial for both clubs' ambitions this season. ` +
      `A win for either side could prove to be a pivotal moment in their campaign, while a draw would leave both looking at the congested table. ` +
      `The importance of this match cannot be understated — every result in ${compFull} matters.`;
  }

  // Competition Context
  const compContext =
    `${matchLabel ? `This match formed part of ${matchLabel} of the ${compFull}` : `This fixture was contested in the ${compFull}`}. ` +
    `${compFull} is one of the most prestigious and competitive football competitions in the world, featuring the best clubs and attracting global audiences match after match. ` +
    `Follow GoalRadar for live scores, in-depth match reports, standings and full coverage of every ${compFull} fixture throughout the season.`;

  return [
    { heading: 'Introduction',        paragraphs: [intro] },
    buildFirstHalf(ctx),
    buildSecondHalf(ctx),
    { heading: 'Result Impact',       paragraphs: [resultImpact] },
    { heading: 'Competition Context', paragraphs: [compContext] },
  ];
}

// ---------------------------------------------------------------------------
// WC_GROUP template — points race, qualification push, group standings.
// No "league table". Uses "group standings" and "World Cup campaign".
// ---------------------------------------------------------------------------

function buildWCGroupReport(ctx: StoryContext): ReportSection[] {
  const {
    home, homeS, away, awayS, groupLabel, matchDate, matchState, winner, ftH, ftA, matchLabel,
  } = ctx;
  const grp  = groupLabel ? ` Group ${groupLabel}` : '';
  const grpS = groupLabel ? `Group ${groupLabel}` : 'the group';

  // Introduction
  let intro: string;
  if (matchState === 'CANCELLED') {
    intro =
      `The FIFA World Cup 2026${grp} fixture between ${home} and ${away}, scheduled for ${matchDate}, was cancelled. ` +
      `No result was recorded. Follow GoalRadar for rescheduled fixture information.`;
  } else if (matchState === 'FINISHED') {
    if (winner === 'HOME') {
      intro =
        `${home} claimed a crucial ${ftH}–${ftA} victory over ${away} in the${grp} stage of the FIFA World Cup 2026 on ${matchDate}. ` +
        `The three points strengthen ${homeS}'s position in ${grpS} and advance their World Cup qualification push. ` +
        `It was a statement performance that put the rest of the group on notice.`;
    } else if (winner === 'AWAY') {
      intro =
        `${away} produced an impressive ${ftH}–${ftA} victory over ${home} in the${grp} stage of the FIFA World Cup 2026 on ${matchDate}. ` +
        `The three points are a major boost for ${awayS}'s World Cup ambitions, moving them closer to securing knockout-round football. ` +
        `It was a display that highlighted ${awayS}'s quality on the biggest stage.`;
    } else {
      intro =
        `${home} and ${away} shared a ${ftH}–${ftA} draw in the${grp} stage of the FIFA World Cup 2026 on ${matchDate}. ` +
        `Both sides take a point from a tightly contested encounter, leaving the ${grpS} standings delicately poised. ` +
        `With further matches to come, both teams will be keeping a close eye on results elsewhere in ${grpS}.`;
    }
  } else if (matchState === 'LIVE') {
    intro =
      `${home} and ${away} are currently locked in a${grp} encounter at the FIFA World Cup 2026. ` +
      `Follow the live score above — the outcome will have major implications for the ${grpS} standings. ` +
      `A win here could prove decisive in the race to qualify for the knockout rounds.`;
  } else {
    intro =
      `${home} face ${away} in${grp} of the FIFA World Cup 2026 on ${matchDate}. ` +
      `With a place in the knockout rounds at stake, both sides are fully aware of the importance of every point in ${grpS}. ` +
      `A strong start to the group stage is crucial, and this fixture could shape who advances.`;
  }

  // Group Stage Impact
  let groupImpact: string;
  if (matchState === 'FINISHED') {
    if (winner === 'HOME') {
      groupImpact =
        `The three points are vital for ${homeS} as they push for a place in the knockout rounds. ` +
        `${awayS} must now respond quickly — with every point in ${grpS} mattering, there is no room for dropped points. ` +
        `The ${grpS} standings will be closely watched as the group stage continues.`;
    } else if (winner === 'AWAY') {
      groupImpact =
        `An outstanding three points for ${awayS}, who are firmly in control of their World Cup destiny. ` +
        `${homeS} find themselves under pressure to deliver in their remaining group fixtures. ` +
        `The ${grpS} standings take shape, and the race to qualify for the knockout stage is heating up.`;
    } else {
      groupImpact =
        `Both sides take a point from a competitive encounter. ` +
        `The ${grpS} standings remain tight, and the final round of group matches could yet decide who advances. ` +
        `Teams looking to qualify will need to monitor all results across the group carefully.`;
    }
  } else if (matchState === 'LIVE') {
    groupImpact =
      `The outcome of this${grp} match will have immediate consequences for the World Cup standings. ` +
      `Every goal matters — a single point can separate a team in contention from one facing elimination. ` +
      `Watch how the ${grpS} table shifts as this match unfolds.`;
  } else {
    groupImpact =
      `Three points in this${grp} fixture would be a major step towards securing knockout-round football. ` +
      `The group stage is unforgiving — a poor start can make qualification an uphill battle. ` +
      `Both sides know that a result here could set the tone for their entire World Cup journey.`;
  }

  // World Cup Context
  const wcContext =
    `${matchLabel ? `This match formed part of ${matchLabel} of the` : `This fixture was played in the group stage of the`} FIFA World Cup 2026. ` +
    `The tournament, hosted across the United States, Canada and Mexico, brings together 48 nations competing across 12 groups. ` +
    `The top two teams from each group advance automatically to the Round of 32, joined by the eight best third-placed teams. ` +
    `Follow GoalRadar for live scores, group standings, and full tournament coverage.`;

  return [
    { heading: 'Introduction',      paragraphs: [intro] },
    buildFirstHalf(ctx),
    buildSecondHalf(ctx),
    { heading: 'Group Stage Impact', paragraphs: [groupImpact] },
    { heading: 'FIFA World Cup 2026', paragraphs: [wcContext] },
  ];
}

// ---------------------------------------------------------------------------
// WC_KNOCKOUT template — every knockout stage.
// FORBIDDEN: three points, league table, draw helps, campaign, season standings.
// REQUIRED:  winner advances, loser eliminated, road to Final, extra time,
//            penalties, next opponent.
// ---------------------------------------------------------------------------

function buildWCKnockoutReport(ctx: StoryContext): ReportSection[] {
  const {
    home, homeS, away, awayS, matchDate, matchState, winner,
    ftH, ftA, stage, stageLabel, nextStageLabel,
  } = ctx;

  const isFinal      = stage === 'FINAL';
  const isThirdPlace = stage === 'THIRD_PLACE';
  const nextRound    = nextStageLabel ?? 'next round';

  // ── Introduction ───────────────────────────────────────────────────────────

  let intro: string;

  if (matchState === 'CANCELLED') {
    intro =
      `The FIFA World Cup 2026 ${stageLabel} between ${home} and ${away}, scheduled for ${matchDate}, was cancelled. ` +
      `No result was recorded.`;

  } else if (matchState === 'FINISHED') {
    if (isFinal) {
      if (winner === 'HOME') {
        intro =
          `${home} are the FIFA World Cup 2026 champions after a ${ftH}–${ftA} victory over ${away} in the Final on ${matchDate}. ` +
          `A historic moment for ${homeS} and their nation — the most coveted trophy in world football is theirs. ` +
          `It was a performance that will be remembered for generations.`;
      } else if (winner === 'AWAY') {
        intro =
          `${away} are the FIFA World Cup 2026 champions after a ${ftH}–${ftA} victory over ${home} in the Final on ${matchDate}. ` +
          `A historic moment for ${awayS} and their nation — the most coveted trophy in world football is theirs. ` +
          `It was a performance that will be remembered for generations.`;
      } else {
        intro =
          `${home} and ${away} could not be separated after 90 minutes in the FIFA World Cup 2026 Final on ${matchDate}, ` +
          `the score level at ${ftH}–${ftA} at full time. ` +
          `The world championship would be decided in extra time — and if necessary, a penalty shootout.`;
      }
    } else if (isThirdPlace) {
      if (winner === 'HOME') {
        intro =
          `${home} claimed third place at the FIFA World Cup 2026 with a ${ftH}–${ftA} victory over ${away} in the Third Place Play-off on ${matchDate}. ` +
          `${homeS} leave the tournament with a bronze medal, a fitting reward for a remarkable World Cup run.`;
      } else if (winner === 'AWAY') {
        intro =
          `${away} claimed third place at the FIFA World Cup 2026 with a ${ftH}–${ftA} victory over ${home} in the Third Place Play-off on ${matchDate}. ` +
          `${awayS} leave the tournament with a bronze medal, a fitting reward for a remarkable World Cup run.`;
      } else {
        intro =
          `${home} and ${away} were level at ${ftH}–${ftA} after 90 minutes in the FIFA World Cup 2026 Third Place Play-off on ${matchDate}. ` +
          `The match would go to extra time to determine who claims the bronze medal.`;
      }
    } else {
      if (winner !== 'DRAW') {
        const adv = winner === 'HOME' ? homeS : awayS;
        const eli = winner === 'HOME' ? awayS : homeS;
        intro =
          `${adv} advance to the ${nextRound} of the FIFA World Cup 2026 after a ${ftH}–${ftA} ${stageLabel} victory over ${eli} on ${matchDate}. ` +
          `${eli}'s World Cup journey comes to an end — eliminated at the ${stageLabel}. ` +
          `It was a hard-fought knockout tie that ${adv} ultimately won when it mattered most.`;
      } else {
        intro =
          `${home} and ${away} could not be separated after 90 minutes in this FIFA World Cup 2026 ${stageLabel} on ${matchDate}, ` +
          `the score level at ${ftH}–${ftA} at full time. ` +
          `In knockout football there must be a winner — the match would continue into extra time, and if still level, a penalty shootout.`;
      }
    }

  } else if (matchState === 'LIVE') {
    if (isFinal) {
      intro =
        `${home} and ${away} are facing off in the FIFA World Cup 2026 Final, with the world watching. ` +
        `Follow the live score above — one team is playing for the right to be called World Champion. ` +
        `This is the biggest match in football.`;
    } else {
      intro =
        `${home} and ${away} are locked in a FIFA World Cup 2026 ${stageLabel}, with everything on the line. ` +
        `Follow the live score above — the winner advances to the ${nextRound}, the loser is eliminated. ` +
        `This is knockout football at its most intense.`;
    }

  } else {
    // UPCOMING
    if (isFinal) {
      intro =
        `${home} face ${away} in the FIFA World Cup 2026 Final on ${matchDate} — the culmination of the greatest tournament on earth. ` +
        `One team will be crowned World Champion. ` +
        `The world will be watching as these two nations battle for the ultimate prize in football.`;
    } else if (isThirdPlace) {
      intro =
        `${home} take on ${away} in the FIFA World Cup 2026 Third Place Play-off on ${matchDate}. ` +
        `Both sides were beaten in the Semi-finals and now compete for the bronze medal and a final chance to finish on the podium. ` +
        `Third place at a World Cup is a proud achievement, and both teams will be determined to end their tournament on a high.`;
    } else {
      intro =
        `${home} face ${away} in the FIFA World Cup 2026 ${stageLabel} on ${matchDate}. ` +
        `The winner advances to the ${nextRound} — the loser is eliminated. ` +
        `There is no second chance in knockout football: just 90 minutes to determine which nation continues their World Cup journey.`;
    }
  }

  // ── Road to the Final / The World Cup Champion / The Bronze Medal ──────────

  let roadHeading: string;
  let road: string;

  if (isFinal) {
    roadHeading = 'The World Cup Champion';
    if (matchState === 'FINISHED') {
      const champion = winner === 'HOME' ? homeS : winner === 'AWAY' ? awayS : null;
      if (champion) {
        road =
          `${champion} are World Champions — the pinnacle of international football achieved on the grandest stage. ` +
          `The journey through the tournament, the knockouts won, the rivals overcome — it all culminates in this historic moment. ` +
          `${champion} will forever be remembered as the 2026 FIFA World Cup champions.`;
      } else {
        road =
          `The World Cup Final goes beyond 90 minutes. ` +
          `Extra time will be played, and if the scores remain level after 30 additional minutes, a penalty shootout decides which nation is crowned champion. ` +
          `Every moment of extra time in a World Cup Final is etched into football history.`;
      }
    } else if (matchState === 'LIVE') {
      road =
        `One 90-minute performance stands between these two nations and immortality. ` +
        `The FIFA World Cup trophy is within reach — the nation that holds it after tonight will be remembered forever. ` +
        `Follow GoalRadar for live updates, goals, and the moment the champion is crowned.`;
    } else {
      road =
        `The FIFA World Cup 2026 Final is the culmination of a month of extraordinary football. ` +
        `Both ${homeS} and ${awayS} have earned the right to compete for the greatest prize in sport, defeating all opponents to reach this moment. ` +
        `One team will be crowned World Champion — follow GoalRadar for full pre-match build-up, live coverage and analysis.`;
    }

  } else if (isThirdPlace) {
    roadHeading = 'The Bronze Medal';
    if (matchState === 'FINISHED') {
      const bronze = winner === 'HOME' ? homeS : winner === 'AWAY' ? awayS : null;
      if (bronze) {
        road =
          `${bronze} finish the FIFA World Cup 2026 in third place — an outstanding achievement at the world's greatest tournament. ` +
          `The bronze medal is a reward for a remarkable run, and one that the players and their nation will cherish. ` +
          `Meanwhile, the two finalists prepare for the ultimate encounter.`;
      } else {
        road =
          `The Third Place Play-off goes to extra time. ` +
          `Both nations are determined to finish on the podium — the bronze medal remains the prize for the winner.`;
      }
    } else if (matchState === 'LIVE') {
      road =
        `The bronze medal hangs in the balance as this Third Place Play-off continues. ` +
        `Both ${homeS} and ${awayS} are playing for more than just pride — finishing on the World Cup podium is a historic achievement. ` +
        `Follow GoalRadar for live updates.`;
    } else {
      road =
        `Third place at the FIFA World Cup is a prestigious finish. ` +
        `Both ${homeS} and ${awayS} have the chance to end their tournament on the podium. ` +
        `While the Final dominates the headlines, the Third Place Play-off is a fiercely competitive match in its own right.`;
    }

  } else {
    roadHeading = 'Road to the Final';
    if (matchState === 'FINISHED') {
      if (winner !== 'DRAW') {
        const adv = winner === 'HOME' ? homeS : awayS;
        const eli = winner === 'HOME' ? awayS : homeS;
        road =
          `${adv} advance to the ${nextRound} — one step closer to a World Cup Final appearance. ` +
          `${eli} are eliminated, their 2026 World Cup over${nextStageLabel === 'Final' ? `. For ${adv}, one game separates them from the ultimate prize` : ''}. ` +
          `The road to the Final continues for ${adv}.`;
      } else {
        road =
          `A knockout match requires a winner. ` +
          `Extra time will be played, and if the score remains level after 30 additional minutes, a penalty shootout will determine who advances to the ${nextRound}. ` +
          `In World Cup knockout football, every save, every kick and every decision can define a nation's legacy.`;
      }
    } else if (matchState === 'LIVE') {
      road =
        `The winner of this ${stageLabel} advances to the ${nextRound} — every goal brings one nation closer to the Final. ` +
        `The loser faces immediate elimination, their World Cup over. ` +
        `Follow GoalRadar for live updates as this knockout battle unfolds.`;
    } else {
      road =
        `The winner of this ${stageLabel} advances to the ${nextRound}, moving one step closer to a potential World Cup Final. ` +
        `There is no second chance in knockout football — each team must deliver when it matters most. ` +
        `Follow GoalRadar for live coverage, match analysis, and the full road to the Final.`;
    }
  }

  // ── FIFA World Cup 2026 Context ────────────────────────────────────────────

  let wcContext: string;
  if (isFinal) {
    wcContext =
      `The FIFA World Cup 2026 Final is the last match of the 104-game tournament, hosted across the United States, Canada and Mexico. ` +
      `Forty-eight nations began the journey on 11 June 2026, competing through group stages and knockout rounds to reach this moment. ` +
      `Follow GoalRadar for post-match analysis and the full story of the 2026 World Cup.`;
  } else if (isThirdPlace) {
    wcContext =
      `The FIFA World Cup 2026 Third Place Play-off takes place as the tournament approaches its conclusion. ` +
      `Hosted across the United States, Canada and Mexico, the competition brought together 48 nations in 104 matches. ` +
      `Follow GoalRadar for full World Cup 2026 coverage.`;
  } else {
    wcContext =
      `This ${stageLabel} is part of the FIFA World Cup 2026 knockout stage, hosted across the United States, Canada and Mexico. ` +
      `The tournament began with 48 teams across 12 groups, and the field has narrowed to the best teams remaining. ` +
      `Follow GoalRadar for live scores, match reports, and the complete road to the Final.`;
  }

  return [
    { heading: 'Introduction',  paragraphs: [intro] },
    buildFirstHalf(ctx),
    buildSecondHalf(ctx),
    { heading: roadHeading,     paragraphs: [road] },
    { heading: 'FIFA World Cup 2026', paragraphs: [wcContext] },
  ];
}

// ---------------------------------------------------------------------------
// Main entry point — ONE source, routes to the correct template
// ---------------------------------------------------------------------------

export function buildStoryReport(ctx: StoryContext): ReportSection[] {
  switch (ctx.matchType) {
    case 'WC_GROUP':   return buildWCGroupReport(ctx);
    case 'WC_KNOCKOUT': return buildWCKnockoutReport(ctx);
    default:           return buildStandardReport(ctx);
  }
}

// ---------------------------------------------------------------------------
// Story Cards — DATA-18WC.EXPERIENCE.V2
//
// Rule engine: given a MatchDetail, return an array of StoryCard objects.
// These are pure UI hints — no data fetching, no engine duplication.
// Each card has a type (drives icon + colour), a headline, and a body.
//
// NEVER emit cards for WC knockout if they contain "three points", "table",
// or "campaign" language. Use STAGE_LABELS and winner/loser framing only.
// ---------------------------------------------------------------------------

export type StoryCardType =
  | 'WINNER_ADVANCES'
  | 'LOSER_ELIMINATED'
  | 'QUALIFIED'
  | 'MUST_WIN'
  | 'CAN_STILL_QUALIFY'
  | 'HOST_NATION'
  | 'FIRST_WC_MEETING'
  | 'FINAL_COUNTDOWN'
  | 'PENALTY_DRAMA'
  | 'EXTRA_TIME';

export interface StoryCard {
  type:     StoryCardType;
  icon:     string;
  headline: string;
  body:     string;
}

export function buildStoryCards(match: MatchDetail): StoryCard[] {
  const cards: StoryCard[] = [];
  const ctx = buildStoryContext(match);
  const { home, homeS, away, awayS, matchType, stage, stageLabel, matchState, winner } = ctx;

  const isWCKnockout = matchType === 'WC_KNOCKOUT';
  const isWCGroup    = matchType === 'WC_GROUP';
  const isFinished   = matchState === 'FINISHED';
  const isLive       = matchState === 'LIVE';
  const isUpcoming   = matchState === 'UPCOMING';

  // ── WC Knockout cards ─────────────────────────────────────────────────────

  if (isWCKnockout) {
    if (isFinished && winner && winner !== 'DRAW') {
      const adv = winner === 'HOME' ? homeS : awayS;
      const eli = winner === 'HOME' ? awayS : homeS;
      const nextLabel = STAGE_NEXT[stage] ?? 'next round';

      cards.push({
        type: 'WINNER_ADVANCES',
        icon: '🏆',
        headline: `${adv} advance`,
        body: `${adv} are through to the ${nextLabel} of the FIFA World Cup 2026.`,
      });

      cards.push({
        type: 'LOSER_ELIMINATED',
        icon: '💔',
        headline: `${eli} eliminated`,
        body: `${eli}'s World Cup 2026 journey is over after this ${stageLabel} exit.`,
      });
    }

    if (isFinished && match.score?.duration === 'PENALTY_SHOOTOUT') {
      cards.push({
        type: 'PENALTY_DRAMA',
        icon: '🥅',
        headline: 'Won on penalties',
        body: `The ${stageLabel} went all the way to a penalty shootout — the most nerve-shredding finish in football.`,
      });
    } else if (isFinished && match.score?.duration === 'EXTRA_TIME') {
      cards.push({
        type: 'EXTRA_TIME',
        icon: '⏱️',
        headline: 'Decided in extra time',
        body: `Ninety minutes couldn't separate these sides — a goal in extra time settled this World Cup ${stageLabel}.`,
      });
    }

    if (isUpcoming && stage === 'FINAL') {
      cards.push({
        type: 'FINAL_COUNTDOWN',
        icon: '🌍',
        headline: 'World Cup Final',
        body: `${home} vs ${away} — one match decides the FIFA World Cup 2026 champion.`,
      });
    }

    if ((isUpcoming || isLive) && winner === null) {
      const nextLabel = STAGE_NEXT[stage] ?? 'next round';
      cards.push({
        type: 'WINNER_ADVANCES',
        icon: '⚡',
        headline: 'Winner advances',
        body: `The winner of this ${stageLabel} progresses to the ${nextLabel}. The loser exits the World Cup.`,
      });
    }
  }

  // ── WC Group cards ────────────────────────────────────────────────────────

  if (isWCGroup) {
    // Host nation card — check if either team is a WC host (USA, Canada, Mexico)
    const HOST_NAMES = ['United States', 'USA', 'Canada', 'Mexico'];
    const homeIsHost = HOST_NAMES.some((n) => home.includes(n));
    const awayIsHost = HOST_NAMES.some((n) => away.includes(n));
    if (homeIsHost || awayIsHost) {
      const host = homeIsHost ? homeS : awayS;
      cards.push({
        type: 'HOST_NATION',
        icon: '🏠',
        headline: `${host} — Host Nation`,
        body: `${host} are competing on home soil at FIFA World Cup 2026, hosted across the USA, Canada and Mexico.`,
      });
    }
  }

  return cards;
}

// ---------------------------------------------------------------------------
// Group-level story cards — derived from standing entries + qual status
// ---------------------------------------------------------------------------

const HOST_NATIONS = new Set(['United States', 'USA', 'Canada', 'Mexico']);

export function buildGroupStoryCards(
  tableEntries: StandingEntry[],
  qualMap:      Map<number, QualificationStatus>,
): StoryCard[] {
  const cards: StoryCard[] = [];

  const sorted = [...tableEntries].sort((a, b) => a.position - b.position);

  for (const entry of sorted) {
    const name  = entry.team.shortName || entry.team.name;
    const qual  = qualMap.get(entry.team.id);

    if (qual === 'QUALIFIED') {
      cards.push({
        type:     'QUALIFIED',
        icon:     '✅',
        headline: `${name} qualified`,
        body:     `${name} have secured their place in the knockout round of FIFA World Cup 2026.`,
      });
    }

    if (qual === 'ELIMINATED') {
      cards.push({
        type:     'LOSER_ELIMINATED',
        icon:     '💔',
        headline: `${name} eliminated`,
        body:     `${name} are out of FIFA World Cup 2026 and cannot advance to the knockout stage.`,
      });
    }

    if (HOST_NATIONS.has(entry.team.name) || HOST_NATIONS.has(entry.team.shortName ?? '')) {
      cards.push({
        type:     'HOST_NATION',
        icon:     '🏠',
        headline: `${name} — Host Nation`,
        body:     `${name} are playing on home soil at FIFA World Cup 2026, co-hosted across the USA, Canada and Mexico.`,
      });
    }
  }

  // Leader card — only once all teams have played at least 1 game and nobody is qualified yet
  const allUndecided = sorted.every((e) => {
    const q = qualMap.get(e.team.id);
    return q === 'UNDECIDED' || q === 'THIRD_PLACE_CONTENDER';
  });
  const leader = sorted[0];
  if (allUndecided && leader && leader.playedGames > 0) {
    const leaderName = leader.team.shortName || leader.team.name;
    cards.push({
      type:     'MUST_WIN',
      icon:     '📊',
      headline: `${leaderName} lead the group`,
      body:     `${leaderName} top the group on ${leader.points} point${leader.points !== 1 ? 's' : ''} with ${leader.playedGames} match${leader.playedGames !== 1 ? 'es' : ''} played.`,
    });
  }

  return cards;
}

// ---------------------------------------------------------------------------
// Round-level story cards — derived from Match[] (knockout round page)
// ---------------------------------------------------------------------------

export function buildRoundStoryCards(matches: Match[], stage: string): StoryCard[] {
  const cards: StoryCard[] = [];

  const stageLabel = STAGE_LABELS[stage] ?? 'match';
  const nextLabel  = STAGE_NEXT[stage]   ?? 'next round';

  for (const m of matches) {
    if (m.status !== 'FINISHED') continue;

    const winner =
      m.score?.winner === 'HOME_TEAM' ? m.homeTeam
      : m.score?.winner === 'AWAY_TEAM' ? m.awayTeam
      : null;

    const loser = winner
      ? (m.score?.winner === 'HOME_TEAM' ? m.awayTeam : m.homeTeam)
      : null;

    if (winner) {
      const advName = winner.shortName || winner.name;
      cards.push({
        type:     'WINNER_ADVANCES',
        icon:     '🏆',
        headline: `${advName} advance`,
        body:     stage === 'FINAL'
          ? `${advName} are FIFA World Cup 2026 champions.`
          : `${advName} are through to the ${nextLabel}.`,
      });
    }

    if (loser) {
      const eliName = loser.shortName || loser.name;
      cards.push({
        type:     'LOSER_ELIMINATED',
        icon:     '💔',
        headline: `${eliName} eliminated`,
        body:     `${eliName}'s World Cup 2026 campaign ends in the ${stageLabel}.`,
      });
    }

    if (m.score?.duration === 'PENALTY_SHOOTOUT') {
      const h = m.homeTeam?.shortName || m.homeTeam?.name || '?';
      const a = m.awayTeam?.shortName || m.awayTeam?.name || '?';
      cards.push({
        type:     'PENALTY_DRAMA',
        icon:     '🥅',
        headline: 'Penalty drama',
        body:     `${h} vs ${a} required a penalty shootout to separate these sides.`,
      });
    }
  }

  // Upcoming final card
  const finalMatch = stage === 'FINAL' ? matches.find((m) => m.status !== 'FINISHED') : null;
  if (finalMatch) {
    const h = finalMatch.homeTeam?.shortName || finalMatch.homeTeam?.name || 'TBD';
    const a = finalMatch.awayTeam?.shortName || finalMatch.awayTeam?.name || 'TBD';
    cards.push({
      type:     'FINAL_COUNTDOWN',
      icon:     '🌍',
      headline: 'World Cup Final',
      body:     `${h} vs ${a} — the match that crowns the FIFA World Cup 2026 champion.`,
    });
  }

  return cards;
}
