/**
 * DATA-14A deep audit: dump ALL keyEvent types for target matches.
 * Specifically investigates Iran vs NZ and Netherlands vs Japan for missing goals.
 */

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';

async function espnFetch(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function clockToMinute(displayValue, periodNumber) {
  const [minStr] = (displayValue || '0:00').split(':');
  const min = parseInt(minStr, 10) || 0;
  if (periodNumber === 1) return min;
  if (periodNumber === 2) return min < 45 ? 45 + min : min;
  if (periodNumber === 3) return min < 90 ? 90 + min : min;
  return min;
}

async function dumpAllEvents(espnId, label) {
  console.log(`\n══ ${label} (ESPN ${espnId}) ══`);
  const data = await espnFetch(`${ESPN_BASE}/summary?event=${espnId}`);
  const keyEvents = data.keyEvents ?? [];

  console.log(`Total keyEvents: ${keyEvents.length}`);

  // Print every event
  for (const ev of keyEvents) {
    const min = clockToMinute(ev.clock?.displayValue, ev.period?.number ?? 1);
    const pts = (ev.participants ?? []).map(p => p.athlete?.displayName).join(', ');
    const team = ev.team?.displayName ?? '-';
    const typeId = ev.type?.id ?? '?';
    const typeText = ev.type?.text ?? '?';
    const isScoring = ev.scoringPlay ? '⚽' : '  ';
    console.log(`  ${isScoring} ${String(min).padStart(3)}' [${typeId}:${typeText.padEnd(20)}] team=${team.padEnd(15)} | ${pts || '(no participants)'}`);
    if (ev.text) console.log(`       text="${ev.text.slice(0, 120)}"`);
  }

  // Summary of all type IDs
  const typeCounts = {};
  for (const ev of keyEvents) {
    const k = `${ev.type?.id}:${ev.type?.text}`;
    typeCounts[k] = (typeCounts[k] ?? 0) + 1;
  }
  console.log('\n  Type ID summary:');
  for (const [k, n] of Object.entries(typeCounts)) {
    console.log(`    ${n}x ${k}`);
  }

  // Specifically show scoring plays
  const scoring = keyEvents.filter(e => e.scoringPlay === true);
  console.log(`\n  Scoring plays (scoringPlay=true): ${scoring.length}`);
  for (const ev of scoring) {
    const min = clockToMinute(ev.clock?.displayValue, ev.period?.number ?? 1);
    const pts = (ev.participants ?? []).map(p => p.athlete?.displayName).join(', ');
    console.log(`    ${min}' [${ev.type?.id}:${ev.type?.text}] ${ev.team?.displayName} | ${pts}`);
  }

  // Roster info
  if (data.rosters?.length) {
    console.log('\n  Rosters:');
    for (const roster of data.rosters) {
      const starters = (roster.roster ?? []).filter(p => p.starter);
      const subs     = (roster.roster ?? []).filter(p => !p.starter);
      console.log(`    ${roster.team?.displayName}: ${starters.length} starters, ${subs.length} subs`);
      // Show starters
      for (const p of starters) {
        const pos = p.position?.abbreviation ?? '?';
        const fp  = p.formationPlace ?? '-';
        console.log(`      #${p.jersey} ${p.athlete?.displayName} [${pos}] fp=${fp} subbedOut=${p.subbedOut} subbedIn=${p.subbedIn}`);
      }
    }
  }

  return data;
}

async function main() {
  // Iran vs New Zealand
  await dumpAllEvents('760427', 'Iran vs New Zealand');

  // Sweden vs Tunisia — confirm Tunisia goal type
  await dumpAllEvents('760424', 'Sweden vs Tunisia');

  // Netherlands vs Japan
  await dumpAllEvents('760425', 'Netherlands vs Japan');

  // Ivory Coast vs Ecuador — also dump to confirm
  await dumpAllEvents('760423', 'Ivory Coast vs Ecuador');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
