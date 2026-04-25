import { api } from "./api";

const urlBase64ToUint8Array = (b64) => {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const isPushSupported = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const getPushPermission = () =>
  isPushSupported() ? Notification.permission : "unsupported";

export const ensureServiceWorker = async () => {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return reg;
};

export const enablePush = async () => {
  if (!isPushSupported()) throw new Error("Push not supported");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permission denied");
  const reg = await ensureServiceWorker();
  const { data } = await api.get("/push/vapid-public");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.public_key),
    });
  }
  const json = sub.toJSON();
  await api.post("/push/subscribe", { endpoint: json.endpoint, keys: json.keys });
  return true;
};

export const disablePush = async () => {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    const json = sub.toJSON();
    await api.post("/push/unsubscribe", { endpoint: json.endpoint, keys: json.keys });
    await sub.unsubscribe();
  }
};
