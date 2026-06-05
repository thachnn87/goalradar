import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Invalid Confirmation Link | GoalRadar',
  description: 'This confirmation link is invalid or has expired.',
  robots: { index: false },
};

export default function InvalidPage() {
  return (
    <div className="max-w-lg mx-auto pt-16 pb-24 px-4 text-center space-y-6">
      {/* Icon */}
      <div className="text-6xl" aria-hidden>🔗</div>

      {/* Heading */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-white">
          Link invalid or expired
        </h1>
        <p className="text-gray-400 text-base leading-relaxed">
          This confirmation link isn&apos;t valid. It may have already been used,
          or it may have expired.
        </p>
      </div>

      {/* Guidance */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-left space-y-3">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
          What to do
        </p>
        <ul className="space-y-2 text-sm text-gray-300 list-disc list-inside">
          <li>Try signing up again — we&apos;ll send a fresh confirmation link.</li>
          <li>Check your spam folder for the original email.</li>
          <li>Confirmation links expire after 7 days.</li>
        </ul>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
        <Link
          href="/world-cup-2026"
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold
                     px-6 py-3 rounded-xl transition-colors text-sm"
        >
          🏆 World Cup Hub
        </Link>
        <Link
          href="/"
          className="bg-gray-800 hover:bg-gray-700 text-white font-semibold
                     border border-gray-700 px-6 py-3 rounded-xl transition-colors text-sm"
        >
          ← Back to GoalRadar
        </Link>
      </div>
    </div>
  );
}
