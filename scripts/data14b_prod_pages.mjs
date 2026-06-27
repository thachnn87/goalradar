/**
 * DATA-14B: Verify production pages by fetching public match pages
 * and extracting meta description + OG data to check goal counts.
 * Also fetches the /api/debug/espn-enrichment endpoint if CRON_SECRET is available.
 */

const BASE = 'https://goalradar.org';

// Known FINISHED matches that need verification
const MATCHES = [
  { fdId: '537364', label: 'Iran 2–2 New Zealand',    slug: '537364-iran-vs-new-zealand',    expectedGoals: 4 },
  { fdId: '537358', label: 'Sweden 5–1 Tunisia',      slug: '537358-sweden-vs-tunisia',       expectedGoals: 6 },
  { fdId: '537357', label: 'Netherlands 2–2 Japan',   slug: '537357-netherlands-vs-japan',    expectedGoals: 4 },
  { fdId: '537352', label: 'Ivory Coast 1–0 Ecuador', slug: '537352-ivory-coast-vs-ecuador',  expectedGoals: 1 },
];

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 GoalRadar-Audit/1.0' },
    redirect: 'follow',
  });
  if (!res.ok) return { status: res.status, html: null };
  const html = await res.text();
  return { status: res.status, html };
}

function extractMeta(html, name) {
  if (!html) return null;
  // OG or name meta tags
  const m =
    html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, 'i'));
  return m ? m[1] : null;
}

function extractTitle(html) {
  if (!html) return null;
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

// Count goal scorer lines in HTML (GoalsSection renders each goal as a div/li)
// Look for the goals section and count score-time markers
function countGoalMentions(html) {
  if (!html) return null;
  // Count occurrences of minute markers in the goals section (e.g. "90'", "7'", "43'")
  // Also count scorer names in the meta description
  return null;
}

console.log('=== DATA-14B Production Page Verification ===\n');

for (const m of MATCHES) {
  console.log(`── ${m.label} (FD:${m.fdId}) ──`);

  // Try the slug URL first, then the bare ID URL
  const slugUrl = `${BASE}/match/${m.slug}`;
  const bareUrl = `${BASE}/match/${m.fdId}`;

  console.log(`  URL: ${slugUrl}`);
  const { status, html } = await fetchPage(slugUrl);
  console.log(`  HTTP status: ${status}`);

  if (!html) {
    console.log(`  ERROR: no response`);
    console.log();
    continue;
  }

  const title = extractTitle(html);
  const desc  = extractMeta(html, 'description') || extractMeta(html, 'og:description');
  const ogTitle = extractMeta(html, 'og:title');

  console.log(`  Title: ${title}`);
  console.log(`  Meta description: ${desc}`);

  // Look for goal scorer names in meta description
  const goalKeywords = ['Goals:', 'goal', 'scorer'];
  const hasGoalData = desc && goalKeywords.some(k => desc.toLowerCase().includes(k.toLowerCase()));

  console.log(`  Has goal data in meta: ${hasGoalData ? 'YES' : 'NO'}`);

  // Count goal time markers in the description
  const minuteMatches = desc?.match(/\d+'/g) ?? [];
  console.log(`  Goal minutes in description: ${minuteMatches.join(', ') || '(none)'}`);
  console.log(`  Expected goals: ${m.expectedGoals}`);

  // Check if description contains expected names for Iran vs NZ
  if (m.fdId === '537364') {
    const names = ['Elijah Just', 'Rezaeian', 'Mohebbi'];
    for (const name of names) {
      console.log(`  Contains "${name}": ${desc?.includes(name) ? '✅' : '❌'}`);
    }
  }
  // Sweden vs Tunisia
  if (m.fdId === '537358') {
    const names = ['Omar Rekik', 'Ayari', 'Isak', 'Gyökeres', 'Svanberg'];
    for (const name of names) {
      console.log(`  Contains "${name}": ${desc?.includes(name) ? '✅' : '❌'}`);
    }
  }
  // Netherlands vs Japan
  if (m.fdId === '537357') {
    const names = ['van Dijk', 'Nakamura', 'Summerville', 'Kamada'];
    for (const name of names) {
      console.log(`  Contains "${name}": ${desc?.includes(name) ? '✅' : '❌'}`);
    }
  }

  // Check HTML for goals section content — look for minute markers near GoalsSection
  const goalSectionMatch = html.match(/GOALS[\s\S]{0,3000}?(?:BOOKINGS|SUBSTITUTIONS)/i);
  if (goalSectionMatch) {
    const section = goalSectionMatch[0];
    const allMinutes = section.match(/\d+'(?:\+\d+')?/g) ?? [];
    console.log(`  Minutes in goals section: ${[...new Set(allMinutes)].join(', ')}`);
  }

  console.log();
}
