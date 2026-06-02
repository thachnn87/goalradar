'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const INTERVAL = 30;

export default function LiveRefresher() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(INTERVAL);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          router.refresh();
          return INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span
        className="w-4 h-4 rounded-full border-2 border-gray-700 border-t-green-400 animate-spin"
        aria-hidden
      />
      Refreshes in {countdown}s
    </div>
  );
}
