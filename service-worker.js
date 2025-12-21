const CACHE_NAME = 'repair-journal-v1';
const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './style.css',
  './javascript.js',
  './auth.js',
  './manifest.json',
  './404.html'
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Установка...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Кэширование файлов');
        return cache.addAll(urlsToCache).catch(error => {
          console.error('[Service Worker] Ошибка кэширования:', error);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] Активация...');
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
      return self.clients.claim();
    })
  );
});

// Обработка запросов
self.addEventListener('fetch', event => {
  // Пропускаем запросы к внешним ресурсам и Chrome extensions
  if (!event.request.url.startsWith(self.location.origin) || 
      event.request.url.includes('chrome-extension://')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Возвращаем кэшированный файл, если есть
        if (response) {
          console.log('[Service Worker] Возвращаем из кэша:', event.request.url);
          return response;
        }
        
        // Иначе загружаем из сети
        return fetch(event.request)
          .then(response => {
            // Проверяем валидность ответа
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Клонируем ответ
            const responseToCache = response.clone();
            
            // Кэшируем новый ресурс
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(error => {
            console.error('[Service Worker] Ошибка fetch:', error);
            // Если страница не найдена, возвращаем 404.html
            if (event.request.mode === 'navigate') {
              return caches.match('./404.html');
            }
            return new Response('Ошибка сети');
          });
      })
  );
});

// Обработка сообщений
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
