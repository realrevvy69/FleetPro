import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { addMonths, addWeeks, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Bell } from "lucide-react";
import { MonthGrid } from "../components/calendar/MonthGrid";
import { WeekGrid } from "../components/calendar/WeekGrid";
import { DayEvents } from "../components/calendar/DayEvents";
import { EventDialog } from "../components/calendar/EventDialog";
import { TYPE_META, dateLocale, conflictIds } from "../components/calendar/eventTypes";

const ymd = (d) => format(d, "yyyy-MM-dd");
const WEEK = { weekStartsOn: 1 };

export const CalendarTab = ({ vehicles, drivers, onStartProtocol }) => {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.language);
  const [view, setView] = useState("month");
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selected, setSelected] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [dialog, setDialog] = useState(null);

  const range = useMemo(() => (view === "week"
    ? { start: startOfWeek(selected, WEEK), end: endOfWeek(selected, WEEK) }
    : { start: startOfWeek(startOfMonth(month), WEEK), end: endOfWeek(endOfMonth(month), WEEK) }
  ), [view, month, selected]);
  const rangeKey = `${ymd(range.start)}_${ymd(range.end)}`;

  const load = useCallback(async () => {
    try {
      const r = await api.get("/calendar/events", { params: { start: ymd(range.start), end: ymd(range.end) } });
      setEvents(r.data);
    } catch { toast.error(t("common.failed")); }
    // eslint-disable-next-line
  }, [rangeKey, t]);

  useEffect(() => { load(); }, [load, vehicles]);

  const selectDay = (d) => { setSelected(d); setMonth(startOfMonth(d)); };
  const go = (n) => (view === "week" ? selectDay(addWeeks(selected, n)) : setMonth((m) => addMonths(m, n)));
  const goToday = () => selectDay(new Date());

  const remove = async (e) => {
    if (!window.confirm(t("calendar.delete_confirm"))) return;
    try { await api.delete(`/calendar/events/${e.id}`); toast.success(t("common.deleted")); load(); }
    catch { toast.error(t("common.failed")); }
  };

  const conflicts = useMemo(() => conflictIds(events), [events]);
  const dayEvents = events.filter((e) => e.date === ymd(selected));
  const label = view === "week"
    ? `${t("calendar.week_short")} ${format(selected, "I", { locale })} · ${format(range.start, "d. MMM", { locale })} – ${format(range.end, "d. MMM yyyy", { locale })}`
    : format(month, "LLLL yyyy", { locale });
  const gridProps = { range, selected, onSelect: selectDay, events, locale, conflicts };

  return (
    <div data-testid="calendar-page" className="space-y-6">
      <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
        <div>
          <h2 className="font-heading text-2xl font-semibold">{t("calendar.title")}</h2>
          <p className="text-sm text-zinc-500 mt-1 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 text-blue-400" />{t("calendar.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewToggle view={view} setView={setView} t={t} />
          <Button variant="outline" size="icon" onClick={() => go(-1)} data-testid="calendar-prev-month" className="bg-transparent border-white/10 h-9 w-9"><ChevronLeft className="w-4 h-4" /></Button>
          <div data-testid="calendar-month-label" className="font-heading font-semibold min-w-[150px] text-center capitalize text-sm md:text-base">{label}</div>
          <Button variant="outline" size="icon" onClick={() => go(1)} data-testid="calendar-next-month" className="bg-transparent border-white/10 h-9 w-9"><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="outline" onClick={goToday} data-testid="calendar-today-btn" className="bg-transparent border-white/10 h-9">{t("calendar.today")}</Button>
          <Button onClick={() => setDialog({ date: ymd(selected) })} data-testid="add-calendar-event-btn" className="bg-blue-600 hover:bg-blue-700 text-white blue-glow border border-blue-500/50 h-9">
            <Plus className="w-4 h-4 mr-2" /> {t("calendar.add_event")}
          </Button>
        </div>
      </div>

      <div data-testid="calendar-legend" className="flex flex-wrap gap-4 text-xs text-zinc-400">
        {Object.keys(TYPE_META).map((k) => (
          <span key={k} className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${TYPE_META[k].dot}`} />{t(`calendar.types.${k}`)}</span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        {view === "week" ? <WeekGrid {...gridProps} /> : <MonthGrid month={month} {...gridProps} />}
        <DayEvents day={selected} events={dayEvents} locale={locale} conflicts={conflicts} onAdd={() => setDialog({ date: ymd(selected) })}
          onEdit={(e) => setDialog({ event: e })} onDelete={remove} onStartProtocol={onStartProtocol} />
      </div>

      <EventDialog state={dialog} onClose={() => setDialog(null)} vehicles={vehicles} drivers={drivers} onSaved={() => { setDialog(null); load(); }} />
    </div>
  );
};

const ViewToggle = ({ view, setView, t }) => (
  <div data-testid="calendar-view-toggle" className="flex rounded-md border border-white/10 p-0.5">
    {["month", "week"].map((v) => (
      <button key={v} type="button" onClick={() => setView(v)} data-testid={`calendar-view-${v}`}
        className={`px-3 h-8 text-sm rounded-sm transition-colors ${view === v ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"}`}>
        {t(`calendar.view_${v}`)}
      </button>
    ))}
  </div>
);
