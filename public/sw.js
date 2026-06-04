// NutriTwin Service Worker — v1
// Stratégie : Network-first pour les pages, Cache-first pour les assets statiques.
// Les routes /api/* et les appels Supabase/Google ne sont jamais mis en cache.

const CACHE_VERSION = "nutri-twin-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PRECACHE_URLS = ["/", "/login", "/patient-login"];

// ═══ INSTALL ═══
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { credentials: "same-origin" })))
    ).catch(() => {
      // Silencieux si une page n'est pas accessible au moment de l'install
    })
  );
  self.skipWaiting();
});

// ═══ ACTIVATE ═══
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("nutri-twin-") && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ═══ FETCH ═══
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer : requêtes non-GET, extensions navigateur, websockets
  if (request.method !== "GET") return;
  if (!url.protocol.startsWith("http")) return;

  // NetworkOnly : routes API, Supabase, Google AI, Upstash, Resend
  const noCache = [
    "/api/",
    "supabase.co",
    "googleapis.com",
    "generativelanguage.googleapis.com",
    "upstash.io",
    "resend.com",
    "stripe.com",
  ];
  if (noCache.some((pattern) => url.pathname.startsWith(pattern) || url.hostname.includes(pattern))) {
    return; // Laisser le navigateur gérer directement
  }

  // Network-first pour la navigation (pages HTML)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Mettre en cache la page fraîche
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          // Hors-ligne : tenter depuis le cache, sinon page d'accueil
          caches.match(request).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  // Cache-first pour les assets statiques (_next/static, images, fonts, icônes)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Stale-while-revalidate pour les scripts/_next/chunks
  if (request.destination === "script" || request.destination === "style") {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
          return cached || fetchPromise;
        })
      )
    );
  }
});

// ═══ PUSH NOTIFICATIONS (prêt pour la prochaine itération) ═══
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "NutriTwin", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
