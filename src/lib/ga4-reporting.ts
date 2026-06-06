/**
 * GA4 Data API (v1beta) — server-side reporting client.
 *
 * Authentication: Google service account JWT → short-lived access token.
 * No external npm packages required — uses Node.js built-in `crypto` for
 * RSA-SHA256 signing and native `fetch` for HTTP.
 *
 * Required environment variables (all server-side, never exposed to client):
 *   GOOGLE_ANALYTICS_PROPERTY_ID       e.g. "properties/123456789"
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL       e.g. "sa@project.iam.gserviceaccount.com"
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY PEM private key; use \n for newlines in Vercel
 *
 * Returns null gracefully if any variable is missing or if the API call fails.
 * The admin dashboard uses this to show real metrics with a static fallback.
 */

import { createSign } from 'crypto';

// ─── env ─────────────────────────────────────────────────────────────────────

const PROPERTY_ID  = process.env.GOOGLE_ANALYTICS_PROPERTY_ID       ?? '';
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL        ?? '';
// Vercel stores multi-line values with literal \n — replace before use
const PRIVATE_KEY  = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

function isConfigured(): boolean {
  return PROPERTY_ID !== '' && CLIENT_EMAIL !== '' && PRIVATE_KEY !== '';
}

// ─── JWT / token exchange ─────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const now     = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss:   CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3_600,
    iat:   now,
  })).toString('base64url');

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(PRIVATE_KEY, 'base64url');

  const jwt = `${header}.${payload}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth2:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  });

  if (!res.ok) throw new Error(`[GA4] Token exchange failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

// ─── report runner ────────────────────────────────────────────────────────────

interface ReportResponse {
  rows?: Array<{
    dimensionValues: Array<{ value: string }>;
    metricValues:    Array<{ value: string }>;
  }>;
  rowCount?: number;
}

async function runReport(token: string, body: object): Promise<ReportResponse> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/${PROPERTY_ID}:runReport`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`[GA4] runReport failed: ${res.status} ${err}`);
  }
  return res.json() as Promise<ReportResponse>;
}

// ─── public types ─────────────────────────────────────────────────────────────

export interface GA4PageRow {
  path:  string;
  views: number;
}

export interface GA4CompetitionRow {
  code:  string;
  views: number;
}

export interface GA4Summary {
  totalPageViews7d:   number;
  topPages:           GA4PageRow[];
  topCompetitions:    GA4CompetitionRow[];
  dateRange:          string;
  fetchedAt:          string;   // ISO timestamp
}

// ─── main export ─────────────────────────────────────────────────────────────

/**
 * Fetch a 7-day GA4 summary.
 * Returns null if credentials are not configured or if any API call fails.
 */
export async function fetchGA4Summary(): Promise<GA4Summary | null> {
  if (!isConfigured()) return null;

  try {
    const token = await getAccessToken();

    // ── Report 1: top pages by screen page views ──────────────────────────
    const pageReport = await runReport(token, {
      dateRanges:  [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics:     [{ name: 'screenPageViews' }],
      dimensions:  [{ name: 'pagePath' }],
      orderBys:    [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit:       25,
    });

    const pageRows = pageReport.rows ?? [];
    const totalPageViews7d = pageRows.reduce(
      (sum, r) => sum + parseInt(r.metricValues[0].value, 10),
      0,
    );

    const topPages: GA4PageRow[] = pageRows.slice(0, 10).map((r) => ({
      path:  r.dimensionValues[0].value,
      views: parseInt(r.metricValues[0].value, 10),
    }));

    // ── Report 2: competition_view events by competition_code ─────────────
    // Uses the custom event parameter `competition_code` sent by AnalyticsTracker
    const eventReport = await runReport(token, {
      dateRanges:  [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics:     [{ name: 'eventCount' }],
      dimensions:  [{ name: 'eventName' }, { name: 'customEvent:competition_code' }],
      dimensionFilter: {
        filter: {
          fieldName:    'eventName',
          stringFilter: { matchType: 'EXACT', value: 'competition_view' },
        },
      },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit:    20,
    });

    const eventRows = eventReport.rows ?? [];
    const topCompetitions: GA4CompetitionRow[] = eventRows
      .filter((r) => r.dimensionValues[1]?.value && r.dimensionValues[1].value !== '(not set)')
      .slice(0, 7)
      .map((r) => ({
        code:  r.dimensionValues[1].value,
        views: parseInt(r.metricValues[0].value, 10),
      }));

    return {
      totalPageViews7d,
      topPages,
      topCompetitions,
      dateRange:  'Last 7 days',
      fetchedAt:  new Date().toISOString(),
    };
  } catch (err) {
    console.error('[GA4 Reporting] Failed to fetch summary:', err);
    return null;
  }
}
