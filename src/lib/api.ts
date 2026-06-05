import { Match, MatchDetail, HeadToHead, StandingTable, TeamDetail } from './types';

const BASE_URL = 'https://api.football-data.org/v4';

// Thrown when the resource genuinely does not exist (HTTP 404).
export class NotFoundError extends Error {
  constructor() {
    super('Not found');
    this.name = 'NotFoundError';
  }
}

// Thrown for every other failure — never contains internal details.
export class ApiUnavailableError extends Error {
  constructor() {
    super('Data temporarily unavailable');
    this.name = 'ApiUnavailableError';
  }
}

async function fetchAPI<T>(
  endpoint: string,
  revalidate = 60,
  // 2 = one initial attempt + one retry before failing
  retries = 2
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY ?? '' },
        next: { revalidate },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        // Log status + sanitised body server-side only; never rethrow raw response.
        const body = await res.text().catch(() => '');
        console.error(
          `[Football API] HTTP ${res.status} on ${endpoint} (attempt ${attempt}/${retries}):`,
          body.slice(0, 200)
        );
        // 404 is a definitive "does not exist" — no point retrying.
        if (res.status === 404) throw new NotFoundError();
        throw new ApiUnavailableError();
      }

      return res.json() as Promise<T>;
    } catch (err) {
      clearTimeout(timeoutId);

      const isTimeout =
        err instanceof DOMException && err.name === 'AbortError';

      // Server-side log with enough context to debug, nothing user-visible.
      console.error(
        `[Football API] Attempt ${attempt}/${retries} failed on ${endpoint}:`,
        isTimeout ? 'timeout (10 s)' : (err instanceof Error ? err.message : String(err))
      );

      if (attempt < retries) {
        // Brief back-off before the single retry.
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }

      // Throw a safe generic error after all attempts are exhausted.
      throw new ApiUnavailableError();
    }
  }

  // TypeScript exhaustiveness — unreachable in practice.
  throw new ApiUnavailableError();
}

export async function getTodayMatches(): Promise<{
  matches: Match[];
}> {
  const today = new Date()
    .toISOString()
    .split('T')[0];

  return fetchAPI(
    `/matches?dateFrom=${today}&dateTo=${today}`,
    60
  );
}

export async function getLiveMatches(): Promise<{
  matches: Match[];
}> {
  return fetchAPI(
    '/matches?status=IN_PLAY,PAUSED',
    30
  );
}

export async function getUpcomingMatches(
  competition: string
): Promise<{
  matches: Match[];
  resultSet: {
    count: number;
  };
}> {
  return fetchAPI(
    `/competitions/${competition}/matches?status=SCHEDULED,TIMED`,
    300
  );
}

export async function getRecentMatches(
  competition: string
): Promise<{
  matches: Match[];
}> {
  const today = new Date()
    .toISOString()
    .split('T')[0];

  const from = new Date(
    Date.now() - 30 * 86400000
  )
    .toISOString()
    .split('T')[0];

  return fetchAPI(
    `/competitions/${competition}/matches?dateFrom=${from}&dateTo=${today}`,
    300
  );
}

export async function getStandings(
  competition: string
): Promise<{
  standings: StandingTable[];
  competition: {
    name: string;
    emblem: string;
  };
}> {
  return fetchAPI(
    `/competitions/${competition}/standings`,
    3600
  );
}

export async function getMatchDetail(
  id: string
): Promise<MatchDetail> {
  return fetchAPI(
    `/matches/${id}`,
    60
  );
}

export async function getTeam(id: string): Promise<TeamDetail> {
  return fetchAPI(`/teams/${id}`, 3600);
}

export async function getTeamMatches(
  id: string
): Promise<{ matches: Match[] }> {
  return fetchAPI(
    `/teams/${id}/matches?status=FINISHED&limit=10`,
    300
  );
}

export async function getHeadToHead(
  id: string
): Promise<HeadToHead> {
  return fetchAPI(
    `/matches/${id}/head2head`,
    60
  );
}

export async function getWCLiveMatches(): Promise<{
  matches: Match[];
}> {
  return fetchAPI(
    '/competitions/WC/matches?status=IN_PLAY,PAUSED',
    30
  );
}