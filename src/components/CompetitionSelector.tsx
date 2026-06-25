'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { COMPETITIONS } from '@/lib/types';

// WC is always pinned first; remaining competitions follow in their defined order
const WC_CODE = 'WC';
const sorted = [
  COMPETITIONS.find((c) => c.code === WC_CODE)!,
  ...COMPETITIONS.filter((c) => c.code !== WC_CODE),
].filter(Boolean);

export default function CompetitionSelector({
  selected,
  onWCPath,
}: {
  selected: string;
  /** When set (e.g. '/world-cup-2026-standings'), the selector is being rendered
   *  on a WC-specific page. WC tab stays on this path; other tabs navigate to
   *  /standings?competition=<code> so the general standings page handles them. */
  onWCPath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function select(code: string) {
    if (onWCPath !== undefined) {
      if (code === 'WC') {
        router.push(onWCPath);
      } else {
        router.push(`/standings?competition=${code}`);
      }
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.set('competition', code);
      router.push(`?${params.toString()}`);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {sorted.map(({ code, name, flag }) => {
        const isWC      = code === WC_CODE;
        const isSelected = selected === code;

        let className = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ';

        if (isWC) {
          className += isSelected
            ? 'bg-yellow-500 text-black border border-yellow-400 shadow shadow-yellow-500/20'
            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20 hover:text-yellow-300';
        } else {
          className += isSelected
            ? 'bg-green-500 text-white'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white';
        }

        return (
          <button key={code} onClick={() => select(code)} className={className}>
            <span>{flag}</span>
            <span>{isWC && !isSelected ? '🏆 ' : ''}{name}</span>
          </button>
        );
      })}
    </div>
  );
}
