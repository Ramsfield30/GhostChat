const CACHE = 'ghostchat-v2'
const FILES = [
    '/',
    '/index.html',
    '/login.html',
    '/signup.html',
    '/chats.html',
    '/chat.html',
    '/settings.html',
    '/style.css',
    '/script.js',
    '/supabase.js',
    '/offline.html',
    '/icon-192.png',
    '/icon-512.png'
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
    self.clients.claim()
})

self.addEventListener('fetch', e => {
    e.respondWith(
        fetch(e.request).catch(() => {
            return caches.match(e.request) || caches.match('/offline.html')
        })
    )
})

// Handle push notifications
self.addEventListener('push', e => {
    const data = e.data ? e.data.json() : {}
    const title = data.title || '👻 GhostChat'
    const options = {
        body: data.body || 'New message!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        data: { url: data.url || '/chats.html' }
    }
    e.waitUntil(self.registration.showNotification(title, options))
})

// Handle notification click
self.addEventListener('notificationclick', e => {
    e.notification.close()
    e.waitUntil(
        clients.openWindow(e.notification.data.url || '/chats.html')
    )
})
