import { useCallback, useEffect, useMemo, useState } from "react";
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { toast } from "sonner";
import { api } from "../../lib/api";

export const ymd = (d) => format(d, "yyyy-MM-dd");
const WEEK = { weekStartsOn: 1 };
const fromYmd = (s) => new Date(`${s}T00:00`);

export const useCalendarRange = (view, month, selected) => {
  const start = ymd(view === "week" ? startOfWeek(selected, WEEK) : startOfWeek(startOfMonth(month), WEEK));
  const end = ymd(view === "week" ? endOfWeek(selected, WEEK) : endOfWeek(endOfMonth(month), WEEK));
  const range = useMemo(() => ({ start: fromYmd(start), end: fromYmd(end) }), [start, end]);
  return { start, end, range };
};

export const useCalendarEvents = (start, end, t, refreshKey) => {
  const [events, setEvents] = useState([]);
  const load = useCallback(async () => {
    try {
      const r = await api.get("/calendar/events", { params: { start, end } });
      setEvents(r.data);
    } catch { toast.error(t("common.failed")); }
  }, [start, end, t]);
  useEffect(() => { load(); }, [load, refreshKey]);
  return { events, setEvents, load };
};

const dropTarget = (e, overId) => {
  const [kind, date, slot] = overId.split("|");
  let time = e.time || null;
  if (kind === "slot") time = slot === "none" ? null : `${slot.padStart(2, "0")}:${e.time ? e.time.slice(3) : "00"}`;
  return { date, time };
};

const movePayload = (e, date, time) => ({
  vehicle_id: e.vehicle_id, type: e.type, date, time, driver_name: e.driver_name || null,
  notes: e.notes || null, remind_day_before: e.remind_day_before !== false,
});

const hasClash = (events, e, date) =>
  events.some((x) => !x.auto && !x.done && x.id !== e.id && x.vehicle_id === e.vehicle_id && x.date === date);

export const useEventDrag = ({ events, setEvents, load, onMoved, t }) => {
  const [dragging, setDragging] = useState(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
  );

  const onDragEnd = async ({ active, over }) => {
    setDragging(null);
    const e = active.data.current?.event;
    if (!over || !e) return;
    const { date, time } = dropTarget(e, String(over.id));
    if (date === e.date && time === (e.time || null)) return;
    const clash = hasClash(events, e, date);
    setEvents((evs) => evs.map((x) => (x.id === e.id ? { ...x, date, time } : x)));
    onMoved(fromYmd(date));
    try {
      await api.put(`/calendar/events/${e.id}`, movePayload(e, date, time));
      if (clash) toast.warning(t("calendar.moved_conflict"));
      else toast.success(t("calendar.moved"));
    } catch { toast.error(t("common.failed")); }
    load();
  };

  const dndProps = {
    sensors,
    onDragStart: ({ active }) => setDragging(active.data.current?.event),
    onDragEnd,
    onDragCancel: () => setDragging(null),
  };
  return { dragging, dndProps };
};
