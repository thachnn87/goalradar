/**
 * src/lib/email.ts
 *
 * Resend-based transactional email helpers for the newsletter flow.
 *
 * Required env vars:
 *   RESEND_API_KEY        — from resend.com dashboard
 *   NEXT_PUBLIC_SITE_URL  — https://goalradar.org  (no trailing slash)
 *   NEWSLETTER_FROM_EMAIL — e.g. newsletter@goalradar.org (verified domain)
 */

import { Resend } from 'resend';

// Lazy — instantiated on first use so build-time missing env vars don't crash.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY environment variable is not set.');
    _resend = new Resend(key);
  }
  return _resend;
}

const SITE_URL   = process.env.NEXT_PUBLIC_SITE_URL  ?? 'https://goalradar.org';
const FROM_EMAIL = process.env.NEWSLETTER_FROM_EMAIL ?? 'newsletter@goalradar.org';
const FROM_NAME  = 'GoalRadar';

// ---------------------------------------------------------------------------
// Shared HTML shell
// ---------------------------------------------------------------------------

function emailHtml({
  heading,
  body,
  ctaUrl,
  ctaLabel,
  footer,
}: {
  heading: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
  footer?: string;
}): string {
  const cta = ctaUrl && ctaLabel
    ? `<div style="text-align:center;margin:32px 0;">
         <a href="${ctaUrl}"
            style="display:inline-block;background:#eab308;color:#000;font-weight:700;
                   font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">
           ${ctaLabel}
         </a>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#111;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background:#111;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#1a1a1a;border-radius:16px;overflow:hidden;
                    border:1px solid #2a2a2a;max-width:100%;">

        <!-- Header bar -->
        <tr>
          <td style="background:#1c1408;padding:20px 32px;border-bottom:1px solid #2a2a1a;">
            <span style="font-size:20px;">⚽</span>
            <span style="color:#eab308;font-weight:800;font-size:18px;
                         vertical-align:middle;margin-left:8px;">GoalRadar</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h1 style="color:#fff;font-size:20px;font-weight:800;margin:0 0 16px;">${heading}</h1>
            <div style="color:#ccc;font-size:15px;line-height:1.6;">${body}</div>
            ${cta}
            ${footer ? `<p style="color:#555;font-size:12px;margin-top:24px;line-height:1.5;">${footer}</p>` : ''}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#141414;padding:16px 32px;border-top:1px solid #222;">
            <p style="color:#444;font-size:11px;margin:0;line-height:1.6;">
              © 2026 GoalRadar &nbsp;·&nbsp;
              <a href="${SITE_URL}/world-cup-2026" style="color:#666;text-decoration:none;">World Cup Hub</a>
              &nbsp;·&nbsp; You received this because you signed up at goalradar.org
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Confirmation email (double opt-in step 1)
// ---------------------------------------------------------------------------

export async function sendConfirmationEmail(
  to: string,
  token: string,
): Promise<void> {
  const confirmUrl = `${SITE_URL}/api/newsletter/confirm/${token}`;

  const html = emailHtml({
    heading: 'Confirm your GoalRadar subscription',
    body: `
      <p>Thanks for signing up! You're one click away from getting the best
         FIFA World Cup 2026 coverage directly in your inbox — live scores,
         fixture alerts and exclusive match reports.</p>
      <p>Click the button below to confirm your email address:</p>
    `,
    ctaUrl:   confirmUrl,
    ctaLabel: 'Confirm my subscription',
    footer: `If you didn't sign up for GoalRadar, you can safely ignore this email.
             This confirmation link expires in 7 days.`,
  });

  const { error } = await getResend().emails.send({
    from:    `${FROM_NAME} <${FROM_EMAIL}>`,
    to,
    subject: 'Confirm your GoalRadar subscription ⚽',
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Welcome email (sent after confirmation)
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail(to: string): Promise<void> {
  const html = emailHtml({
    heading: "You're in! Welcome to GoalRadar 🏆",
    body: `
      <p>Your subscription is confirmed. Get ready for FIFA World Cup 2026 coverage
         starting 11 June 2026 — Mexico vs South Africa kicks things off in Dallas.</p>
      <p>Here's what you'll get:</p>
      <ul style="color:#ccc;font-size:15px;line-height:1.8;padding-left:20px;">
        <li>Live score alerts for every group match</li>
        <li>Daily fixture roundups</li>
        <li>Knockout stage updates and results</li>
        <li>Exclusive match reports</li>
      </ul>
      <p>While you wait, explore the tournament hub:</p>
    `,
    ctaUrl:   `${SITE_URL}/world-cup-2026`,
    ctaLabel: '🏆 Go to World Cup Hub',
  });

  const { error } = await getResend().emails.send({
    from:    `${FROM_NAME} <${FROM_EMAIL}>`,
    to,
    subject: "You're in! Welcome to GoalRadar ⚽",
    html,
  });

  if (error) {
    // Non-fatal — subscriber is already confirmed; log but don't throw
    console.error('[email] Welcome email failed:', error.message);
  }
}
