// sw.js — Service Worker for offline support

const CACHE_NAME = 'image-stitch-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/preprocessor.js',
  './js/matcher.js',
  './js/renderer.js',
  './js/i18n.js',
  './manifest.json'
];

// OpenCV.js는 별도 캐시 (크기가 크므로 한 번만 캐싱)
const OPENCV_URL = 'https://docs.opencv.org/4.9.0/opencv.js';
const OPENCV_CACHE = 'opencv-v1';

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)),
      caches.open(OPENCV_CACHE).then(cache => cache.add(OPENCV_URL))
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== OPENCV_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // 성공한 응답은 캐시에 저장
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // 오프라인이고 캐시에도 없으면 기본 페이지 반환
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
