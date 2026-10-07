const CACHE_NAME = 'quillhive-v4';
const STATIC_ASSETS = ['/favicon.png', '/images/logo-icon-192.png', '/images/logo-icon.png'];
const OFFICIAL_NOTICE_WARNING = "QuillHive staff will never ask you to pay money, share your password, or click a link to 'verify' your account through a notification or DM.";

self.addEventListener('install', (event) => {
      event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
      );
        self.skipWaiting();
});

self.addEventListener('activate', (event) => {
      event.waitUntil(
            caches.keys().then((keys) =>
                  Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
                      )
      );
        self.clients.claim();
});

self.addEventListener('fetch', (event) => {
      if (event.request.url.includes('/api/')) return;
        if (event.request.method !== 'GET') return;
                              if (new URL(event.request.url).origin !== self.location.origin) return;
                              if (!['script', 'style', 'image', 'font'].includes(event.request.destination)) return;

          event.respondWith(
                fetch(event.request)
                      .then((response) => {
                                const clone = response.clone();
                                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                                                return response;
                      })
                            .catch(() => caches.match(event.request))
          );
});

self.addEventListener('push', (event) => {
      const data = event.data?.json() ?? {};
        const isOfficialNotice = data.type === 'official_notice';
        event.waitUntil(
                self.registration.showNotification(data.title || 'QuillHive', {
                          body: isOfficialNotice
                                ? `${data.body || 'You have a new notification'}\n\n${OFFICIAL_NOTICE_WARNING}`
                                : (data.body || 'You have a new notification'),
                                icon: '/images/logo-icon-192.png',
                                      badge: '/favicon.png',
                                            data: { url: data.url || '/' },
                })
        );
});
