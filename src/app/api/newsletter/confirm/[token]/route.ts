/**
 * GET /api/newsletter/confirm/[token]
 *
 * Double opt-in confirmation step.
 * Verifies the token, marks the subscriber as confirmed, sends a welcome
 * email, then redirects to the appropriate outcome page.
 *
 * Outcomes:
 *   confirmed         → /newsletter/confirmed
 *   already_confirmed → /newsletter/confirmed   (idempotent — still fine)
 *   invalid token     → /newsletter/invalid
 */

import { NextRequest, NextResponse } from 'next/server';
import { confirmByToken } from '@/lib/db';
import { sendWelcomeEmail } from '@/lib/email';

type Params = { params: Promise<{ token: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://goalradar.org';

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;

  if (!token || typeof token !== 'string' || token.length < 10) {
    return NextResponse.redirect(`${SITE}/newsletter/invalid`, { status: 302 });
  }

  try {
    const result = await confirmByToken(token);

    if (result.status === 'invalid') {
      return NextResponse.redirect(`${SITE}/newsletter/invalid`, { status: 302 });
    }

    // Send welcome email for first-time confirmations (fire-and-forget)
    if (result.status === 'confirmed') {
      sendWelcomeEmail(result.subscriber.email).catch((err) => {
        console.error('[newsletter] Welcome email failed:', err?.message ?? err);
      });
    }

    return NextResponse.redirect(`${SITE}/newsletter/confirmed`, { status: 302 });
  } catch (err) {
    console.error('[newsletter] confirm error:', err instanceof Error ? err.message : err);
    // On DB error, redirect to invalid rather than crashing
    return NextResponse.redirect(`${SITE}/newsletter/invalid`, { status: 302 });
  }
}
