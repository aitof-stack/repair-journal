const CACHE_NAME = 'repair-journal-v5.0.6';
const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './style.css',
  './javascript.js?v=5.0.6',
  './auth.js',
  './firebase-config.js',
  './manifest.json',
  './404.html'
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Установка v5.0.6...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Кэширование файлов v5.0.6');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] Активация v5.0.6...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Очистка кэша выполнена');
      return self.clients.claim();
    })
  );
});

// Обработка запросов
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Пропускаем запросы к Firebase и внешним ресурсам
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('adguard')) {
    return fetch(event.request);
  }
  
  // Для локальных файлов используем Cache First
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          
          return fetch(event.request)
            .then(response => {
              if (!response || response.status !== 200) {
                return response;
              }
              
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
              
              return response;
            })
            .catch(() => {
              // Для навигационных запросов возвращаем index.html
              if (event.request.mode === 'navigate') {
                return caches.match('./index.html');
              }
              return new Response('Офлайн режим', {
                status: 503,
                headers: { 'Content-Type': 'text/plain' }
              });
            });
        })
    );
  }
});

// Получение сообщений от главного потока
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
