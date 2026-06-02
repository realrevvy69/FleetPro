/* FleetPro Service Worker — push + offline cache + write queue
 * v3 fixes:
 *  - Bypass HMR / dev-server endpoints (no interference with CRA WebSocket → no refresh loops)
 *  - Network-first for HTML navigations so deploys propagate immediately
 *  - Cache-first only for hashed static assets (JS/CSS/images/fonts)
 *  - Do NOT auto-claim — only the next page load uses the new SW
 */
const CACHE = "fleetpro-shell-v3";
const RUNTIME = "fleetpro-runtime-v3";
const SHELL_URLS = ["/manifest.json", "/favicon.ico", "/icon-192.png", "/icon-512.png"];

// Paths we must NOT touch — these belong to CRA / webpack / sockjs / browser sync
const BYPASS_PATTERNS = [
  /^\/sockjs-node/,
  /^\/ws($|\/)/,
  /^\/__webpack_hmr/,
  /\.hot-update\.(js|json)$/,
  /^\/static\/js\/.*\.hot-update\./,
];

// ---------- INSTALL / ACTIVATE ----------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL_URLS).catch(() => {}))
  );
  // One-time skipWaiting on this version bump so users stuck on the previous
  // (HMR-breaking) SW get unblocked immediately. Future versions can drop this.
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

  // 1) Only handle http(s) same-origin requests. Skip ws:, blob:, data:, chrome-extension:, etc.
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.origin !== self.location.origin) return;

  // 2) Skip dev-server / HMR paths entirely (let them go directly to network)
  if (BYPASS_PATTERNS.some((re) => re.test(url.pathname))) return;

  // 3) Writes → handle via write-queue
  if (req.method !== "GET") {
    if (url.pathname.startsWith("/api/")) {
      event.respondWith(handleWriteRequest(req));
    }
    return;
  }

  // 4) API GET → network first, fallback to runtime cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 5) HTML / SPA navigations → network first (so a fresh deploy shows immediately)
  const isNavigation = req.mode === "navigate" || req.destination === "document" ||
    (req.headers.get("accept") || "").includes("text/html");
  if (isNavigation) {
    event.respondWith(networkFirstHtml(req));
    return;
  }

  // 6) Static assets (hashed by webpack) → cache first
  event.respondWith(cacheFirst(req));
});

const networkFirst = async (req) => {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(RUNTIME);
      cache.put(req, res.clone());
    }
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

const networkFirstHtml = async (req) => {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(CACHE);
      cache.put("/", res.clone()); // store latest shell
    }
    return res;
  } catch (e) {
    const cachedRoot = await caches.match("/");
    if (cachedRoot) return cachedRoot;
    const cached = await caches.match(req);
    return cached || new Response("Offline", { status: 503 });
  }
};

const cacheFirst = async (req) => {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(RUNTIME);
      cache.put(req, res.clone());
    }
    return res;
  } catch (e) {
    return Response.error();
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
    return await fetch(req.clone());
  } catch (err) {
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
      return; // still offline
    }
  }
};

self.addEventListener("sync", (event) => {
  if (event.tag === "fleetpro-sync") event.waitUntil(flushQueue());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "FLUSH_QUEUE") event.waitUntil(flushQueue());
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

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
