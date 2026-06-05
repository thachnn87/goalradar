import type { Metadata } from 'next';
import { WC_TEAMS } from '@/lib/wc-teams';
import WCTeamPageContent from '@/components/WCTeamPageContent';

export const revalidate = 60;

const TEAM = WC_TEAMS.mexico;
const BASE_URL = 'https://goalradar.org';
const PAGE_URL = `${BASE_URL}/world-cup-2026/${TEAM.slug}`;

export const metadata: Metadata = {
  title: 'Mexico FIFA World Cup 2026 – Schedule, Squad & Live Scores | GoalRadar',
  description: TEAM.metaDescription,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: 'Mexico – FIFA World Cup 2026 | GoalRadar',
    description: TEAM.metaDescription,
    type: 'website',
    url: PAGE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mexico – FIFA World Cup 2026 | GoalRadar',
    description: TEAM.metaDescription,
  },
};

export default function MexicoTeamPage() {
  return <WCTeamPageContent team={TEAM} />;
}
