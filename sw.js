/**
 * sw.js — Service Worker SIREVAQ
 * Cache-first para activos estáticos. Garantiza disponibilidad offline.
 * Versión: 2026.4
 */

const CACHE_NAME = 'js1-reportes-v2026-77';

// IMPORTANTE: index.html YA NO carga main.js/rda_ui.js/etc. sueltos -- desde que existe
// build-bundle.js carga dist/bundle-head.js y dist/bundle-body.js (empaquetados). Antes
// esta lista precacheaba los archivos sueltos (que ya nadie pide) y dejaba SIN respaldo
// offline a los bundles reales -- si la red fallaba justo al pedirlos, esos <script defer>
// simplemente no cargaban y decenas de funciones (RDA, Jeringas, Concentrado, etc.)
// quedaban indefinidas en silencio (ver Sentry SIREVAQ-X, "resetCsvUploadModal is not a
// function"). Se precachea la ruta SIN "?v=" a propósito: en producción siempre se pide
// con query string (cache-busting), así que Network-First primero intenta red y solo cae
// a este respaldo -- vía el fallback "ignoreSearch" del fetch handler de abajo -- cuando
// la red realmente falla.
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './tailwind_compiled.css',
  './dist/bundle-head.js',
  './dist/bundle-body.js',
  './mobile.html',
  './mobile_style.css',
  './mobile_main.js',
  './feedback_autoreply.js',
  './perfil_cuenta.js',
  './site.webmanifest',
  './favicon.svg',
  './favicon.ico',
  './favicon-96x96.png',
  './apple-touch-icon.png',
  './web-app-manifest-192x192.png',
  './web-app-manifest-512x512.png',
];

// ── INSTALACIÓN: Pre-cachear activos estáticos ──────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando y cacheando activos estáticos...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cada asset tiene su propio .catch() para que un fallo no aborte la instalación
      return Promise.all(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] No se pudo cachear: ${url}`, err);
          })
        )
      );
    }).then(() => {
      console.log('[SW] Instalación completa. Activando inmediatamente...');
      return self.skipWaiting();
    })
  );
});

// ── ACTIVACIÓN: Limpiar cachés obsoletas ────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activado. Limpiando cachés antiguas...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log(`[SW] Eliminando caché obsoleta: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH: Estrategia Network-First con caché como respaldo ─────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorar solicitudes a Supabase, CDNs, y extensiones del navegador
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('raw.githubusercontent.com') ||
    url.hostname.includes('sentry-cdn.com') ||
    url.hostname.includes('sentry.io') ||
    url.hostname.includes('posthog.com') ||
    url.protocol === 'chrome-extension:'
  ) {
    return; // Dejar que el navegador maneje estas peticiones directamente
  }

  // Solo manejar solicitudes GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    // Estrategia: Network First → Caché como respaldo
    fetch(event.request)
      .then((networkResponse) => {
        // Si la red responde bien, actualizar caché y devolver respuesta
        if (networkResponse && networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Sin red: servir desde caché con matching robusto
        return caches.open(CACHE_NAME).then(async (cache) => {
          // 1. Intento exacto
          let cached = await cache.match(event.request);
          if (cached) return cached;

          // 2. Ignorar query string (activos versionados como main.js?v=XXXX)
          cached = await cache.match(event.request, { ignoreSearch: true });
          if (cached) return cached;

          // 3. Para navegación SPA: buscar index.html por URL absoluta
          if (event.request.mode === 'navigate') {
            const scope = self.registration.scope;
            cached = await cache.match(new URL('./index.html', scope).href);
            if (cached) return cached;

            cached = await cache.match(new URL('./', scope).href);
            if (cached) return cached;
          }

          return new Response('', { status: 404, statusText: 'Offline' });
        });
      })
  );
});
