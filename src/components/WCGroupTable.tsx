import Link from 'next/link';
import type { StandingEntry } from '@/lib/types';

function groupLabel(raw: string | null) {
  if (!raw) return 'Group';
  return raw.replace(/_/g, ' ').replace(/^GROUP /, 'Group ');
}

export default function WCGroupTable({
  group,
  table,
}: {
  group: string;
  table: StandingEntry[];
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="bg-gray-800/80 px-4 py-2.5">
        <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
          {groupLabel(group)}
        </h3>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-600 border-b border-gray-800/60">
            <th className="px-3 py-1.5 text-left w-6">#</th>
            <th className="px-3 py-1.5 text-left">Team</th>
            <th className="px-2 py-1.5 text-center w-7">P</th>
            <th className="px-2 py-1.5 text-center w-7">W</th>
            <th className="px-2 py-1.5 text-center w-7">D</th>
            <th className="px-2 py-1.5 text-center w-7">L</th>
            <th className="px-2 py-1.5 text-center w-9 text-white font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {table.map((entry, i) => {
            const advances = i < 2;
            return (
              <tr
                key={entry.team.id}
                className={`border-t border-gray-800/40 border-l-2 ${
                  advances ? 'border-l-green-500' : 'border-l-transparent'
                } hover:bg-gray-800/40 transition-colors`}
              >
                <td className="px-3 py-2 text-gray-500 text-center">{entry.position}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/team/${entry.team.id}`}
                    className="flex items-center gap-1.5 group"
                  >
                    {entry.team.crest && (
                      <img
                        src={entry.team.crest}
                        alt=""
                        width={14}
                        height={14}
                        className="object-contain shrink-0"
                      />
                    )}
                    <span className="text-white font-medium truncate group-hover:text-green-400 transition-colors">
                      {entry.team.shortName || entry.team.name}
                    </span>
                  </Link>
                </td>
                <td className="px-2 py-2 text-center text-gray-400">{entry.playedGames}</td>
                <td className="px-2 py-2 text-center text-gray-400">{entry.won}</td>
                <td className="px-2 py-2 text-center text-gray-400">{entry.draw}</td>
                <td className="px-2 py-2 text-center text-gray-400">{entry.lost}</td>
                <td className="px-2 py-2 text-center font-bold text-white">{entry.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
