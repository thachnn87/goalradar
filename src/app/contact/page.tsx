import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contact GoalRadar | Get in Touch',
  description: 'Contact GoalRadar — for data corrections, partnership enquiries, press requests or general feedback about our live football scores and World Cup 2026 coverage.',
  alternates: { canonical: 'https://goalradar.org/contact' },
};

export default function ContactPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 pb-16">
      <div className="mb-8 border-b border-gray-800 pb-6">
        <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-2">Get in touch</p>
        <h1 className="text-3xl font-black text-white mb-2">Contact GoalRadar</h1>
        <p className="text-gray-500 text-sm">We read every message. Typical response within 48 hours.</p>
      </div>

      {/* Contact options */}
      <div className="space-y-4 mb-10">
        {[
          {
            icon: '📧',
            title: 'General enquiries',
            desc: 'Questions about the site, feedback, suggestions',
            email: 'contact@goalradar.org',
            subject: 'General enquiry',
          },
          {
            icon: '🤝',
            title: 'Partnerships & advertising',
            desc: 'Affiliate partnerships, sponsored content, media buying',
            email: 'partnerships@goalradar.org',
            subject: 'Partnership enquiry',
          },
          {
            icon: '📰',
            title: 'Press & media',
            desc: 'Press requests, interview enquiries, media kit',
            email: 'press@goalradar.org',
            subject: 'Press enquiry',
          },
          {
            icon: '🔒',
            title: 'Privacy & data',
            desc: 'GDPR requests, data deletion, privacy concerns',
            email: 'privacy@goalradar.org',
            subject: 'Privacy request',
          },
          {
            icon: '🐛',
            title: 'Data corrections',
            desc: 'Report incorrect scores, missing fixtures, wrong team names',
            email: 'data@goalradar.org',
            subject: 'Data correction',
          },
        ].map(({ icon, title, desc, email, subject }) => (
          <div key={title} className="bg-gray-900 border border-gray-800 hover:border-yellow-700/30 rounded-2xl p-5 transition-colors group">
            <div className="flex items-start gap-4">
              <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm mb-0.5">{title}</p>
                <p className="text-gray-500 text-xs mb-2">{desc}</p>
                <a
                  href={`mailto:${email}?subject=${encodeURIComponent(subject)}`}
                  className="text-yellow-500 hover:text-yellow-300 text-sm font-medium transition-colors"
                >
                  {email}
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Response times */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-8">
        <h2 className="text-sm font-bold text-white mb-3">Expected response times</h2>
        <div className="space-y-2 text-xs text-gray-400">
          {[
            ['General enquiries',        'Within 48 hours'],
            ['Partnership proposals',    '3–5 working days'],
            ['Privacy / GDPR requests',  'Within 30 days (legal requirement)'],
            ['Data corrections',         'Within 24 hours for critical score errors'],
            ['Press enquiries',          '2–3 working days'],
          ].map(([type, time]) => (
            <div key={type} className="flex items-center justify-between">
              <span className="text-gray-500">{type}</span>
              <span className="text-white font-medium">{time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Social / follow */}
      <div className="bg-gradient-to-br from-yellow-950/20 to-gray-900 border border-yellow-800/20 rounded-2xl p-5 mb-8">
        <p className="text-white font-bold text-sm mb-1">⚽ Follow GoalRadar</p>
        <p className="text-gray-400 text-xs mb-3">
          Get live score updates and World Cup 2026 coverage across our newsletter.
        </p>
        <Link href="/"
          className="inline-block text-xs text-yellow-500 hover:text-yellow-300 transition-colors font-medium">
          Subscribe to match alerts →
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-xs text-gray-600">
        <Link href="/privacy-policy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
        <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms</Link>
        <Link href="/about" className="hover:text-gray-400 transition-colors">About</Link>
        <Link href="/" className="hover:text-gray-400 transition-colors">← GoalRadar</Link>
      </div>
    </div>
  );
}
