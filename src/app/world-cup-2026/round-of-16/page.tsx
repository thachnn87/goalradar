// GROWTH-2A: knockout round landing page — thin wrapper over WCRoundPage.
// Data via getWCKnockoutMatchesCached (KV-only, zero provider calls).
import WCRoundPage, { buildRoundMetadata } from '@/components/WCRoundPage';

// Results land during the round — refresh every 15 min (FIXTURES TTL).
export const revalidate = 900;

export const metadata = buildRoundMetadata('round-of-16');

export default function Page() {
  return <WCRoundPage slug="round-of-16" />;
}
