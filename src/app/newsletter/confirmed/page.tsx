import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Subscription Confirmed | GoalRadar',
  description: 'Your GoalRadar newsletter subscription is confirmed.',
  robots: { index: false },
};

export default function ConfirmedPage() {
  return (
    <div className="max-w-lg mx-auto pt-16 pb-24 px-4 text-center space-y-6">
      {/* Icon */}
      <div className="text-6xl" aria-hidden>🎉</div>

      {/* Heading */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-white">
          You&apos;re confirmed!
        </h1>
        <p className="text-gray-400 text-base leading-relaxed">
          Welcome to GoalRadar. You&apos;ll receive FIFA World Cup 2026 fixture
          alerts, live score roundups and match reports straight to your inbox.
        </p>
      </div>

      {/* What to expect */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-left space-y-3">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
          What to expect
        </p>
        <ul className="space-y-2">
          {[
            '📅 Daily fixture previews during the tournament',
            '🔴 Live score alerts for key matches',
            '🏁 Match report roundups after big games',
            '📊 Group standings updates',
          ].map((item) => (
            <li key={item} className="text-sm text-gray-300 flex items-start gap-2">
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
        <Link
          href="/world-cup-2026"
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold
                     px-6 py-3 rounded-xl transition-colors text-sm"
        >
          🏆 Go to World Cup Hub
        </Link>
        <Link
          href="/world-cup-2026/fixtures"
          className="bg-gray-800 hover:bg-gray-700 text-white font-semibold
                     border border-gray-700 px-6 py-3 rounded-xl transition-colors text-sm"
        >
          📅 View Fixtures
        </Link>
      </div>

      {/* Footer note */}
      <p className="text-gray-600 text-xs pt-4">
        Tournament starts 11 June 2026 · Mexico vs South Africa · Dallas, Texas
      </p>
    </div>
  );
}
