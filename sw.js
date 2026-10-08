"use strict";

const CACHE_NAME = "gehrmans-nexus-v8";
const APP_FILES = [
    "./index.html",
    "./snake.html",
    "./shop.html",
    "./guide.html",
    "./rental-profit.html",
    "./manifest.json",
    "./nexus-icon.svg",
    "./nexus-icon-192.png",
    "./nexus-icon-512.png"
];
const APP_URLS = new Set(
    APP_FILES.map(file => new URL(file, self.registration.scope).pathname)
);
const ROOT_PATH = new URL(self.registration.scope).pathname;
const INDEX_URL = new URL("./index.html", self.registration.scope).href;

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(cacheName => cacheName !== CACHE_NAME)
                    .map(cacheName => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;
    if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
        return;
    }

    const requestUrl = new URL(request.url);
    const isAppRoot = requestUrl.pathname === ROOT_PATH;
    const isAppFile = APP_URLS.has(requestUrl.pathname);
    if (!isAppRoot && !isAppFile) {
        return;
    }

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request, { ignoreSearch: true })
            || (isAppRoot ? await cache.match(INDEX_URL) : null);

        if (cachedResponse) {
            event.waitUntil(
                fetch(request)
                    .then(response => {
                        if (response.ok) {
                            return cache.put(request, response);
                        }
                    })
                    .catch(() => {})
            );
            return cachedResponse;
        }

        try {
            const response = await fetch(request);
            if (response.ok) {
                await cache.put(request, response.clone());
            }
            return response;
        } catch (error) {
            if (request.mode === "navigate") {
                const offlinePage = await cache.match(INDEX_URL);
                if (offlinePage) {
                    return offlinePage;
                }
            }
            throw error;
        }
    })());
});
