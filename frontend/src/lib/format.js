export const STATUS_KEY = {
  parked: "parked",
  on_road: "on_road",
  damaged: "damaged",
  maintenance: "maintenance",
};

export const STATUS_META = {
  parked: { color: "text-zinc-300", bg: "bg-zinc-500/10", border: "border-zinc-500/30" },
  on_road: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  damaged: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  maintenance: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
};

export const formatDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export const formatNumber = (n) => {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat().format(n);
};
