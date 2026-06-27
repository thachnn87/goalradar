/**
 * DATA-14B: Deep inspect production match page HTML for:
 * - GoalsSection content
 * - MatchStatistics values
 * - FAQ scorer list
 */

const MATCHES = [
  { fdId: '537364', label: 'Iran 2–2 New Zealand',    slug: '537364-iran-vs-new-zealand',   expectedGoals: 4 },
  { fdId: '537358', label: 'Sweden 5–1 Tunisia',      slug: '537358-sweden-vs-tunisia',      expectedGoals: 6 },
  { fdId: '537357', label: 'Netherlands 2–2 Japan',   slug: '537357-netherlands-vs-japan',   expectedGoals: 4 },
  { fdId: '537352', label: 'Ivory Coast 1–0 Ecuador', slug: '537352-ivory-coast-vs-ecuador', expectedGoals: 1 },
];

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 GoalRadar-Audit/1.0' },
    redirect: 'follow',
  });
  if (!res.ok) return null;
  return res.text();
}

// Extract text content between two labels
function extractBetween(html, startLabel, endLabel) {
  const si = html.indexOf(startLabel);
  if (si === -1) return null;
  const ei = html.indexOf(endLabel, si + startLabel.length);
  return ei === -1 ? html.slice(si, si + 2000) : html.slice(si, ei + endLabel.length);
}

// Extract all numbers that look like minute markers near a "GOALS" heading
function extractGoalMinutes(html) {
  // Look for minutes pattern (e.g. 7', 43', 90') in HTML between GOALS and BOOKINGS
  const goalsSection = extractBetween(html, 'GOALS', 'BOOKINGS') ??
                       extractBetween(html, 'Goals', 'Bookings') ??
                       '';
  const minutes = [...goalsSection.matchAll(/(\d{1,3})'(?:\+\d+')?/g)].map(m => m[0]);
  return [...new Set(minutes)];
}

// Extract statistics numbers from the statistics table
function extractStats(html) {
  // Find "Match Statistics" section and extract numbers
  const statsSection = extractBetween(html, 'Match Statistics', 'Possession');
  if (!statsSection) {
    // Try finding the goals/cards/subs rows
    const alt = extractBetween(html, 'Goals', 'Possession') ??
                extractBetween(html, 'statistics', 'head-to-head') ?? '';
    // Look for pattern like: number ... Goals ... number
    const rows = alt.match(/(\d+)[^0-9]+Goals[^0-9]+(\d+)/i);
    return rows ? { goalsHome: rows[1], goalsAway: rows[2] } : null;
  }
  return statsSection;
}

// Look for FAQ / scorer list in HTML
function extractScorers(html) {
  const faqSection = extractBetween(html, 'Who scored', '?') ?? '';
  return faqSection.slice(0, 300);
}

for (const m of MATCHES) {
  console.log(`\n══ ${m.label} (FD:${m.fdId}) ══`);
  const url = `https://goalradar.org/match/${m.slug}`;
  const html = await fetchPage(url);

  if (!html) { console.log('  FETCH FAILED'); continue; }
  console.log(`  Page size: ${html.length} bytes`);

  // Meta description
  const descMatch = html.match(/name="description"[^>]+content="([^"]+)"/i) ||
                    html.match(/content="([^"]+)"[^>]+name="description"/i);
  const desc = descMatch?.[1] ?? '(not found)';
  console.log(`  Meta description: ${desc.slice(0, 200)}`);

  // Goal minutes
  const minutes = extractGoalMinutes(html);
  console.log(`  Goal minutes in page: [${minutes.join(', ')}]  (expected ${m.expectedGoals} goals)`);

  // Look for specific scorer names
  const scorerNames = {
    '537364': ['Just', 'Rezaeian', 'Mohebbi', 'Elijah'],
    '537358': ['Rekik', 'Ayari', 'Isak', 'Gyökeres', 'Svanberg'],
    '537357': ['van Dijk', 'Nakamura', 'Summerville', 'Kamada'],
    '537352': ['Amad Diallo'],
  }[m.fdId] ?? [];

  for (const name of scorerNames) {
    const count = (html.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
    console.log(`    "${name}": ${count} occurrences in HTML`);
  }

  // Statistics panel - look for Goals row
  // The stats component renders: <span>N</span> Goals <span>N</span>
  const statsGoalMatch = html.match(/(\d+)<\/span>\s*<\/div>\s*<span[^>]*>[^<]*<\/span>\s*<\/div>[\s\S]{0,50}Goals/i) ||
                         html.match(/Goals[\s\S]{0,100}?(\d+)\s*–\s*(\d+)/i);
  if (statsGoalMatch) {
    console.log(`  Stats Goals row found: ${statsGoalMatch[0].slice(0,100)}`);
  }

  // Look for "0" appearing in a statistics context — the 0-0 bug
  const zeroZero = html.match(/<span[^>]*>0<\/span>[^<]*<\/div>\s*[\s\S]{0,200}Goals[\s\S]{0,200}<span[^>]*>0<\/span>/i);
  if (zeroZero) {
    console.log(`  ⚠ Statistics panel appears to show 0-0 (found 0...Goals...0 pattern)`);
  }

  // Count how many times each stat row value appears near "Goals"/"Yellow Cards"/"Substitutions"
  // Check for text in the statistics section that isn't 0-0
  const statSection = extractBetween(html, 'Statistics computed from', 'Possession and shot data') ??
                      extractBetween(html, 'Match Statistics', 'Head to Head') ?? '';
  if (statSection) {
    const numMatches = statSection.match(/\b([0-9]+)\b/g) ?? [];
    console.log(`  Numbers in stats section: [${numMatches.slice(0, 20).join(', ')}]`);
  }

  // FAQ - check for scorer mention
  if (html.includes('scored')) {
    const scoredIdx = html.indexOf('scored');
    console.log(`  FAQ around "scored": ...${html.slice(Math.max(0, scoredIdx-50), scoredIdx+200).replace(/\s+/g, ' ')}...`);
  }
}
