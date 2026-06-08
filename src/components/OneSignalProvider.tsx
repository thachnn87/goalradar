'use client';

/**
 * OneSignalProvider
 *
 * Initialises the OneSignal Web SDK v16 once the SDK script has loaded.
 * Must be rendered inside the <body> on every page.
 *
 * Does nothing when NEXT_PUBLIC_ONESIGNAL_APP_ID is not set, so the
 * feature is opt-in via environment variable.
 *
 * The SDK script itself is loaded via <Script> in layout.tsx with
 * strategy="afterInteractive".
 */

import { useEffect } from 'react';

const APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? '';

export default function OneSignalProvider() {
  useEffect(() => {
    if (!APP_ID) return;

    window.OneSignalDeferred = window.OneSignalDeferred ?? [];
    window.OneSignalDeferred.push(async (sdk) => {
      await sdk.init({
        appId:               APP_ID,
        notifyButton:        { enable: false },   // we use our own UI
        welcomeNotification: { disable: true },    // no auto welcome push
        serviceWorkerParam:  { scope: '/' },
      });
    });
  }, []);

  return null;
}
