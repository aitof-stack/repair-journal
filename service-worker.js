const CACHE_NAME = 'repair-journal-v4.2.0';
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
  console.log('[Service Worker] Установка v4.2.0...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Кэширование файлов v4.2.0');
        return cache.addAll(urlsToCache).catch(error => {
          console.error('[Service Worker] Ошибка кэширования:', error);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] Активация v4.2.0...');
  
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
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Обработка запросов
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Пропускаем запросы к внешним ресурсам
  if (!url.origin.startsWith(self.location.origin)) {
    return;
  }
  
  // Для CSV файлов используем Network First
  if (event.request.url.includes('equipment_database.csv')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Клонируем ответ для кэша
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Для остальных файлов используем Cache First
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        return fetch(event.request)
          .then(response => {
            // Проверяем валидность ответа
            if (!response || response.status !== 200) {
              return response;
            }
            
            // Клонируем ответ для кэша
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(error => {
            console.error('[Service Worker] Ошибка fetch:', error);
            // Если страница не найдена, возвращаем index.html
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return new Response('Ошибка сети', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});
