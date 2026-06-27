/**
 * DATA-14A ESPN enrichment audit script.
 * Run: node scripts/data14a_audit.mjs
 *
 * Queries ESPN scoreboard + summary for WC 2026 matches.
 * Outputs event counts, goal details, and any mismatches.
 */

const ESPN_BASE   = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const TIMEOUT_MS  = 15_000;

// Known FINISHED WC 2026 matches from football-data.org (id → score label)
const KNOWN_MATCHES = [
  // Group Stage Day 1 (June 12, 2026)
  { fdId: '537352', home: 'Ivory Coast',  away: 'Ecuador',    score: '1-0', utcDate: '2026-06-12' },
  { fdId: '537358', home: 'Sweden',       away: 'Tunisia',    score: '5-1', utcDate: '2026-06-15' },
  { fdId: '537364', home: 'Iran',         away: 'New Zealand',score: '2-2', utcDate: '2026-06-16' },
  // Add Netherlands vs Japan
  { fdId: '537370', home: 'Netherlands',  away: 'Japan',      score: '?',   utcDate: '2026-06-13' },
  { fdId: '537371', home: 'Japan',        away: 'Netherlands',score: '?',   utcDate: '2026-06-13' },
];

async function espnFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function normaliseName(name) {
  const aliases = {
    'united states': 'usa', 'united states men': 'usa',
    "côte d'ivoire": 'ivory coast', "cote d'ivoire": 'ivory coast',
    'trinidad & tobago': 'trinidad and tobago',
    'korea republic': 'south korea',
    'czechia': 'czech republic',
    'bosnia-herzegovina': 'bosnia',
    'cape verde islands': 'cape verde',
    'república dominicana': 'dominican republic',
  };
  const stripped = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return aliases[stripped] ?? stripped;
}

async function fetchScoreboard(dateStr) {
  const url = `${ESPN_BASE}/scoreboard?dates=${dateStr}`;
  try {
    const data = await espnFetch(url);
    return data.events ?? [];
  } catch (e) {
    console.error(`  scoreboard fetch failed for ${dateStr}: ${e.message}`);
    return [];
  }
}

async function fetchSummary(eventId) {
  const url = `${ESPN_BASE}/summary?event=${eventId}`;
  try {
    return await espnFetch(url);
  } catch (e) {
    console.error(`  summary fetch failed for event ${eventId}: ${e.message}`);
    return null;
  }
}

function findMatchInEvents(events, normHome, normAway) {
  for (const ev of events) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const home = comp.competitors.find(c => c.homeAway === 'home');
    const away = comp.competitors.find(c => c.homeAway === 'away');
    if (!home || !away) continue;
    if (
      normaliseName(home.team.displayName) === normHome &&
      normaliseName(away.team.displayName) === normAway
    ) return ev;
    if (
      normaliseName(home.team.shortDisplayName ?? '') === normHome &&
      normaliseName(away.team.shortDisplayName ?? '') === normAway
    ) return ev;
  }
  return null;
}

function clockToMinute(displayValue, periodNumber) {
  const [minStr] = (displayValue || '0:00').split(':');
  const min = parseInt(minStr, 10) || 0;
  if (periodNumber === 1) return min;
  if (periodNumber === 2) return min < 45 ? 45 + min : min;
  if (periodNumber === 3) return min < 90 ? 90 + min : min;
  if (periodNumber === 4) return min < 105 ? 105 + min : min;
  return min;
}

// ────────────────────────────────────────────────────────────────────────────
// Audit: all known dates for recent WC matches
// ────────────────────────────────────────────────────────────────────────────

async function auditMatch(m) {
  const normHome = normaliseName(m.home);
  const normAway = normaliseName(m.away);

  // Try UTC date + prev day (ESPN groups by US local time)
  const [y, mo, d] = m.utcDate.split('-');
  const dateStr  = `${y}${mo}${d}`;
  const prevDate = (() => {
    const dd = new Date(Date.UTC(+y, +mo - 1, +d - 1));
    return `${dd.getUTCFullYear()}${String(dd.getUTCMonth()+1).padStart(2,'0')}${String(dd.getUTCDate()).padStart(2,'0')}`;
  })();

  let espnEvent = null;
  let usedDate  = null;

  for (const date of [dateStr, prevDate]) {
    const events = await fetchScoreboard(date);
    const found  = findMatchInEvents(events, normHome, normAway);
    if (found) { espnEvent = found; usedDate = date; break; }
  }

  if (!espnEvent) {
    return {
      fdId:      m.fdId,
      matchLabel: `${m.home} vs ${m.away}`,
      fdScore:   m.score,
      espnId:    null,
      resolution: 'NOT_FOUND',
      datesTried: [dateStr, prevDate],
      goals: [], bookings: [], substitutions: [],
      rawGoalCount: 0, rawBookingCount: 0, rawSubCount: 0,
      keyEventTypes: [],
    };
  }

  const summary = await fetchSummary(espnEvent.id);
  const keyEvents = summary?.keyEvents ?? [];

  // Group by type
  const goalEvents    = keyEvents.filter(e => e.type?.id === '70');
  const bookingEvents = keyEvents.filter(e => ['94','95','96'].includes(e.type?.id ?? ''));
  const subEvents     = keyEvents.filter(e => e.type?.id === '76');

  // Parse goals with full detail
  const goals = goalEvents.map(ev => {
    const participants = ev.participants ?? [];
    const scorer  = participants[0];
    const assist  = participants[1];
    const minute  = clockToMinute(ev.clock?.displayValue, ev.period?.number ?? 1);
    return {
      minute,
      team:      ev.team?.displayName ?? 'unknown',
      teamId:    ev.team?.id ?? null,
      scorer:    scorer?.athlete?.displayName ?? '(no participant)',
      assist:    assist?.athlete?.displayName ?? null,
      typeText:  ev.type?.text,
      scoringPlay: ev.scoringPlay ?? false,
      text:      ev.text ?? ev.shortText ?? '',
    };
  });

  // Unique type IDs found across all keyEvents
  const typesSeen = [...new Set(keyEvents.map(e => `${e.type?.id}:${e.type?.text}`))];

  // ESPN scoreboard score
  const comp      = espnEvent.competitions?.[0];
  const homeComp  = comp?.competitors?.find(c => c.homeAway === 'home');
  const awayComp  = comp?.competitors?.find(c => c.homeAway === 'away');
  const espnScore = `${homeComp?.score ?? '?'}-${awayComp?.score ?? '?'}`;

  return {
    fdId:         m.fdId,
    matchLabel:   `${m.home} vs ${m.away}`,
    fdScore:      m.score,
    espnScore,
    espnId:       espnEvent.id,
    resolution:   usedDate === dateStr ? 'direct' : 'prev-day',
    usedDate,
    goals,
    rawGoalCount:    goalEvents.length,
    rawBookingCount: bookingEvents.length,
    rawSubCount:     subEvents.length,
    keyEventTypes:   typesSeen,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Lineups research: check summary and boxscore endpoints
// ────────────────────────────────────────────────────────────────────────────

async function researchLineups(espnId) {
  if (!espnId) return null;

  const summary = await espnFetch(`${ESPN_BASE}/summary?event=${espnId}`).catch(() => null);
  if (!summary) return null;

  const hasRosters  = !!summary.rosters?.length;
  const hasBoxscore = !!(summary.boxscore);
  const topKeys     = Object.keys(summary).filter(k => !['header','keyEvents','plays','scoringPlays'].includes(k));

  // Check gamecast endpoint
  let gamecastKeys = [];
  try {
    const gc = await espnFetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${espnId}&lang=en&region=us`).catch(() => null);
    if (gc) gamecastKeys = Object.keys(gc);
  } catch (_) {}

  // Inspect rosters
  let rosterSample = null;
  if (summary.rosters?.length) {
    const r = summary.rosters[0];
    rosterSample = {
      teamName: r.team?.displayName,
      athleteCount: r.roster?.length ?? 0,
      sampleFields: r.roster?.[0] ? Object.keys(r.roster[0]) : [],
    };
  }

  // Check boxscore
  let boxscoreSample = null;
  if (summary.boxscore) {
    boxscoreSample = {
      topKeys: Object.keys(summary.boxscore),
    };
  }

  return {
    topLevelKeys: topKeys,
    hasRosters,
    hasBoxscore,
    rosterSample,
    boxscoreSample,
    gamecastKeys,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Also scan today + recent days for any new finished WC matches
// ────────────────────────────────────────────────────────────────────────────

async function scanRecentWCMatches() {
  // Scan June 12–June 16 2026
  const dates = ['20260612','20260613','20260614','20260615','20260616'];
  const allMatches = [];
  for (const d of dates) {
    const events = await fetchScoreboard(d);
    for (const ev of events) {
      const comp = ev.competitions?.[0];
      const status = comp?.status?.type?.name ?? '';
      const home   = comp?.competitors?.find(c => c.homeAway === 'home');
      const away   = comp?.competitors?.find(c => c.homeAway === 'away');
      allMatches.push({
        date:       d,
        espnId:     ev.id,
        home:       home?.team?.displayName ?? '?',
        homeScore:  home?.score ?? '-',
        away:       away?.team?.displayName ?? '?',
        awayScore:  away?.score ?? '-',
        status,
      });
    }
  }
  return allMatches;
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== DATA-14A ESPN ENRICHMENT AUDIT ===\n');

  // Step 1: Scan all recent WC matches
  console.log('── STEP 1: Scanning WC matches June 12–16 2026 ──');
  const allWCMatches = await scanRecentWCMatches();
  // Deduplicate by espnId
  const seenIds = new Set();
  const uniqueMatches = allWCMatches.filter(m => {
    if (seenIds.has(m.espnId)) return false;
    seenIds.add(m.espnId);
    return true;
  });
  console.log(`Found ${uniqueMatches.length} unique WC matches:`);
  for (const m of uniqueMatches) {
    console.log(`  [${m.date}] ${m.espnId} | ${m.home} ${m.homeScore}-${m.awayScore} ${m.away} | ${m.status}`);
  }
  console.log();

  // Step 2: Audit each known match
  console.log('── STEP 2: Per-match event audit ──');
  const results = [];
  for (const m of KNOWN_MATCHES) {
    console.log(`\nAuditing FD:${m.fdId} ${m.home} vs ${m.away} (FD score: ${m.score})...`);
    const r = await auditMatch(m);
    results.push(r);

    if (!r.espnId) {
      console.log(`  NOT FOUND on ESPN (tried ${r.datesTried.join(', ')})`);
      continue;
    }

    console.log(`  ESPN ID: ${r.espnId} | Resolution: ${r.resolution} (${r.usedDate})`);
    console.log(`  ESPN score: ${r.espnScore} | FD score: ${r.fdScore}`);
    console.log(`  Goals parsed: ${r.rawGoalCount} | Bookings: ${r.rawBookingCount} | Subs: ${r.rawSubCount}`);

    const expectedGoals = r.fdScore !== '?' ? r.fdScore.split('-').reduce((a,b) => a + parseInt(b||'0',10), 0) : '?';
    if (r.fdScore !== '?' && r.rawGoalCount !== expectedGoals) {
      console.log(`  ⚠ GOAL MISMATCH: ESPN has ${r.rawGoalCount} goal events, score implies ${expectedGoals}`);
    }

    console.log('  Goal events:');
    for (const g of r.goals) {
      console.log(`    ${g.minute}' ${g.scorer}${g.assist ? ` (assist: ${g.assist})` : ''} — ${g.team} [teamId:${g.teamId}] type="${g.typeText}" scoringPlay=${g.scoringPlay} text="${g.text}"`);
    }

    console.log('  Key event types seen:');
    for (const t of r.keyEventTypes) {
      console.log(`    ${t}`);
    }
  }

  // Step 3: Netherlands vs Japan — search all recent dates
  console.log('\n── STEP 3: Netherlands vs Japan search ──');
  const searchDates = ['20260612','20260613','20260614','20260615','20260616'];
  let njFound = null;
  for (const d of searchDates) {
    const events = await fetchScoreboard(d);
    const m = findMatchInEvents(events, normaliseName('Netherlands'), normaliseName('Japan'));
    if (m) { njFound = { event: m, date: d }; break; }
    // Also try swapped
    const m2 = findMatchInEvents(events, normaliseName('Japan'), normaliseName('Netherlands'));
    if (m2) { njFound = { event: m2, date: d }; break; }
  }

  if (!njFound) {
    console.log('  Netherlands vs Japan: NOT FOUND on any date June 12-16');
    // Print all team names found
    const allTeams = new Set();
    for (const d of searchDates) {
      const events = await fetchScoreboard(d);
      for (const ev of events) {
        const comp = ev.competitions?.[0];
        for (const c of comp?.competitors ?? []) {
          allTeams.add(c.team?.displayName);
        }
      }
    }
    console.log('  All team names found:');
    for (const t of [...allTeams].sort()) console.log(`    "${t}"`);
  } else {
    const comp = njFound.event.competitions?.[0];
    const home = comp?.competitors?.find(c => c.homeAway === 'home');
    const away = comp?.competitors?.find(c => c.homeAway === 'away');
    console.log(`  Found: ${njFound.event.id} on ${njFound.date}`);
    console.log(`  ${home?.team?.displayName} ${home?.score} - ${away?.score} ${away?.team?.displayName}`);
    // Fetch summary
    const sum = await fetchSummary(njFound.event.id);
    const keyEvents = sum?.keyEvents ?? [];
    const goalEvs = keyEvents.filter(e => e.type?.id === '70');
    console.log(`  Goal events: ${goalEvs.length}`);
    for (const g of goalEvs) {
      const p = g.participants ?? [];
      const min = clockToMinute(g.clock?.displayValue, g.period?.number ?? 1);
      console.log(`    ${min}' ${p[0]?.athlete?.displayName ?? '(none)'} — ${g.team?.displayName}`);
    }
  }

  // Step 4: Lineups research on a known match (537352 = Ivory Coast vs Ecuador = ESPN 760423)
  console.log('\n── STEP 4: Lineups research (ESPN 760423 — Ivory Coast vs Ecuador) ──');
  const lineupsData = await researchLineups('760423');
  if (lineupsData) {
    console.log(`  Top-level summary keys: ${lineupsData.topLevelKeys.join(', ')}`);
    console.log(`  hasRosters: ${lineupsData.hasRosters}`);
    console.log(`  hasBoxscore: ${lineupsData.hasBoxscore}`);
    if (lineupsData.rosterSample) {
      const rs = lineupsData.rosterSample;
      console.log(`  Roster sample — team: ${rs.teamName}, athletes: ${rs.athleteCount}, fields: ${rs.sampleFields.join(', ')}`);
    }
    if (lineupsData.boxscoreSample) {
      console.log(`  Boxscore keys: ${lineupsData.boxscoreSample.topKeys.join(', ')}`);
    }
  }

  // Also check Iran vs NZ (760427) lineups
  console.log('\n── STEP 5: Lineups research (ESPN 760427 — Iran vs New Zealand) ──');
  const lineupsIranNZ = await researchLineups('760427');
  if (lineupsIranNZ) {
    console.log(`  Top-level summary keys: ${lineupsIranNZ.topLevelKeys.join(', ')}`);
    console.log(`  hasRosters: ${lineupsIranNZ.hasRosters}`);
    console.log(`  hasBoxscore: ${lineupsIranNZ.hasBoxscore}`);
    if (lineupsIranNZ.rosterSample) {
      const rs = lineupsIranNZ.rosterSample;
      console.log(`  Roster sample — team: ${rs.teamName}, athletes: ${rs.athleteCount}, fields: ${rs.sampleFields.join(', ')}`);
    }
    if (lineupsIranNZ.boxscoreSample) {
      console.log(`  Boxscore keys: ${lineupsIranNZ.boxscoreSample.topKeys.join(', ')}`);
    }
  }

  console.log('\n=== AUDIT COMPLETE ===');
  return results;
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
