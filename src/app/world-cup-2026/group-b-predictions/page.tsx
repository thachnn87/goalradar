import type { Metadata } from 'next';
import WCGroupPredictionsTemplate from '@/components/WCGroupPredictionsTemplate';
import { GROUP_PREDICTIONS } from '@/lib/wc-predictions';

export const revalidate = 86400;

const data = GROUP_PREDICTIONS['B'];

export const metadata: Metadata = {
  title: data.metaTitle,
  description: data.metaDesc,
  alternates: { canonical: 'https://goalradar.org/world-cup-2026/group-b-predictions' },
  openGraph: { title: data.metaTitle, description: data.metaDesc, type: 'article', url: 'https://goalradar.org/world-cup-2026/group-b-predictions' },
  twitter: { card: 'summary_large_image', title: data.metaTitle, description: data.metaDesc },
};

export default function GroupBPredictionsPage() {
  return <WCGroupPredictionsTemplate group="B" data={data} />;
}
