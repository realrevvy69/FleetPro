import { de, enUS } from "date-fns/locale";

export const EVENT_TYPES = ["handover", "return", "pool_exit"];

export const TYPE_META = {
  handover: { dot: "bg-blue-500", text: "text-blue-400", chip: "bg-blue-500/15 border-blue-500/40" },
  return: { dot: "bg-emerald-500", text: "text-emerald-400", chip: "bg-emerald-500/15 border-emerald-500/40" },
  pool_exit: { dot: "bg-red-500", text: "text-red-400", chip: "bg-red-500/15 border-red-500/40" },
  service: { dot: "bg-amber-500", text: "text-amber-400", chip: "bg-amber-500/15 border-amber-500/40" },
};

export const dateLocale = (lang) => (lang?.startsWith("de") ? de : enUS);

export const conflictIds = (events) => {
  const counts = {};
  const manual = events.filter((e) => !e.auto);
  manual.forEach((e) => { const k = `${e.date}|${e.vehicle_id}`; counts[k] = (counts[k] || 0) + 1; });
  return new Set(manual.filter((e) => counts[`${e.date}|${e.vehicle_id}`] > 1).map((e) => e.id));
};
