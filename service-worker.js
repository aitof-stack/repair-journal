const CACHE_NAME = 'repair-journal-v4';
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
  console.log('[Service Worker] Установка v4...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Кэширование файлов v4');
        return Promise.all(
          urlsToCache.map(url => {
            return fetch(url, {cache: 'no-cache'})
              .then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                }
                console.log(`[Service Worker] Не удалось загрузить: ${url}`);
              })
              .catch(error => {
                console.error(`[Service Worker] Ошибка кэширования ${url}:`, error);
              });
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Пропуск ожидания активации');
        return self.skipWaiting();
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] Активация v4...');
  
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
  if (!url.origin.startsWith(self.location.origin) && 
      !url.href.includes('raw.githubusercontent.com') &&
      !url.href.includes('githubusercontent.com') &&
      !url.href.includes('corsproxy.io')) {
    return;
  }
  
  // Для GitHub Raw URLs и CORS proxy используем сеть напрямую
  if (url.href.includes('raw.githubusercontent.com') ||
      url.href.includes('githubusercontent.com') ||
      url.href.includes('corsproxy.io')) {
    event.respondWith(
      fetch(event.request, {
        mode: 'cors',
        cache: 'no-cache'
      }).catch(error => {
        console.error('[Service Worker] Ошибка загрузки внешнего ресурса:', error);
        return new Response('Ошибка загрузки внешнего ресурса', {
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
    );
    return;
  }
  
  // Для JavaScript файлов всегда загружаем из сети с проверкой обновлений
  if (event.request.url.includes('.js') && !event.request.url.includes('service-worker.js')) {
    event.respondWith(
      fetch(event.request, {cache: 'no-store'})
        .then(response => {
          // Обновляем кэш
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
  
  // Стратегия Network First для остальных файлов
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Обновляем кэш
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then(response => {
            if (response) {
              return response;
            }
            
            // Если страница не найдена, возвращаем 404.html
            if (event.request.mode === 'navigate') {
              return caches.match('./404.html');
            }
            
            return new Response('Оффлайн или ошибка сети', {
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
  
  if (event.data === 'updateCache') {
    console.log('[Service Worker] Обновление кэша...');
    caches.delete(CACHE_NAME).then(() => {
      self.skipWaiting();
    });
  }
});
