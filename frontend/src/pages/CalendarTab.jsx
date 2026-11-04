import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Bell } from "lucide-react";
import { MonthGrid } from "../components/calendar/MonthGrid";
import { DayEvents } from "../components/calendar/DayEvents";
import { EventDialog } from "../components/calendar/EventDialog";
import { TYPE_META, dateLocale } from "../components/calendar/eventTypes";

const ymd = (d) => format(d, "yyyy-MM-dd");

export const CalendarTab = ({ vehicles, drivers }) => {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.language);
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selected, setSelected] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [dialog, setDialog] = useState(null);

  const range = useMemo(() => ({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  }), [month]);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/calendar/events", { params: { start: ymd(range.start), end: ymd(range.end) } });
      setEvents(r.data);
    } catch { toast.error(t("common.failed")); }
  }, [range, t]);

  useEffect(() => { load(); }, [load, vehicles]);

  const goMonth = (n) => setMonth((m) => addMonths(m, n));
  const goToday = () => { const d = new Date(); setMonth(startOfMonth(d)); setSelected(d); };
  const selectDay = (d) => { setSelected(d); if (d.getMonth() !== month.getMonth()) setMonth(startOfMonth(d)); };

  const remove = async (e) => {
    if (!window.confirm(t("calendar.delete_confirm"))) return;
    try { await api.delete(`/calendar/events/${e.id}`); toast.success(t("common.deleted")); load(); }
    catch { toast.error(t("common.failed")); }
  };

  const dayEvents = events.filter((e) => e.date === ymd(selected));

  return (
    <div data-testid="calendar-page" className="space-y-6">
      <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
        <div>
          <h2 className="font-heading text-2xl font-semibold">{t("calendar.title")}</h2>
          <p className="text-sm text-zinc-500 mt-1 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 text-blue-400" />{t("calendar.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => goMonth(-1)} data-testid="calendar-prev-month" className="bg-transparent border-white/10 h-9 w-9"><ChevronLeft className="w-4 h-4" /></Button>
          <div data-testid="calendar-month-label" className="font-heading font-semibold min-w-[150px] text-center capitalize">{format(month, "LLLL yyyy", { locale })}</div>
          <Button variant="outline" size="icon" onClick={() => goMonth(1)} data-testid="calendar-next-month" className="bg-transparent border-white/10 h-9 w-9"><ChevronRight className="w-4 h-4" /></Button>
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
        <MonthGrid month={month} range={range} selected={selected} onSelect={selectDay} events={events} locale={locale} />
        <DayEvents day={selected} events={dayEvents} locale={locale} onAdd={() => setDialog({ date: ymd(selected) })} onEdit={(e) => setDialog({ event: e })} onDelete={remove} />
      </div>

      <EventDialog state={dialog} onClose={() => setDialog(null)} vehicles={vehicles} drivers={drivers} onSaved={() => { setDialog(null); load(); }} />
    </div>
  );
};
