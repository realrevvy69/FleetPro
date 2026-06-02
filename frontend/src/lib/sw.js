// Service Worker bootstrap: registers /sw.js safely.
// Avoids registering on dev/localhost where CRA's HMR could conflict.

const isLocalhost = () => {
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h.startsWith("192.168.");
};

export const registerServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return null;
  if (isLocalhost()) return null; // never run SW on localhost dev

  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // When a new SW is waiting (after a deploy), gently nudge it once tabs are idle.
    // We do NOT auto-reload — the user keeps their state, and the new version picks up on
    // their next manual reload.
    if (reg.waiting && navigator.serviceWorker.controller) {
      // leave it waiting; next full page navigation will pick it up
    }

    const flush = () => {
      try { navigator.serviceWorker.controller?.postMessage({ type: "FLUSH_QUEUE" }); } catch {}
    };
    window.addEventListener("online", flush);

    return reg;
  } catch (e) {
    console.warn("SW registration failed", e);
    return null;
  }
};

// Unregister any previously installed SW (used when we detect we're on localhost so
// stale SWs from earlier sessions don't keep intercepting requests).
export const unregisterStaleServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return;
  if (!isLocalhost()) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) await r.unregister();
};
