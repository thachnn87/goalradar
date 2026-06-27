'use client';

// DATA-18WC.RUNTIME.TRUTH Phase 4: interval from runtime-clock.ts (ONE CLOCK).
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RUNTIME_POLL_INTERVAL } from '@/lib/runtime-clock';

export default function LiveRefresher() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(RUNTIME_POLL_INTERVAL);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          router.refresh();
          return RUNTIME_POLL_INTERVAL;
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
