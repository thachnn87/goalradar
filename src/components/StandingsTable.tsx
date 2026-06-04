import Link from 'next/link';
import { StandingEntry } from '@/lib/types';

export default function StandingsTable({ table }: { table: StandingEntry[] }) {
  const total = table.length;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left w-10">#</th>
              <th className="px-4 py-3 text-left">Team</th>
              <th className="px-4 py-3 text-center w-10">P</th>
              <th className="px-4 py-3 text-center w-10">W</th>
              <th className="px-4 py-3 text-center w-10">D</th>
              <th className="px-4 py-3 text-center w-10">L</th>
              <th className="px-4 py-3 text-center w-12">GD</th>
              <th className="px-4 py-3 text-center w-12 text-white font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {table.map((entry, i) => {
              const zoneColor =
                i < 4
                  ? 'border-l-blue-500'
                  : i === 4
                  ? 'border-l-orange-400'
                  : i >= total - 3
                  ? 'border-l-red-500'
                  : 'border-l-transparent';

              return (
                <tr
                  key={entry.team.id}
                  className={`border-t border-gray-800 border-l-2 ${zoneColor} hover:bg-gray-800/40 transition-colors`}
                >
                  <td className="px-4 py-3 text-gray-400 text-center">{entry.position}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/team/${entry.team.id}`}
                      className="flex items-center gap-2 hover:text-green-400 transition-colors group w-fit"
                    >
                      {entry.team.crest && (
                        <img
                          src={entry.team.crest}
                          alt=""
                          width={20}
                          height={20}
                          className="object-contain shrink-0"
                        />
                      )}
                      <span className="text-white font-medium group-hover:text-green-400 transition-colors">
                        {entry.team.shortName || entry.team.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">{entry.playedGames}</td>
                  <td className="px-4 py-3 text-center text-gray-400">{entry.won}</td>
                  <td className="px-4 py-3 text-center text-gray-400">{entry.draw}</td>
                  <td className="px-4 py-3 text-center text-gray-400">{entry.lost}</td>
                  <td
                    className={`px-4 py-3 text-center ${
                      entry.goalDifference > 0
                        ? 'text-green-400'
                        : entry.goalDifference < 0
                        ? 'text-red-400'
                        : 'text-gray-400'
                    }`}
                  >
                    {entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-white">{entry.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-gray-800 flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Champions League
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /> Europa League
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Relegation
        </span>
      </div>
    </div>
  );
}
