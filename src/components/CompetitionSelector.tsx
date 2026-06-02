'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { COMPETITIONS } from '@/lib/types';

export default function CompetitionSelector({ selected }: { selected: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function select(code: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('competition', code);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {COMPETITIONS.map(({ code, name, flag }) => (
        <button
          key={code}
          onClick={() => select(code)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
            selected === code
              ? 'bg-green-500 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
        >
          <span>{flag}</span>
          <span>{name}</span>
        </button>
      ))}
    </div>
  );
}
