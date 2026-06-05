import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Affiliate Disclosure | GoalRadar',
  description: 'GoalRadar affiliate disclosure — how we earn commissions from streaming service and VPN partner links, in compliance with FTC guidelines.',
  alternates: { canonical: 'https://goalradar.org/affiliate-disclosure' },
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-white mt-8 mb-3">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-400 text-sm leading-relaxed mb-3">{children}</p>;
}

export default function AffiliateDisclosurePage() {
  return (
    <div className="max-w-3xl mx-auto py-8 pb-16">
      <div className="mb-8 border-b border-gray-800 pb-6">
        <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-2">Legal</p>
        <h1 className="text-3xl font-black text-white mb-2">Affiliate Disclosure</h1>
        <p className="text-gray-500 text-sm">Last updated: 1 June 2026 · FTC compliant</p>
      </div>

      {/* FTC-required prominent disclosure */}
      <div className="bg-yellow-950/30 border border-yellow-800/30 rounded-2xl p-5 mb-8">
        <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider mb-2">⚠️ Important Disclosure</p>
        <p className="text-white text-sm font-semibold leading-relaxed">
          GoalRadar participates in affiliate marketing programmes. When you click certain links on
          this site and make a qualifying purchase, GoalRadar may earn a commission.
          This comes at <strong>no extra cost to you</strong>.
        </p>
      </div>

      <H2>What are affiliate links?</H2>
      <P>
        Affiliate links are special tracking links that identify GoalRadar as the source of a referral.
        When you click an affiliate link and subsequently sign up or purchase a product, the vendor
        credits GoalRadar with a commission — typically a small percentage of the sale or a fixed fee
        per new subscriber.
      </P>
      <P>
        Affiliate links are clearly labelled on GoalRadar with &quot;Partner offer&quot; labels, sponsor
        tags (rel=&quot;sponsored&quot;) and/or disclosure text near the link.
      </P>

      <H2>Which links are affiliate links?</H2>
      <P>
        The following categories of links on GoalRadar may be affiliate links:
      </P>
      <div className="space-y-3 mb-6">
        {[
          {
            category: '📺 Streaming Services',
            examples: 'FuboTV, Sling TV, Peacock, Hulu + Live TV, YouTube TV, TSN Direct',
            note: 'We recommend streaming services with legitimate World Cup broadcast rights.',
          },
          {
            category: '🔒 VPN Services',
            examples: 'NordVPN, ExpressVPN, Surfshark',
            note: 'VPN links are provided for users who want to access geo-restricted broadcasts. We recommend using your country\'s official free broadcaster where available.',
          },
          {
            category: '🏨 Travel & Hotels',
            examples: 'Booking.com, Hotels.com',
            note: 'Hotel links are relevant to pages about World Cup venues for fans attending matches in person.',
          },
        ].map(({ category, examples, note }) => (
          <div key={category} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-sm font-bold text-white mb-1">{category}</p>
            <p className="text-xs text-gray-400 mb-1">{examples}</p>
            <p className="text-xs text-gray-600 italic">{note}</p>
          </div>
        ))}
      </div>

      <H2>Our editorial independence</H2>
      <P>
        Affiliate relationships do not influence the editorial content on GoalRadar. We do not accept
        payment for positive reviews, alter editorial coverage based on affiliate relationships, or
        promote products we do not believe offer genuine value to our readers.
      </P>
      <P>
        All streaming services listed on GoalRadar hold official broadcast rights to the content
        referenced. We do not link to piracy services.
      </P>

      <H2>Free services</H2>
      <P>
        Many links on GoalRadar point to genuinely free services (BBC iPlayer, SBS On Demand, ITV X,
        FPT Play, etc.). These are not affiliate links — we include them because they offer the best
        free experience for viewers in those regions.
      </P>

      <H2>FTC compliance</H2>
      <P>
        This disclosure complies with the U.S. Federal Trade Commission&apos;s guidelines on endorsements
        and testimonials in advertising (16 CFR Part 255) and the UK Competition and Markets Authority
        guidance on affiliate marketing.
      </P>
      <P>
        Material connections (affiliate commissions) are always disclosed near the link or at the top
        of pages containing affiliate links.
      </P>

      <H2>Questions?</H2>
      <P>
        If you have questions about our affiliate relationships or advertising practices, please
        contact us at{' '}
        <a href="mailto:contact@goalradar.org" className="text-yellow-500 hover:text-yellow-300 transition-colors">
          contact@goalradar.org
        </a>.
      </P>

      <div className="mt-10 pt-6 border-t border-gray-800 flex flex-wrap gap-4 text-xs text-gray-600">
        <Link href="/privacy-policy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
        <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
        <Link href="/contact" className="hover:text-gray-400 transition-colors">Contact</Link>
        <Link href="/" className="hover:text-gray-400 transition-colors">← GoalRadar</Link>
      </div>
    </div>
  );
}
