/* eslint-disable no-restricted-globals */
// CRA finds this file at build time and fills in self.__WB_MANIFEST
// with a list of every file in the build (JS, CSS, HTML, images).

import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";

clientsClaim();

// 1. Save every file from the build so the app opens with no signal.
//    Videos are left out: they're only decoration on the public pages, and
//    precaching them would download several MB in the background for every
//    visitor, including ones who never use the screener.
const SKIP_PRECACHE = /\.(mp4|webm|mov)$/i;
precacheAndRoute(self.__WB_MANIFEST.filter((entry) => !SKIP_PRECACHE.test(entry.url)));

// 2. Any page navigation (typing the URL, refreshing) gets index.html.
//    React then decides what to show. Skip anything that looks like a file.
const fileExtensionRegexp = new RegExp("/[^/?]+\\.[^/]+$");
registerRoute(
  ({ request, url }) => {
    if (request.mode !== "navigate") return false;
    if (url.pathname.startsWith("/_")) return false;
    if (url.pathname.match(fileExtensionRegexp)) return false;
    return true;
  },
  createHandlerBoundToURL(process.env.PUBLIC_URL + "/index.html")
);

// 3. Images from the public folder (logo, puzzle images).
//    Show the saved copy straight away, quietly fetch a fresh one in the background.
registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin && request.destination === "image",
  new StaleWhileRevalidate({
    cacheName: "images",
    plugins: [new ExpirationPlugin({ maxEntries: 60 })],
  })
);

// 4. Google Fonts (Poppins, DM Sans), so the screener keeps the same look
//    offline instead of falling back to system fonts.
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts-css" })
);
registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-files",
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
);

// Supabase requests are deliberately NOT cached here.
// Screener questions and results are handled by offlineVault.js, encrypted.
// Caching API responses here would store them in plain text.

// 5. Lets the app tell a waiting service worker to take over (used by the update prompt)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// 6. Web Push — receives a message from the send-push Edge Function and shows
//    it as an OS-level notification even when the app is closed.
//    (This used to live in public/service-worker.js, but the CRA build
//    overwrites that file with this one — so the handlers must live here.)
self.addEventListener("push", (event) => {
  let data = { title: "PuzzleBox Screener", body: "You have a new notification." };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Payload wasn't JSON — fall back to the default text above.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/logo192.png",
      badge: "/logo192.png",
      data: { url: data.url || "/" },
    })
  );
});

// Clicking focuses an already-open tab if there is one, otherwise opens the URL.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});