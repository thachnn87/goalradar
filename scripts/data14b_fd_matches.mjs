/**
 * Fetch all FINISHED WC 2026 matches from football-data.org.
 * Used to find FD match IDs for Netherlands vs Japan and other recent matches.
 */
const FD_KEY = 'c433a00ff0d444e6b7df081e8edafcb7';

const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches?season=2026&status=FINISHED', {
  headers: { 'X-Auth-Token': FD_KEY },
});
if (!res.ok) throw new Error(`FD API ${res.status}`);
const data = await res.json();

console.log(`Total FINISHED matches: ${data.matches?.length ?? 0}`);
console.log('');

for (const m of data.matches ?? []) {
  const home = m.score?.fullTime?.home ?? '?';
  const away = m.score?.fullTime?.away ?? '?';
  console.log(`${m.id}\t${m.homeTeam.name} ${home}-${away} ${m.awayTeam.name}\t${m.utcDate}`);
}
