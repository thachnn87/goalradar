'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

interface WCGroupTabsClientProps {
  tabs: string[];
  children: ReactNode;
}

export default function WCGroupTabsClient({ tabs, children }: WCGroupTabsClientProps) {
  const [selected, setSelected] = useState(0);
  const childArray = Array.isArray(children) ? children : [children];

  return (
    <div>
      {/* Tab strip — scrollable on mobile */}
      <div
        className="flex overflow-x-auto scrollbar-hide gap-1 pb-1 mb-4"
        role="tablist"
        aria-label="Group standings"
      >
        {tabs.map((tab, i) => (
          <button
            key={tab}
            role="tab"
            aria-selected={i === selected}
            aria-controls={`group-panel-${i}`}
            id={`group-tab-${i}`}
            onClick={() => setSelected(i)}
            className={[
              'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0',
              i === selected
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-gray-800/80 text-gray-400 border border-gray-700/50 hover:text-white hover:border-gray-600',
            ].join(' ')}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Panels — show selected, hide others via CSS (all rendered for SEO/SSR) */}
      {childArray.map((child, i) => (
        <div
          key={i}
          role="tabpanel"
          id={`group-panel-${i}`}
          aria-labelledby={`group-tab-${i}`}
          className={i === selected ? undefined : 'hidden'}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
