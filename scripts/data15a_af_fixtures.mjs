/**
 * DATA-15A: Fetch AF fixture IDs for the 3 validation matches.
 * Builds the same mapping key af-id-map.ts uses to confirm alignment.
 */
const AF_KEY = 'd1394498437502cddbfde5f890475479';

const TARGETS = [
  { fd: '537352', home: 'Ivory Coast', away: 'Ecuador',     espn: '760423' },
  { fd: '537358', home: 'Sweden',      away: 'Tunisia',     espn: '760424' },
  { fd: '537364', home: 'Iran',        away: 'New Zealand', espn: '760427' },
];

function norm(name) {
  const aliases = {
    'czechia': 'czech republic', 'bosnia-herzegovina': 'bosnia',
    'cape verde islands': 'cape verde', 'korea republic': 'south korea',
    "cote d'ivoire": 'ivory coast',
  };
  const stripped = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return aliases[stripped] ?? stripped;
}

const res = await fetch('https://v3.football.api-sports.io/fixtures?league=1&season=2026', {
  headers: { 'x-apisports-key': AF_KEY },
});
if (!res.ok) { console.error('AF API error', res.status); process.exit(1); }
const data = await res.json();
console.log(`AF returned ${data.response?.length ?? 0} fixtures (errors: ${JSON.stringify(data.errors)})`);

const fixtures = data.response ?? [];

for (const t of TARGETS) {
  const nh = norm(t.home), na = norm(t.away);
  const found = fixtures.find(f => {
    const h = norm(f.teams?.home?.name ?? '');
    const a = norm(f.teams?.away?.name ?? '');
    return (h === nh && a === na) || (h === na && a === nh);
  });
  if (found) {
    console.log(`${t.fd} ${t.home} vs ${t.away}: AF fixture=${found.fixture.id} | kickoff=${found.fixture.date} | status=${found.fixture.status?.short} | ${found.teams.home.name} ${found.goals.home}-${found.goals.away} ${found.teams.away.name}`);
  } else {
    console.log(`${t.fd} ${t.home} vs ${t.away}: AF fixture NOT FOUND`);
  }
}
