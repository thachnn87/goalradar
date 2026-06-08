/**
 * Ambient type declarations for the OneSignal Web SDK v16.
 *
 * This file is a TypeScript "script" (no imports/exports) so all declarations
 * are automatically in the global scope — no `declare global {}` wrapper needed.
 *
 * Full API: https://documentation.onesignal.com/docs/web-sdk-reference
 */

// ---------------------------------------------------------------------------
// OneSignal SDK interfaces
// ---------------------------------------------------------------------------

interface OneSignalUserPushSubscription {
  /** true when the user is currently opted in to push notifications. */
  readonly optedIn: boolean;
  /** Canonical push subscription ID assigned by OneSignal. */
  readonly id: string | null;
}

interface OneSignalUser {
  readonly PushSubscription: OneSignalUserPushSubscription;
}

interface OneSignalNotifications {
  /**
   * Current browser notification permission.
   * true = 'granted', false = 'denied' or 'default'.
   */
  readonly permission: boolean;
  /** Request the browser notification permission popup. Resolves to true on grant. */
  requestPermission(): Promise<boolean>;
  addEventListener(
    event: 'permissionChange',
    fn: (permission: boolean) => void,
  ): void;
  removeEventListener(
    event: 'permissionChange',
    fn: (permission: boolean) => void,
  ): void;
}

interface OneSignalInstance {
  init(options: {
    appId: string;
    notifyButton?:        { enable: boolean };
    welcomeNotification?: { disable: boolean };
    serviceWorkerParam?:  { scope: string };
  }): Promise<void>;
  readonly Notifications: OneSignalNotifications;
  readonly User:          OneSignalUser;
}

// ---------------------------------------------------------------------------
// Window augmentation (script-mode — no declare global wrapper)
// ---------------------------------------------------------------------------

interface Window {
  /**
   * OneSignal deferred call queue.
   * Populated before the SDK script loads; drained once it is ready.
   */
  OneSignalDeferred: Array<(sdk: OneSignalInstance) => void>;
}
