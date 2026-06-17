/**
 * DATA-15B: Determine, for every FINISHED WC 2026 FD match, whether the ESPN
 * resolver (findEspnMatch logic) would produce a valid ESPN event ID or a
 * '__NOT_FOUND__' sentinel. This is the expected lookup-key population.
 *
 * Read-only: queries FD API + ESPN public scoreboard. No KV, no writes.
 */
const FD_KEY = 'c433a00ff0d444e6b7df081e8edafcb7';
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';

function norm(name) {
  const aliases = {
    'united states': 'usa', 'united states men': 'usa',
    'trinidad & tobago': 'trinidad and tobago', 'korea republic': 'south korea',
    "côte d'ivoire": 'ivory coast', "cote d'ivoire": 'ivory coast',
    'czechia': 'czech republic', 'bosnia-herzegovina': 'bosnia',
    'cape verde islands': 'cape verde', 'república dominicana': 'dominican republic',
    'turkey': 'turkiye',
  };
  const stripped = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return aliases[stripped] ?? stripped;
}

function toEspnDateStr(utc) { return utc.slice(0, 10).replace(/-/g, ''); }
function prevDayStr(d) {
  const y = +d.slice(0,4), m = +d.slice(4,6)-1, da = +d.slice(6,8);
  const dt = new Date(Date.UTC(y, m, da-1));
  return `${dt.getUTCFullYear()}${String(dt.getUTCMonth()+1).padStart(2,'0')}${String(dt.getUTCDate()).padStart(2,'0')}`;
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function scoreboard(date) {
  try { return (await fetchJson(`${ESPN_BASE}/scoreboard?dates=${date}`)).events ?? []; }
  catch { return []; }
}

function findIn(events, nh, na) {
  for (const ev of events) {
    const c = ev.competitions?.[0]; if (!c) continue;
    const h = c.competitors.find(x => x.homeAway === 'home');
    const a = c.competitors.find(x => x.homeAway === 'away');
    if (!h || !a) continue;
    if (norm(h.team.displayName) === nh && norm(a.team.displayName) === na) return ev.id;
    if (norm(h.team.shortDisplayName ?? '') === nh && norm(a.team.shortDisplayName ?? '') === na) return ev.id;
  }
  return null;
}

const fd = await fetchJson(
  'https://api.football-data.org/v4/competitions/WC/matches?season=2026&status=FINISHED',
  { 'X-Auth-Token': FD_KEY },
);

console.log(`FINISHED FD matches: ${fd.matches.length}\n`);
let valid = 0, notfound = 0;
const rows = [];

for (const m of fd.matches) {
  const nh = norm(m.homeTeam.name), na = norm(m.awayTeam.name);
  const d = toEspnDateStr(m.utcDate), pd = prevDayStr(d);
  let espnId = findIn(await scoreboard(d), nh, na);
  let via = 'direct';
  if (!espnId) { espnId = findIn(await scoreboard(pd), nh, na); via = 'prev-day'; }
  if (espnId) valid++; else notfound++;
  rows.push({ fd: m.id, label: `${m.homeTeam.name} vs ${m.awayTeam.name}`, utc: m.utcDate, espnId, via: espnId ? via : 'NOT_FOUND' });
}

for (const r of rows) {
  console.log(`${r.fd}\t${r.espnId ?? '__NOT_FOUND__'}\t(${r.via})\t${r.label}\t${r.utc}`);
}
console.log(`\nVALID ESPN IDs: ${valid}`);
console.log(`__NOT_FOUND__ (would be): ${notfound}`);
