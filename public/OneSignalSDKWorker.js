/**
 * OneSignal Service Worker
 *
 * This file must live at the root of the site (/OneSignalSDKWorker.js).
 * It delegates to the official OneSignal SDK service worker on their CDN.
 * Do NOT rename or move this file.
 */
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
