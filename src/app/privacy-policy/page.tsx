import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | GoalRadar',
  description: 'GoalRadar privacy policy — how we collect, use and protect your personal data including newsletter subscriptions, cookies and advertising.',
  alternates: { canonical: 'https://goalradar.org/privacy-policy' },
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-white mt-8 mb-3">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-400 text-sm leading-relaxed mb-3">{children}</p>;
}
function UL({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1.5 text-gray-400 text-sm mb-4 ml-2">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 pb-16">
      <div className="mb-8 border-b border-gray-800 pb-6">
        <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-2">Legal</p>
        <h1 className="text-3xl font-black text-white mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm">Last updated: 1 June 2026 · Effective immediately</p>
      </div>

      <P>
        GoalRadar (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the website at goalradar.org.
        This Privacy Policy explains what personal data we collect, why we collect it, how we use it,
        and your rights under applicable privacy laws including GDPR and CCPA.
        By using GoalRadar you agree to this policy.
      </P>

      <H2>1. Information We Collect</H2>
      <P><strong className="text-white">a) Newsletter subscriptions</strong></P>
      <P>
        When you subscribe to our newsletter we collect your email address, the date of subscription,
        and a source label indicating which page you subscribed from.
        Data is stored in Vercel Postgres and processed via Resend.
      </P>
      <P><strong className="text-white">b) Advertising cookies</strong></P>
      <P>
        We use Google AdSense to display advertisements. Google may set cookies and collect browsing data
        to serve personalised ads. This is governed by{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer"
          className="text-yellow-500 hover:text-yellow-300 transition-colors">Google&apos;s Privacy Policy</a>.
        You may opt out at{' '}
        <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer"
          className="text-yellow-500 hover:text-yellow-300 transition-colors">adssettings.google.com</a>.
      </P>
      <P><strong className="text-white">c) Server log data</strong></P>
      <P>
        Our hosting provider Vercel logs IP addresses, browser types, pages visited and timestamps.
        Logs are retained for up to 30 days for security and diagnostics.
      </P>
      <P><strong className="text-white">d) Rate-limiting data</strong></P>
      <P>
        To prevent abuse, hashed IP addresses are stored in Vercel KV with a maximum TTL of 1 hour.
      </P>

      <H2>2. How We Use Your Data</H2>
      <UL items={[
        'To send World Cup 2026 match alerts and newsletters (email subscribers only)',
        'To send a one-time double opt-in confirmation email',
        'To serve contextual advertising via Google AdSense',
        'To prevent spam via rate limiting',
        'To diagnose technical issues via server logs',
      ]} />

      <H2>3. Legal Basis for Processing (GDPR)</H2>
      <UL items={[
        'Consent — newsletter subscriptions require explicit double opt-in confirmation',
        'Legitimate interests — server logs for security and fraud prevention',
        'Consent — advertising cookies where a consent mechanism is presented',
      ]} />

      <H2>4. Data Sharing and Third Parties</H2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
              <th className="text-left px-4 py-3">Service</th>
              <th className="text-left px-4 py-3">Purpose</th>
              <th className="text-left px-4 py-3 hidden sm:table-cell">Data shared</th>
            </tr>
          </thead>
          <tbody className="text-gray-400 divide-y divide-gray-800">
            {[
              ['Vercel',            'Hosting & serverless functions',      'IP address, request data'],
              ['Vercel Postgres',   'Newsletter subscriber database',       'Email address, subscription date'],
              ['Vercel KV',         'Rate limiting',                        'Hashed IP address (deleted after 1 hour)'],
              ['Resend',            'Transactional email delivery',         'Email address'],
              ['Google AdSense',    'Display advertising',                  'Cookies, browsing data'],
              ['football-data.org', 'Live match data API',                  'No personal data sent'],
            ].map(([s, p, d]) => (
              <tr key={s}>
                <td className="px-4 py-2.5 font-medium text-white">{s}</td>
                <td className="px-4 py-2.5">{p}</td>
                <td className="px-4 py-2.5 text-gray-500 hidden sm:table-cell">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <P>We do not sell, rent or trade your personal data to third parties for marketing purposes.</P>

      <H2>5. Affiliate Links</H2>
      <P>
        GoalRadar contains affiliate links to streaming services and other products. When you click
        these links and make a qualifying purchase, we may earn a commission at no extra cost to you.
        See our{' '}
        <Link href="/affiliate-disclosure" className="text-yellow-500 hover:text-yellow-300 transition-colors">
          Affiliate Disclosure
        </Link>{' '}
        for full details.
      </P>

      <H2>6. Your Rights</H2>
      <UL items={[
        'Right to access — request a copy of data we hold about you',
        'Right to rectification — correct inaccurate data',
        'Right to erasure — request deletion of your personal data (GDPR Article 17)',
        'Right to object — object to processing based on legitimate interests',
        'Right to data portability — receive your data in a structured format',
        'CCPA right to know — California residents may request disclosure of data collected',
        'CCPA right to delete — California residents may request deletion of personal information',
        'Right to opt out of newsletter — click the unsubscribe link in any email',
      ]} />
      <P>
        To exercise any right, email{' '}
        <a href="mailto:privacy@goalradar.org" className="text-yellow-500 hover:text-yellow-300 transition-colors">
          privacy@goalradar.org
        </a>.
        We respond within 30 days.
      </P>

      <H2>7. Data Retention</H2>
      <UL items={[
        'Newsletter subscriber data: retained until unsubscribed or deletion requested',
        'Unconfirmed subscribers (no double opt-in click): deleted after 30 days',
        'Server logs: retained up to 30 days by Vercel',
        'Rate-limit data: auto-deleted after 1 hour',
      ]} />

      <H2>8. Cookies</H2>
      <UL items={[
        'Strictly necessary: session and CSRF cookies required for site function',
        'Advertising: Google AdSense cookies for personalised or contextual ads',
        'Analytics: cookies set if Google Analytics is enabled for usage insights',
      ]} />
      <P>Control cookies via your browser settings. Disabling advertising cookies affects ad personalisation.</P>

      <H2>9. Children&apos;s Privacy</H2>
      <P>
        GoalRadar is not directed at children under 13. We do not knowingly collect data from children.
        If you believe a child has provided us data, contact us immediately for deletion.
      </P>

      <H2>10. International Data Transfers</H2>
      <P>
        Data may be processed in the United States (Vercel infrastructure). EU transfers are
        covered by standard contractual clauses under GDPR Chapter V.
      </P>

      <H2>11. Changes to This Policy</H2>
      <P>
        We may update this policy periodically. Material changes are indicated by updating the
        &quot;Last updated&quot; date above. Continued use of GoalRadar constitutes acceptance.
      </P>

      <H2>12. Contact</H2>
      <P>
        Privacy enquiries:{' '}
        <a href="mailto:privacy@goalradar.org" className="text-yellow-500 hover:text-yellow-300 transition-colors">
          privacy@goalradar.org
        </a>
        {' · '}
        <Link href="/contact" className="text-yellow-500 hover:text-yellow-300 transition-colors">
          Contact page
        </Link>
      </P>

      <div className="mt-10 pt-6 border-t border-gray-800 flex flex-wrap gap-4 text-xs text-gray-600">
        <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
        <Link href="/affiliate-disclosure" className="hover:text-gray-400 transition-colors">Affiliate Disclosure</Link>
        <Link href="/contact" className="hover:text-gray-400 transition-colors">Contact</Link>
        <Link href="/" className="hover:text-gray-400 transition-colors">← GoalRadar</Link>
      </div>
    </div>
  );
}
