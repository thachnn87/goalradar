/**
 * Verify the scoringPlay=true goal filter produces the correct goal counts
 * for all four audited matches.
 */
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';

async function espnFetch(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function clockToMinute(dv, p) {
  const min = parseInt((dv || '0:00').split(':')[0], 10) || 0;
  if (p === 1) return min;
  if (p === 2) return min < 45 ? 45 + min : min;
  if (p === 3) return min < 90 ? 90 + min : min;
  return min;
}

const MATCHES = [
  { id: '760423', label: 'Ivory Coast 1–0 Ecuador',    expectedGoals: 1 },
  { id: '760424', label: 'Sweden 5–1 Tunisia',         expectedGoals: 6 },
  { id: '760425', label: 'Netherlands 2–2 Japan',      expectedGoals: 4 },
  { id: '760427', label: 'Iran 2–2 New Zealand',       expectedGoals: 4 },
];

for (const m of MATCHES) {
  const data = await espnFetch(`${ESPN_BASE}/summary?event=${m.id}`);
  const keyEvents = data.keyEvents ?? [];

  // Old filter (type 70 only)
  const oldGoals = keyEvents.filter(e => e.type?.id === '70');
  // New filter (scoringPlay === true)
  const newGoals = keyEvents.filter(e => e.scoringPlay === true);

  const pass = newGoals.length === m.expectedGoals ? '✅' : '❌';
  console.log(`${pass} ${m.label}`);
  console.log(`   OLD (type=70): ${oldGoals.length}  NEW (scoringPlay): ${newGoals.length}  EXPECTED: ${m.expectedGoals}`);
  for (const g of newGoals) {
    const p = g.participants ?? [];
    const min = clockToMinute(g.clock?.displayValue, g.period?.number ?? 1);
    const scorer = p[0]?.athlete?.displayName ?? '(no participant)';
    const assist = p[1]?.athlete?.displayName;
    console.log(`     ${min}' [${g.type?.id}:${g.type?.text}] ${g.team?.displayName} — ${scorer}${assist ? ` (assist: ${assist})` : ''}`);
  }
}
