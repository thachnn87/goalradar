import Link from 'next/link';
import type { StandingEntry } from '@/lib/types';
import { teamPath } from '@/lib/url';
import {
  type QualificationStatus,
  QUAL_BADGE_STYLES,
  positionToStatus,
} from '@/lib/wc-qualification';

function groupLabel(raw: string | null) {
  if (!raw) return 'Group';
  return raw.replace(/_/g, ' ').replace(/^GROUP /, 'Group ');
}

/**
 * WCGroupTable — renders a single group standings table.
 *
 * qualifications: optional Map<teamId, QualificationStatus> from the engine.
 *   When provided, border-left and row tint reflect engine output.
 *   When absent, falls back to position-based defaults (P1/P2 = green).
 */
export default function WCGroupTable({
  group,
  table,
  href,
  qualifications,
}: {
  group:          string;
  table:          StandingEntry[];
  /** Optional link destination for the group header (e.g. /world-cup-2026/group-a) */
  href?:          string;
  /** teamId → QualificationStatus from the engine */
  qualifications?: Map<number, QualificationStatus>;
}) {
  const label = groupLabel(group);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="bg-gray-800/80 px-4 py-2.5">
        {href ? (
          <Link
            href={href}
            className="flex items-center justify-between group"
          >
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider group-hover:text-white transition-colors">
              {label}
            </h3>
            <span className="text-gray-600 text-xs group-hover:text-gray-400 transition-colors">→</span>
          </Link>
        ) : (
          <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
            {label}
          </h3>
        )}
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
            const status: QualificationStatus =
              qualifications?.get(entry.team.id) ??
              positionToStatus(entry.position || (i + 1), entry.playedGames);
            const style = QUAL_BADGE_STYLES[status];
            return (
              <tr
                key={entry.team.id || i}
                className={`border-t border-gray-800/40 border-l-2 ${style.borderColor} ${style.bgColor} hover:bg-gray-800/40 transition-colors`}
              >
                <td className="px-3 py-2 text-gray-500 text-center">{entry.position}</td>
                <td className="px-3 py-2">
                  {/* Only render as a link when the team has a valid API id */}
                  {entry.team.id > 0 ? (
                    <Link
                      href={teamPath(entry.team.id, entry.team.name)}
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
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {entry.team.crest && (
                        <img
                          src={entry.team.crest}
                          alt=""
                          width={14}
                          height={14}
                          className="object-contain shrink-0"
                        />
                      )}
                      <span className="text-white font-medium truncate">
                        {entry.team.shortName || entry.team.name}
                      </span>
                    </div>
                  )}
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
