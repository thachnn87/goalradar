/**
 * WCPageNav — horizontal scrollable navigation strip shared by all World Cup pages.
 * Highlights the currently active route. Covers all 12 major WC sections.
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/world-cup-2026',                  label: '🏆 Hub'        },
  { href: '/world-cup-2026-schedule',         label: '📅 Schedule'   },
  { href: '/world-cup-2026/fixtures',         label: '📋 Fixtures'   },
  { href: '/world-cup-2026-results',          label: '🏁 Results'    },
  { href: '/world-cup-2026-standings',        label: '📊 Standings'  },
  { href: '/world-cup-2026-groups',           label: '🗂️ Groups'     },
  { href: '/world-cup-2026-bracket',          label: '🔗 Bracket'    },
  { href: '/world-cup-2026/round-of-32',      label: '🎯 Round of 32'},
  { href: '/world-cup-2026/final',            label: '🥇 Final'      },
  { href: '/world-cup-2026-live-stream',      label: '📡 Watch Live' },
  { href: '/world-cup-2026-tv-guide',         label: '📺 TV Guide'   },
  { href: '/world-cup-2026/streaming-guide',  label: '💻 Streaming'  },
  { href: '/world-cup-2026/teams',  label: '👥 Teams'  },
  { href: '/world-cup-2026/venues', label: '🏟️ Venues' },
];

export default function WCPageNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="World Cup 2026 navigation"
      className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
    >
      <div className="flex gap-2 min-w-max pb-1">
        {LINKS.map(({ href, label }) => {
          // Active if exact match, or if pathname starts with href (for teams/venues sub-pages)
          const isActive =
            pathname === href ||
            (href === '/world-cup-2026/teams'  && pathname.startsWith('/world-cup-2026/teams/')) ||
            (href === '/world-cup-2026/venues' && pathname.startsWith('/world-cup-2026/venues/'));
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-yellow-500 text-black border-yellow-400'
                  : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border-gray-700'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
