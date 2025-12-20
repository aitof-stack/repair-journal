const CACHE_NAME = 'repair-journal-v1';

self.addEventListener('install', event => {
  console.log('Service Worker установлен');
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        console.log('Офлайн режим');
        return new Response('Вы в офлайн режиме');
      })
  );
});