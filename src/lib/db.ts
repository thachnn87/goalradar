/**
 * src/lib/db.ts
 *
 * Vercel Postgres helpers for the newsletter subscriber table.
 *
 * Table (created automatically via /api/newsletter/migrate):
 *
 *   CREATE TABLE IF NOT EXISTS newsletter_subscribers (
 *     id           SERIAL PRIMARY KEY,
 *     email        TEXT    NOT NULL UNIQUE,
 *     token        TEXT    NOT NULL UNIQUE,
 *     confirmed    BOOLEAN NOT NULL DEFAULT FALSE,
 *     confirmed_at TIMESTAMPTZ,
 *     source       TEXT,
 *     created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 *   CREATE INDEX IF NOT EXISTS idx_newsletter_token ON newsletter_subscribers (token);
 *
 * Required env var: POSTGRES_URL
 *   → Add via Vercel Dashboard → Storage → Create Postgres → Connect to project
 *   → Then run GET /api/newsletter/migrate once (or click "Run migration" in dashboard)
 *
 * Fallback: if POSTGRES_URL is absent, subscribe/route.ts falls back to Vercel KV.
 */

import { sql } from '@vercel/postgres';

// ---------------------------------------------------------------------------
// Availability guard
// ---------------------------------------------------------------------------

/** True when POSTGRES_URL is present at runtime. */
export const DB_AVAILABLE = Boolean(process.env.POSTGRES_URL);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Subscriber {
  id: number;
  email: string;
  token: string;
  confirmed: boolean;
  confirmed_at: Date | null;
  source: string | null;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Upsert — idempotent subscribe
// ---------------------------------------------------------------------------

export type UpsertResult =
  | { status: 'created';   subscriber: Subscriber }
  | { status: 'resent';    subscriber: Subscriber }   // unconfirmed, fresh token
  | { status: 'duplicate';                         }  // already confirmed

/**
 * Insert a new subscriber or handle duplicates gracefully.
 *
 * - First-time email: INSERT row, return 'created'
 * - Unconfirmed email: UPDATE with fresh token, return 'resent'
 * - Already confirmed: return 'duplicate' (caller sends same success message)
 */
export async function upsertSubscriber(
  email: string,
  token: string,
  source: string | null,
): Promise<UpsertResult> {
  if (!DB_AVAILABLE) throw new Error('POSTGRES_URL is not configured.');

  const normalised = email.toLowerCase().trim();

  const existing = await sql<Subscriber>`
    SELECT * FROM newsletter_subscribers
    WHERE email = ${normalised}
    LIMIT 1
  `;

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    if (row.confirmed) return { status: 'duplicate' };

    const updated = await sql<Subscriber>`
      UPDATE newsletter_subscribers
      SET    token = ${token}, source = COALESCE(${source}, source)
      WHERE  email = ${normalised}
      RETURNING *
    `;
    return { status: 'resent', subscriber: updated.rows[0] };
  }

  const inserted = await sql<Subscriber>`
    INSERT INTO newsletter_subscribers (email, token, source)
    VALUES (${normalised}, ${token}, ${source})
    RETURNING *
  `;
  return { status: 'created', subscriber: inserted.rows[0] };
}

// ---------------------------------------------------------------------------
// Confirm by token
// ---------------------------------------------------------------------------

export type ConfirmResult =
  | { status: 'confirmed';          subscriber: Subscriber }
  | { status: 'already_confirmed';  subscriber: Subscriber }
  | { status: 'invalid';                                   }

export async function confirmByToken(token: string): Promise<ConfirmResult> {
  if (!DB_AVAILABLE) throw new Error('POSTGRES_URL is not configured.');

  const result = await sql<Subscriber>`
    SELECT * FROM newsletter_subscribers
    WHERE token = ${token}
    LIMIT 1
  `;

  if (result.rows.length === 0) return { status: 'invalid' };

  const row = result.rows[0];
  if (row.confirmed) return { status: 'already_confirmed', subscriber: row };

  const updated = await sql<Subscriber>`
    UPDATE newsletter_subscribers
    SET    confirmed    = TRUE,
           confirmed_at = NOW()
    WHERE  token = ${token}
    RETURNING *
  `;
  return { status: 'confirmed', subscriber: updated.rows[0] };
}

// ---------------------------------------------------------------------------
// Admin — list subscribers (for export endpoint)
// ---------------------------------------------------------------------------

export interface SubscriberRow {
  id: number;
  email: string;
  confirmed: boolean;
  confirmed_at: Date | null;
  source: string | null;
  created_at: Date;
}

export async function getSubscribers(opts?: {
  confirmedOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ rows: SubscriberRow[]; total: number }> {
  if (!DB_AVAILABLE) throw new Error('POSTGRES_URL is not configured.');

  const confirmedOnly = opts?.confirmedOnly ?? false;
  const limit         = Math.min(opts?.limit  ?? 1000, 5000);
  const offset        = opts?.offset ?? 0;

  const [rowsResult, countResult] = await Promise.all([
    confirmedOnly
      ? sql<SubscriberRow>`
          SELECT id, email, confirmed, confirmed_at, source, created_at
          FROM   newsletter_subscribers
          WHERE  confirmed = TRUE
          ORDER  BY created_at DESC
          LIMIT  ${limit} OFFSET ${offset}
        `
      : sql<SubscriberRow>`
          SELECT id, email, confirmed, confirmed_at, source, created_at
          FROM   newsletter_subscribers
          ORDER  BY created_at DESC
          LIMIT  ${limit} OFFSET ${offset}
        `,
    confirmedOnly
      ? sql<{ count: string }>`SELECT COUNT(*) as count FROM newsletter_subscribers WHERE confirmed = TRUE`
      : sql<{ count: string }>`SELECT COUNT(*) as count FROM newsletter_subscribers`,
  ]);

  return {
    rows:  rowsResult.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0', 10),
  };
}

// ---------------------------------------------------------------------------
// Migration helper — called once by /api/newsletter/migrate
// ---------------------------------------------------------------------------

export async function runMigration(): Promise<void> {
  if (!DB_AVAILABLE) throw new Error('POSTGRES_URL is not configured.');

  await sql`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id           SERIAL      PRIMARY KEY,
      email        TEXT        NOT NULL UNIQUE,
      token        TEXT        NOT NULL UNIQUE,
      confirmed    BOOLEAN     NOT NULL DEFAULT FALSE,
      confirmed_at TIMESTAMPTZ,
      source       TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_newsletter_token
    ON newsletter_subscribers (token)
  `;
}
