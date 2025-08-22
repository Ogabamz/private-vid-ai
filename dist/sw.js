const CACHE_NAME = 'private-tube-cache-v1';
const STATIC_ASSETS = [
  "/private-vid-ai/",
  "/private-vid-ai/index.html",
  "/private-vid-ai/manifest.json",
  "/private-vid-ai/favicon.ico",
  "/private-vid-ai/robots.txt",
  "/private-vid-ai/placeholder.svg",
  "/private-vid-ai/assets/index-mpu01gA7.css",
  "/private-vid-ai/assets/index-CvqN2Jd1.js"
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
    .then((cacheNames) => {
      return Promise.all(
        cacheNames
        .filter((cacheName) => cacheName !== CACHE_NAME)
        .map((cacheName) => caches.delete(cacheName)) // Delete old caches
      );
    })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Only handle GET requests    
  if (event.request.method !== 'GET') return;
  
  // Skip API requests and external resources
  if (event.request.url.includes('googleapis.com') || 
      event.request.url.includes('youtube.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
    .then((response) => {
      return response || fetch(event.request);
    })
  );
});