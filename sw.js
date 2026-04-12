const CACHE = 'ghostchat-v1'
const FILES = [
    '/',
    '/index.html',
    '/chats.html',
    '/chat.html',
    '/settings.html',
    '/style.css',
    '/script.js',
    '/supabase.js',
    '/offline.html'
]

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(FILES))
    )
    self.skipWaiting()
})

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    )
})

self.addEventListener('fetch', e => {
    e.respondWith(
        fetch(e.request).catch(() => {
            return caches.match(e.request) || caches.match('/offline.html')
        })
    )
})