/**
 * GET /api/newsletter/migrate
 *
 * One-time DB migration — creates the newsletter_subscribers table.
 * Protected by CRON_SECRET so only you can run it.
 *
 * Usage:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://goalradar.org/api/newsletter/migrate
 */

import { NextRequest, NextResponse } from 'next/server';
import { runMigration } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth   = req.headers.get('authorization') ?? '';
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    await runMigration();
    return NextResponse.json({ ok: true, message: 'Migration complete.' });
  } catch (err) {
    console.error('[newsletter] migration error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Migration failed.' },
      { status: 500 },
    );
  }
}
