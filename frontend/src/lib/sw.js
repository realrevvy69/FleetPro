// Service Worker bootstrap: registers /sw.js, listens for online events, asks the SW to flush queued writes
export const registerServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const flush = () => {
      navigator.serviceWorker.controller?.postMessage({ type: "FLUSH_QUEUE" });
    };
    window.addEventListener("online", flush);
    // Periodic safety net every 30s
    setInterval(() => { if (navigator.onLine) flush(); }, 30000);
    return reg;
  } catch (e) {
    console.warn("SW registration failed", e);
    return null;
  }
};
