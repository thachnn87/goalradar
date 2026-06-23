import type { QualificationStatus } from '@/lib/wc-qualification';
import { QUAL_BADGE_STYLES } from '@/lib/wc-qualification';

/**
 * Compact qualification status pill.
 *
 * Props:
 *   status      — one of the four QualificationStatus values
 *   reason      — optional tooltip / sub-text (shown below label when present)
 *   probability — optional 0–100 percentage (shown as muted text)
 *   compact     — true → single-letter pill only (for tight table cells)
 */
export default function WCQualBadge({
  status,
  reason,
  probability,
  compact = false,
}: {
  status:       QualificationStatus;
  reason?:      string;
  probability?: number;
  compact?:     boolean;
}) {
  const style = QUAL_BADGE_STYLES[status];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-black ${style.badgeClass}`}
        title={reason ?? style.label}
        aria-label={style.label}
      >
        {style.shortLabel}
      </span>
    );
  }

  return (
    <div className={`inline-flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${style.badgeClass}`}>
      <span>{style.label}</span>
      {reason && (
        <span className="text-[10px] font-normal opacity-70 leading-snug">{reason}</span>
      )}
      {probability !== undefined && probability < 1 && probability > 0 && (
        <span className="text-[10px] font-normal opacity-60">
          {Math.round(probability * 100)}% chance
        </span>
      )}
    </div>
  );
}
