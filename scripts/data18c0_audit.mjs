/**
 * DATA-18C.0 KV Integrity Audit Script
 * Run: node scripts/data18c0_audit.mjs
 *
 * Calls /api/debug/data18c0-audit on production and outputs raw JSON
 * for use by the 6 audit document phases.
 */

const BASE        = 'https://goalradar.org';
const CRON_SECRET = process.env.CRON_SECRET ?? 'goalradar_cron_12062026_a8KxP9mN4QwT7YvL2RsE5Zh';
const TIMEOUT_MS  = 30_000;

async function callAudit() {
  const url = `${BASE}/api/debug/data18c0-audit?secret=${CRON_SECRET}`;
  console.error(`[audit] calling ${BASE}/api/debug/data18c0-audit ...`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
    return data;
  } finally {
    clearTimeout(timer);
  }
}

callAudit().catch(err => {
  console.error('[audit] FAILED:', err.message);
  process.exit(1);
});
