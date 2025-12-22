const CACHE_NAME = 'repair-journal-v5';
const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './style.css',
  './javascript.js',
  './auth.js',
  './manifest.json',
  './404.html',
  './data/equipment_database.csv'
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Установка v5...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Кэширование файлов v5');
        return cache.addAll(urlsToCache).catch(error => {
          console.error('[Service Worker] Ошибка кэширования:', error);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] Активация v5...');
  
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
  
  // Пропускаем запросы к внешним ресурсам (кроме нашего origin)
  if (!url.origin.startsWith(self.location.origin)) {
    return;
  }
  
  // Для динамических данных используем Network First стратегию
  if (event.request.url.includes('repair_requests.json') || 
      event.request.url.includes('data/equipment_database.csv')) {
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
  
  // Для остальных файлов используем Cache First стратегию
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
            // Если страница не найдена, возвращаем 404.html
            if (event.request.mode === 'navigate') {
              return caches.match('./404.html');
            }
            return new Response('Ошибка сети', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Обработка сообщений
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    console.log('[Service Worker] Получена команда skipWaiting');
    self.skipWaiting();
  }
  
  if (event.data === 'clearCache') {
    console.log('[Service Worker] Очистка кэша...');
    caches.delete(CACHE_NAME).then(() => {
      self.skipWaiting();
    });
  }
});
