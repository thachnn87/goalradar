// GROWTH-2: canonical URL is /world-cup-2026/third-place.
// This alias captures "third place playoff" search variants and permanently
// redirects so link equity consolidates on the canonical page.
import { redirect } from 'next/navigation';

export default function ThirdPlacePlayoffAlias() {
  redirect('/world-cup-2026/third-place');
}
