import { Match, MatchDetail, StandingTable } from './types';

const BASE_URL = 'https://api.football-data.org/v4';

async function fetchAPI<T>(endpoint: string, revalidate = 60): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY ?? '' },
    next: { revalidate },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Football API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function getTodayMatches(): Promise<{ matches: Match[] }> {
  const today = new Date().toISOString().split('T')[0];
  return fetchAPI(`/matches?dateFrom=${today}&dateTo=${today}`, 60);
}

export async function getLiveMatches(): Promise<{ matches: Match[] }> {
  return fetchAPI('/matches?status=IN_PLAY,PAUSED', 30);
}

export async function getUpcomingMatches(
  competition: string
): Promise<{ matches: Match[]; resultSet: { count: number } }> {
  return fetchAPI(
    `/competitions/${competition}/matches?status=SCHEDULED,TIMED`,
    300
  );
}

export async function getRecentMatches(
  competition: string
): Promise<{ matches: Match[] }> {
  const today = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  return fetchAPI(
    `/competitions/${competition}/matches?dateFrom=${from}&dateTo=${today}`,
    300
  );
}

export async function getStandings(competition: string): Promise<{
  standings: StandingTable[];
  competition: { name: string; emblem: string };
}> {
  return fetchAPI(`/competitions/${competition}/standings`, 3600);
}

export async function getMatchDetail(id: string): Promise<MatchDetail> {
  return fetchAPI(`/matches/${id}`, 60);
}
