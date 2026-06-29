import Image from 'next/image';
import Link from 'next/link';
import type { WCVenue } from '@/lib/wc-venues';
import { getVenueFixtures, getVenueImageSrc } from '@/lib/wc-venues';

interface WCVenueCardProps {
  venue: WCVenue;
}

export default function WCVenueCard({ venue }: WCVenueCardProps) {
  const matchCount = getVenueFixtures(venue.slug).length;
  const isIndoorCapable = /retractable|covered|enclosed|canopy/i.test(venue.roofType);

  return (
    <Link
      href={`/world-cup-2026/venues/${venue.slug}`}
      className="group overflow-hidden rounded-xl border border-gray-800 bg-gray-900 transition-all hover:border-yellow-700/40 hover:bg-gray-800"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-gray-950">
        <Image
          src={getVenueImageSrc(venue.slug)}
          alt={`${venue.name} World Cup 2026 venue guide`}
          fill
          sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold leading-tight text-white transition-colors group-hover:text-yellow-400">
            {venue.name}
          </h3>
          <span className="shrink-0 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 text-xs font-bold text-yellow-400">
            {matchCount}M
          </span>
        </div>

        <p className="mb-3 text-xs text-gray-500">
          {venue.city}, {venue.stateOrRegion}, {venue.country}
        </p>

        <div className="mb-4 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
            {venue.capacity.toLocaleString()} cap.
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
            Opened {venue.openedYear}
          </span>
          {isIndoorCapable ? (
            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400">
              Covered seating
            </span>
          ) : null}
        </div>

        <span className="text-xs font-bold text-yellow-500 transition-colors group-hover:text-yellow-300">
          View Details →
        </span>
      </div>
    </Link>
  );
}
