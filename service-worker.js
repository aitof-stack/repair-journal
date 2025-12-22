const CACHE_NAME = 'repair-journal-v3';
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
  const url = new URL(event.request.url);
  
  // Пропускаем запросы к внешним ресурсам
  if (!url.origin.startsWith(self.location.origin) && 
      !url.href.includes('raw.githubusercontent.com') &&
      !url.href.includes('githubusercontent.com')) {
    return;
  }
  
  // Для GitHub Raw URLs добавляем CORS заголовки
  if (url.href.includes('raw.githubusercontent.com') ||
      url.href.includes('githubusercontent.com')) {
    event.respondWith(
      fetch(event.request, {
        mode: 'cors',
        cache: 'no-cache'
      }).catch(() => {
        return new Response('Ошибка загрузки внешнего ресурса', {
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
    );
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
            if (!response || response.status !== 200 || response.type === 'error') {
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
    self.skipWaiting();
  }
});
