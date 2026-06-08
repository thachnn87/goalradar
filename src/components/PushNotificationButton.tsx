'use client';

/**
 * PushNotificationButton
 *
 * "Enable Match Alerts" CTA that integrates with the OneSignal Web SDK v16.
 *
 * States:
 *   loading      — checking current permission/subscription
 *   unsubscribed — user has not yet opted in
 *   subscribed   — user is opted in (shows confirmation)
 *   denied       — browser permission was blocked
 *   unsupported  — browser does not support push / SDK not configured
 *
 * When the user grants permission, a POST is fired to /api/push/opt-in so
 * the opt-in rate can be tracked in Vercel KV.
 *
 * Props:
 *   matchId    — optional match ID (passed through to the tracking API)
 *   matchLabel — optional human-readable label ("Mexico vs South Africa")
 *   variant    — 'button' (default) | 'banner' (wider strip)
 */

import { useState, useEffect, useCallback } from 'react';

const APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';

type Status = 'loading' | 'unsubscribed' | 'subscribed' | 'denied' | 'unsupported';

interface Props {
  matchId?:    string | number;
  matchLabel?: string;
  variant?:    'button' | 'banner';
}

// ---------------------------------------------------------------------------
// OneSignal helpers
// ---------------------------------------------------------------------------

type WinExt = Window & { _onesignal_sdk?: OneSignalInstance };

function getOneSignal(): Promise<OneSignalInstance | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(null); return; }

    // If already initialised and cached
    if ((window as WinExt)._onesignal_sdk) {
      resolve((window as WinExt)._onesignal_sdk!);
      return;
    }

    window.OneSignalDeferred = window.OneSignalDeferred ?? [];
    window.OneSignalDeferred.push((sdk) => {
      (window as WinExt)._onesignal_sdk = sdk;
      resolve(sdk);
    });

    // Timeout — resolve null if SDK never loads (app ID not set, blocked, etc.)
    setTimeout(() => resolve(null), 5_000);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PushNotificationButton({
  matchId,
  matchLabel,
  variant = 'button',
}: Props) {
  const [status, setStatus] = useState<Status>('loading');

  // Initialise status from browser / localStorage
  useEffect(() => {
    if (!APP_ID || typeof window === 'undefined' || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }

    const perm = Notification.permission;
    if (perm === 'denied') { setStatus('denied'); return; }

    const stored = localStorage.getItem('push_subscribed');
    if (stored === '1' && perm === 'granted') {
      setStatus('subscribed');
    } else {
      setStatus('unsubscribed');
    }
  }, []);

  const handleClick = useCallback(async () => {
    if (status !== 'unsubscribed') return;
    setStatus('loading');

    try {
      const sdk = await getOneSignal();

      let granted = false;

      if (sdk) {
        // OneSignal SDK handles service worker registration + subscription
        granted = await sdk.Notifications.requestPermission();
      } else {
        // Fallback: native browser permission (no OneSignal)
        const perm = await Notification.requestPermission();
        granted = perm === 'granted';
      }

      if (granted) {
        localStorage.setItem('push_subscribed', '1');
        setStatus('subscribed');

        // Fire-and-forget: track opt-in event
        fetch('/api/push/opt-in', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            matchId:    matchId?.toString() ?? null,
            matchLabel: matchLabel ?? null,
          }),
        }).catch(() => { /* non-blocking */ });
      } else {
        setStatus('denied');
      }
    } catch {
      setStatus('unsubscribed');
    }
  }, [status, matchId, matchLabel]);

  // Hide when unsupported (SSR default = 'loading', hides until hydrated)
  if (status === 'unsupported') return null;

  // ---------------------------------------------------------------------------
  // Button variant
  // ---------------------------------------------------------------------------

  if (variant === 'button') {
    if (status === 'subscribed') {
      return (
        <div className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
          <span aria-hidden>✓</span>
          <span>Match alerts enabled</span>
        </div>
      );
    }

    if (status === 'denied') {
      return (
        <div className="flex items-center gap-1.5 text-gray-500 text-xs">
          <span aria-hidden>🔕</span>
          <span>Notifications blocked — enable in browser settings</span>
        </div>
      );
    }

    return (
      <button
        onClick={handleClick}
        disabled={status === 'loading'}
        className="
          inline-flex items-center gap-2
          bg-gray-800 hover:bg-gray-700 active:bg-gray-600
          border border-gray-700 hover:border-yellow-600/50
          disabled:opacity-50 disabled:cursor-not-allowed
          text-white text-sm font-semibold
          px-4 py-2 rounded-xl
          transition-colors
        "
        aria-label="Enable match alert notifications"
      >
        <span className="text-base leading-none" aria-hidden>
          {status === 'loading' ? '⏳' : '🔔'}
        </span>
        {status === 'loading' ? 'Checking…' : 'Enable Match Alerts'}
      </button>
    );
  }

  // ---------------------------------------------------------------------------
  // Banner variant — wider strip for hub pages
  // ---------------------------------------------------------------------------

  if (status === 'subscribed') {
    return (
      <div className="bg-green-950/30 border border-green-800/40 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-green-400 text-lg shrink-0" aria-hidden>✓</span>
        <div>
          <p className="text-green-400 text-sm font-semibold">Match alerts enabled</p>
          <p className="text-gray-500 text-xs mt-0.5">You&apos;ll get push notifications for World Cup 2026 matches.</p>
        </div>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-gray-600 text-lg shrink-0" aria-hidden>🔕</span>
        <p className="text-gray-500 text-sm">
          Notifications are blocked. To enable match alerts, allow notifications for this site in your browser settings.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-2xl shrink-0" aria-hidden>🔔</span>
        <div className="min-w-0">
          <p className="text-white text-sm font-bold">Enable Match Alerts</p>
          <p className="text-gray-400 text-xs mt-0.5">
            Get instant push notifications for World Cup 2026 goals, kick-offs and final whistles.
          </p>
        </div>
      </div>
      <button
        onClick={handleClick}
        disabled={status === 'loading'}
        className="
          shrink-0
          bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600
          disabled:opacity-50 disabled:cursor-not-allowed
          text-black font-bold text-sm
          px-5 py-2.5 rounded-xl
          transition-colors whitespace-nowrap
        "
        aria-label="Enable push notifications for match alerts"
      >
        {status === 'loading' ? 'Checking…' : '🔔 Enable Alerts'}
      </button>
    </div>
  );
}
