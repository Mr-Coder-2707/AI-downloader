// AI Media Assistant - Service Worker
const CACHE_NAME = 'ai-media-assistant-v1.0.0';
const DYNAMIC_CACHE = 'ai-media-assistant-dynamic-v1.0.0';

const STATIC_ASSETS = [
  '/',
  '/static/css/style.css',
  '/static/js/script.js',
  '/static/manifest.json',
  '/static/img/dfd.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css'
];

// Install Event - Cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.error('[Service Worker] Cache failed:', err);
      });
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== DYNAMIC_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Event - Network First, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip cross-origin requests
  if (!request.url.startsWith(self.location.origin) && !request.url.includes('cdn.')) {
    return;
  }

  // API requests - Network First
  if (request.url.includes('/api/') || request.url.includes('/download')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets - Cache First
  event.respondWith(cacheFirst(request));
});

// Cache First Strategy
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.status === 200) {
      const dynamicCache = await caches.open(DYNAMIC_CACHE);
      dynamicCache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('[Service Worker] Fetch failed:', error);
    
    // Return offline page if available
    const offlineResponse = await caches.match('/offline.html');
    if (offlineResponse) {
      return offlineResponse;
    }
    
    return new Response('Offline - No cached content available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Network First Strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful API responses
    if (response.status === 200) {
      const dynamicCache = await caches.open(DYNAMIC_CACHE);
      dynamicCache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('[Service Worker] Network request failed:', error);
    
    // Fallback to cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    return new Response('Network error occurred', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Background Sync for failed downloads
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-downloads') {
    event.waitUntil(syncDownloads());
  }
});

async function syncDownloads() {
  console.log('[Service Worker] Syncing downloads...');
  // Add sync logic here if needed
}

// Push Notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/static/img/dfd.png',
    badge: '/static/img/dfd.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('AI Media Assistant', options)
  );
});

// Notification Click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});

// Message Handler
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[Service Worker] Loaded successfully');