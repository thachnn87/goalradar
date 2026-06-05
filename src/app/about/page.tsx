import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About GoalRadar | Live Football Scores & World Cup 2026',
  description: 'GoalRadar is your home for live football scores, FIFA World Cup 2026 fixtures, results, standings and streaming guides. Fast, ad-friendly, built for fans.',
  alternates: { canonical: 'https://goalradar.org/about' },
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 pb-16">
      <div className="mb-8 border-b border-gray-800 pb-6">
        <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-2">About</p>
        <h1 className="text-3xl font-black text-white mb-2">About GoalRadar</h1>
        <p className="text-gray-500 text-sm">Your home for live football and World Cup 2026 coverage</p>
      </div>

      {/* Mission statement */}
      <div className="bg-gradient-to-br from-yellow-950/20 to-gray-900 border border-yellow-800/20 rounded-2xl p-6 mb-8">
        <p className="text-white text-lg font-bold leading-relaxed mb-2">
          &quot;We built GoalRadar because football fans deserve fast, clean, ad-friendly scores
          without the noise.&quot;
        </p>
        <p className="text-gray-400 text-sm">
          No clickbait. No slow-loading tables. No paywalled fixtures. Just football.
        </p>
      </div>

      <div className="space-y-6 text-gray-400 text-sm leading-relaxed">
        <div>
          <h2 className="text-lg font-bold text-white mb-2">What is GoalRadar?</h2>
          <p>
            GoalRadar is a live football scores website covering the FIFA World Cup 2026, Premier League,
            Champions League, La Liga, Bundesliga and all major European competitions.
            We aggregate live match data, fixtures, results, standings and team statistics into one
            fast, mobile-friendly experience.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-white mb-2">World Cup 2026 Coverage</h2>
          <p className="mb-3">
            GoalRadar is purpose-built for the FIFA World Cup 2026 — the largest World Cup in history
            with 48 teams competing across 16 stadiums in USA, Canada and Mexico from 11 June to 19 July 2026.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: '📅', label: 'Full fixture schedule', href: '/world-cup-2026/fixtures' },
              { icon: '📊', label: 'Live results', href: '/world-cup-2026/results' },
              { icon: '🗂️', label: 'Group standings', href: '/world-cup-2026/groups' },
              { icon: '🔗', label: 'Knockout bracket', href: '/world-cup-2026/bracket' },
              { icon: '📺', label: 'Streaming guide', href: '/world-cup-2026/watch-live' },
              { icon: '👥', label: 'All 48 teams', href: '/world-cup-2026/teams/argentina' },
            ].map(({ icon, label, href }) => (
              <Link key={href} href={href}
                className="bg-gray-900 border border-gray-800 hover:border-yellow-700/30 rounded-xl p-3 text-center text-xs font-medium text-gray-300 hover:text-white transition-all">
                <span className="block text-lg mb-1">{icon}</span>
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-white mb-2">Data Sources</h2>
          <p>
            Live match data is powered by the{' '}
            <a href="https://www.football-data.org" target="_blank" rel="noopener noreferrer"
              className="text-yellow-500 hover:text-yellow-300 transition-colors">
              football-data.org API
            </a>
            , which provides official data for over 150 football competitions worldwide.
            Scores update automatically via Incremental Static Regeneration (ISR) — no manual
            refresh needed.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-white mb-2">Technology</h2>
          <p>
            GoalRadar is built with Next.js 16 (App Router), deployed on Vercel and served from
            global edge nodes for fast load times worldwide. We use ISR with short revalidation
            intervals to keep scores fresh without unnecessary API calls.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-white mb-2">Advertising & Partnerships</h2>
          <p>
            GoalRadar is supported by Google AdSense display advertising and affiliate partnerships
            with streaming services and VPN providers. We are transparent about commercial relationships —
            see our{' '}
            <Link href="/affiliate-disclosure" className="text-yellow-500 hover:text-yellow-300 transition-colors">
              Affiliate Disclosure
            </Link>{' '}
            for full details.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-bold text-white mb-2">Contact & Feedback</h2>
          <p>
            We&apos;re a small independent football media project. We welcome feedback, partnership
            enquiries and press requests. Reach us at{' '}
            <a href="mailto:contact@goalradar.org" className="text-yellow-500 hover:text-yellow-300 transition-colors">
              contact@goalradar.org
            </a>{' '}
            or via our{' '}
            <Link href="/contact" className="text-yellow-500 hover:text-yellow-300 transition-colors">
              contact page
            </Link>.
          </p>
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-gray-800 flex flex-wrap gap-4 text-xs text-gray-600">
        <Link href="/privacy-policy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
        <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms</Link>
        <Link href="/affiliate-disclosure" className="hover:text-gray-400 transition-colors">Affiliate Disclosure</Link>
        <Link href="/contact" className="hover:text-gray-400 transition-colors">Contact</Link>
        <Link href="/" className="hover:text-gray-400 transition-colors">← GoalRadar</Link>
      </div>
    </div>
  );
}
