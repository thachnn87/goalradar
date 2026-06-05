/**
 * WCPageNav — horizontal navigation strip shared by all World Cup sub-pages.
 * Highlights the currently active route.
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/world-cup-2026',          label: '🏆 Hub'      },
  { href: '/world-cup-2026/fixtures', label: '📅 Fixtures'  },
  { href: '/world-cup-2026/results',  label: '🏁 Results'   },
  { href: '/world-cup-2026/groups',   label: '📊 Groups'    },
  { href: '/world-cup-2026/bracket',  label: '🔗 Bracket'   },
];

export default function WCPageNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="World Cup navigation" className="flex flex-wrap gap-2">
      {LINKS.map(({ href, label }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              isActive
                ? 'bg-yellow-500 text-black border-yellow-400'
                : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border-gray-700'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
