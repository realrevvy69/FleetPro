/* FleetPro Service Worker — push + offline cache + write queue */
const CACHE = "fleetpro-shell-v2";
const RUNTIME = "fleetpro-runtime-v2";
const SHELL_URLS = [
  "/",
  "/manifest.json",
  "/favicon.ico",
];

// ---------- INSTALL / ACTIVATE ----------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![CACHE, RUNTIME].includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ---------- FETCH STRATEGIES ----------
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip cross-origin and non-GET (write queue handled below for /api)
  if (req.method !== "GET") {
    if (url.pathname.startsWith("/api/")) {
      event.respondWith(handleWriteRequest(req));
    }
    return;
  }

  // API GET → network first, fallback to runtime cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // App shell / static → cache first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
  }
});

const networkFirst = async (req) => {
  try {
    const res = await fetch(req);
    const cache = await caches.open(RUNTIME);
    cache.put(req, res.clone());
    return res;
  } catch (e) {
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response(JSON.stringify({ offline: true }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
};

const cacheFirst = async (req) => {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok && req.url.startsWith(self.location.origin)) {
      const cache = await caches.open(RUNTIME);
      cache.put(req, res.clone());
    }
    return res;
  } catch (e) {
    return caches.match("/");
  }
};

// ---------- WRITE QUEUE (IndexedDB) ----------
const DB_NAME = "fleetpro-queue";
const DB_STORE = "writes";

const openDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const addToQueue = async (entry) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).add(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const getQueue = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
};

const deleteFromQueue = async (id) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const handleWriteRequest = async (req) => {
  try {
    const res = await fetch(req.clone());
    return res;
  } catch (err) {
    // offline → queue
    const body = await req.clone().text();
    await addToQueue({
      url: req.url,
      method: req.method,
      headers: [...req.headers.entries()],
      body,
      ts: Date.now(),
    });
    if ("sync" in self.registration) {
      try { await self.registration.sync.register("fleetpro-sync"); } catch {}
    }
    return new Response(JSON.stringify({ queued: true, offline: true }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }
};

const flushQueue = async () => {
  const items = await getQueue();
  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: new Headers(item.headers),
        body: item.body || undefined,
      });
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        await deleteFromQueue(item.id);
      }
    } catch {
      // still offline — stop trying
      return;
    }
  }
};

self.addEventListener("sync", (event) => {
  if (event.tag === "fleetpro-sync") event.waitUntil(flushQueue());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "FLUSH_QUEUE") {
    event.waitUntil(flushQueue());
  }
});

// Best-effort flush whenever a page comes online
self.addEventListener("online", () => flushQueue());

// ---------- PUSH ----------
self.addEventListener("push", (event) => {
  let data = { title: "FleetPro", body: "Notification", url: "/" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url },
      tag: "fleetpro-alert",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
