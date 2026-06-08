/**
 * GET /api/subscribers
 *
 * Returns the total and confirmed subscriber count from the newsletter_subscribers table.
 * Public endpoint — returns counts only (no personal data).
 *
 * Response:
 *   { total: number, confirmed: number, updatedAt: string }
 *
 * Cached for 1 hour at the CDN edge (Vercel).
 * Returns { total: 0, confirmed: 0 } gracefully when Postgres is unavailable.
 */

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const revalidate = 3600; // 1 hour CDN cache

const DB_AVAILABLE =
  typeof process.env.POSTGRES_URL === 'string' && process.env.POSTGRES_URL.trim() !== '';

export async function GET(): Promise<NextResponse> {
  if (!DB_AVAILABLE) {
    return NextResponse.json(
      { total: 0, confirmed: 0, updatedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  }

  try {
    const result = await sql<{ total: string; confirmed: string }>`
      SELECT
        COUNT(*)                                    AS total,
        COUNT(*) FILTER (WHERE confirmed = TRUE)    AS confirmed
      FROM newsletter_subscribers
    `;

    const row = result.rows[0];

    return NextResponse.json(
      {
        total:     parseInt(row?.total     ?? '0', 10),
        confirmed: parseInt(row?.confirmed ?? '0', 10),
        updatedAt: new Date().toISOString(),
      },
      {
        status:  200,
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      },
    );
  } catch (err) {
    console.error('[/api/subscribers] DB error:', err);

    return NextResponse.json(
      { total: 0, confirmed: 0, updatedAt: new Date().toISOString() },
      {
        status:  200, // return 200 to avoid alerting callers — DB may be temporarily unavailable
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      },
    );
  }
}
