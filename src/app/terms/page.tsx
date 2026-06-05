import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | GoalRadar',
  description: 'GoalRadar terms of service — rules governing use of our football scores, World Cup 2026 fixtures and streaming guide website.',
  alternates: { canonical: 'https://goalradar.org/terms' },
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

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 pb-16">
      <div className="mb-8 border-b border-gray-800 pb-6">
        <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-2">Legal</p>
        <h1 className="text-3xl font-black text-white mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm">Last updated: 1 June 2026 · Effective immediately</p>
      </div>

      <P>
        These Terms of Service (&quot;Terms&quot;) govern your use of GoalRadar, the website available
        at goalradar.org and operated by GoalRadar (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
        By accessing or using GoalRadar you agree to be bound by these Terms.
        If you do not agree, please do not use the site.
      </P>

      <H2>1. Description of Service</H2>
      <P>
        GoalRadar provides live football scores, match fixtures, results, group standings, streaming
        guides and related editorial content. Match data is sourced from football-data.org. GoalRadar
        is an independent informational website and is not affiliated with FIFA, any football
        association, club or official broadcaster.
      </P>

      <H2>2. Acceptable Use</H2>
      <P>You may use GoalRadar for personal, non-commercial purposes. You must not:</P>
      <UL items={[
        'Use automated scrapers, bots or crawlers to harvest data without prior written permission',
        'Reproduce GoalRadar content on other websites or services without attribution and a link back',
        'Attempt to interfere with or disrupt the service or its underlying infrastructure',
        'Use the service for any unlawful purpose or in violation of any applicable law',
        'Transmit malware, viruses or any code designed to cause harm',
        'Impersonate GoalRadar, its team or any other person',
      ]} />

      <H2>3. Intellectual Property</H2>
      <P>
        The GoalRadar name, logo, website design and original editorial content are the intellectual
        property of GoalRadar. Match statistics and data are sourced from football-data.org under
        their terms of use. Team logos, competition emblems and broadcast logos remain the property
        of their respective owners.
      </P>
      <P>
        You may share individual match result facts (e.g. score, scorer) as these are not copyrightable,
        but you may not reproduce GoalRadar&apos;s page content, articles or original analysis without
        permission.
      </P>

      <H2>4. Accuracy of Information</H2>
      <P>
        We strive to provide accurate live scores and match data but cannot guarantee completeness,
        accuracy or timeliness. Match data is sourced from third-party APIs and may be subject to
        delays or errors. GoalRadar is provided &quot;as is&quot; and we make no warranties of any
        kind, express or implied, regarding the accuracy of sports data.
      </P>
      <P>
        Do not use GoalRadar data for betting, fantasy sports, or any decision where data accuracy
        is critical. Always verify with official sources.
      </P>

      <H2>5. Affiliate Links and Advertising</H2>
      <P>
        GoalRadar contains affiliate links to streaming services, VPN providers and other products.
        When you click these links and make a qualifying purchase, we may earn a commission.
        This is disclosed prominently near affiliate links and in our{' '}
        <Link href="/affiliate-disclosure" className="text-yellow-500 hover:text-yellow-300 transition-colors">
          Affiliate Disclosure
        </Link>.
      </P>
      <P>
        We also display Google AdSense advertisements. Advertisers do not influence our editorial content.
      </P>

      <H2>6. Newsletter</H2>
      <P>
        By subscribing to our newsletter you consent to receive match alerts and editorial emails
        from GoalRadar. All subscriptions require double opt-in confirmation. You may unsubscribe
        at any time using the link in any email. See our{' '}
        <Link href="/privacy-policy" className="text-yellow-500 hover:text-yellow-300 transition-colors">
          Privacy Policy
        </Link>{' '}
        for details on how your email address is stored and used.
      </P>

      <H2>7. Third-Party Links</H2>
      <P>
        GoalRadar links to third-party websites including broadcasters, streaming services, and
        ticket sellers. We are not responsible for the content, privacy practices or accuracy of
        third-party websites. Links are provided for convenience only.
      </P>

      <H2>8. Limitation of Liability</H2>
      <P>
        To the maximum extent permitted by law, GoalRadar and its operators shall not be liable
        for any indirect, incidental, special, consequential or punitive damages arising from your
        use of the service, including but not limited to loss of profits, data or goodwill, even if
        we have been advised of the possibility of such damages.
      </P>
      <P>
        Our total liability for any claim arising from use of GoalRadar shall not exceed £100 (or
        the equivalent in your local currency).
      </P>

      <H2>9. Disclaimer of Warranties</H2>
      <P>
        GoalRadar is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind.
        We do not warrant that the service will be uninterrupted, error-free or free from viruses.
        We do not warrant the accuracy of any match data, broadcast schedule or streaming availability.
      </P>

      <H2>10. Changes to These Terms</H2>
      <P>
        We may modify these Terms at any time. Continued use of GoalRadar after changes constitutes
        acceptance. We will update the &quot;Last updated&quot; date when material changes are made.
      </P>

      <H2>11. Governing Law</H2>
      <P>
        These Terms are governed by the laws of England and Wales. Any disputes shall be subject
        to the exclusive jurisdiction of the courts of England and Wales.
      </P>

      <H2>12. Contact</H2>
      <P>
        For questions about these Terms:{' '}
        <a href="mailto:contact@goalradar.org" className="text-yellow-500 hover:text-yellow-300 transition-colors">
          contact@goalradar.org
        </a>
        {' · '}
        <Link href="/contact" className="text-yellow-500 hover:text-yellow-300 transition-colors">
          Contact page
        </Link>
      </P>

      <div className="mt-10 pt-6 border-t border-gray-800 flex flex-wrap gap-4 text-xs text-gray-600">
        <Link href="/privacy-policy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
        <Link href="/affiliate-disclosure" className="hover:text-gray-400 transition-colors">Affiliate Disclosure</Link>
        <Link href="/contact" className="hover:text-gray-400 transition-colors">Contact</Link>
        <Link href="/" className="hover:text-gray-400 transition-colors">← GoalRadar</Link>
      </div>
    </div>
  );
}
