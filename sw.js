/* ============================================
   ClienteAPP — Service Worker (cache v33)
   ============================================ */

const CACHE_NAME    = 'clienteapp-v33';
const CACHE_STATIC  = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/app.css',
  './assets/js/db.js',
  './assets/js/autosave.js',
  './assets/js/totp.js',
  './assets/js/auth.js',
  './assets/js/opciones.js',
  './assets/js/supabase.js',
  './assets/js/ui.js',
  './assets/js/clientes.js',
  './assets/js/proyectos.js',
  './assets/js/pagos.js',
  './assets/js/seguimiento.js',
  './assets/js/dashboard.js',
  './assets/js/configuracion.js',
  './assets/js/finanzas.js',
  './assets/js/tareas.js',
  './assets/js/calculadora.js',
  './assets/js/print.js',
  './assets/js/recibos.js',
  './assets/js/reporte-finanzas.js',
  './assets/js/app.js',
  './assets/vendor/jspdf.umd.min.js',
  './assets/vendor/html2canvas.min.js',
  './assets/vendor/bootstrap-icons/bootstrap-icons.min.css',
  './assets/vendor/bootstrap-icons/fonts/bootstrap-icons.woff2',
  './assets/vendor/bootstrap-icons/fonts/bootstrap-icons.woff',
  './assets/img/icon-192.svg',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/logo-construsoluciones.png',
  './assets/img/sello-construsoluciones.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];

// ── Instalación ───────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CACHE_STATIC).catch(err =>
        console.warn('[SW] Cache parcial:', err)
      ))
      .then(() => self.skipWaiting())
  );
});

// ── Activación — limpiar caches viejos ───────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Eliminando cache viejo:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch — Solo interceptar recursos propios de la app ──────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;
  if (event.request.url.includes('chrome-extension')) return;

  const url = new URL(event.request.url);

  // ── Solo manejar recursos propios o de CDNs permitidas ───────────────────
  // Dejar pasar SIN interceptar cualquier otra URL externa (YouTube, Google, etc.)
  const esPropioApp = url.origin === self.location.origin;
  const esCDNPermitida = url.hostname === 'cdn.jsdelivr.net';

  if (!esPropioApp && !esCDNPermitida) return; // dejar pasar al navegador normal

  // ── CDNs externas (Bootstrap, etc.): cache-first (no cambian nunca) ──────
  if (esCDNPermitida) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request.clone()).then((response) => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── Recursos propios (HTML/JS/CSS): NETWORK-FIRST ────────────────────────
  // Siempre busca la versión más reciente en internet. Si no hay conexión,
  // usa la copia en caché. Así la app se actualiza sola sin Ctrl+Shift+R.
  event.respondWith(
    fetch(event.request.clone()).then((response) => {
      // Descarga exitosa → actualizar caché y devolver la versión fresca
      if (response && response.status === 200 && response.type !== 'opaque') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      // Sin conexión → usar la copia en caché
      return caches.match(event.request).then((cached) => {
        if (cached) return cached;
        // Reintentar ignorando el query string (ej. fuentes .woff2?hash)
        return caches.match(event.request, { ignoreSearch: true }).then((cachedNoQuery) => {
          if (cachedNoQuery) return cachedNoQuery;
          // Fallback offline: devolver index.html para navegación HTML
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
          return new Response('', { status: 408, statusText: 'Offline' });
        });
      });
    })
  );
});

// ── Notificaciones Push ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json().catch(() => ({ title: 'ClienteAPP', body: event.data.text() }));
  event.waitUntil(
    data.then(d => self.registration.showNotification(d.title || 'ClienteAPP', {
      body:    d.body || '',
      icon:    './assets/img/icon-192.svg',
      badge:   './assets/img/icon-192.svg',
      vibrate: [200, 100, 200],
      tag:     'clienteapp-push'
    }))
  );
});

// ── Click en notificación push ────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});

// ── Mensaje desde la app ──────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
