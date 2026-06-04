import { Match, MatchDetail, HeadToHead, StandingTable } from './types';

const BASE_URL = 'https://api.football-data.org/v4';

async function fetchAPI<T>(
  endpoint: string,
  revalidate = 60,
  retries = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();

      const timeout = setTimeout(() => {
        controller.abort();
      }, 10000);

      const res = await fetch(
        `${BASE_URL}${endpoint}`,
        {
          headers: {
            'X-Auth-Token':
              process.env.FOOTBALL_API_KEY ?? '',
          },
          next: {
            revalidate,
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();

        throw new Error(
          `Football API ${res.status}: ${text}`
        );
      }

      return res.json() as Promise<T>;
    } catch (error) {
      lastError = error as Error;

      console.error(
        `[Football API] Attempt ${attempt}/${retries} failed`,
        error
      );

      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, attempt * 1000)
        );
      }
    }
  }

  throw lastError;
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

export async function getHeadToHead(
  id: string
): Promise<HeadToHead> {
  return fetchAPI(
    `/matches/${id}/head2head`,
    60
  );
}