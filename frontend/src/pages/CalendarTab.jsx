import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { addMonths, addWeeks, format, startOfMonth } from "date-fns";
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { toast } from "sonner";
import { api } from "../lib/api";
import { MonthGrid } from "../components/calendar/MonthGrid";
import { WeekGrid } from "../components/calendar/WeekGrid";
import { DayEvents } from "../components/calendar/DayEvents";
import { EventDialog } from "../components/calendar/EventDialog";
import { SubscribeDialog } from "../components/calendar/SubscribeDialog";
import { ChipView } from "../components/calendar/EventChip";
import { CalendarHeader, CalendarLegend } from "../components/calendar/CalendarHeader";
import { dateLocale, conflictIds } from "../components/calendar/eventTypes";
import { ymd, useCalendarRange, useCalendarEvents, useEventDrag } from "../components/calendar/useCalendar";

const rangeLabel = (view, month, selected, range, locale, t) => (view === "week"
  ? `${t("calendar.week_short")} ${format(selected, "I", { locale })} · ${format(range.start, "d. MMM", { locale })} – ${format(range.end, "d. MMM yyyy", { locale })}`
  : format(month, "LLLL yyyy", { locale }));

export const CalendarTab = ({ vehicles, drivers, onStartProtocol }) => {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.language);
  const [view, setView] = useState("month");
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selected, setSelected] = useState(new Date());
  const [dialog, setDialog] = useState(null);
  const [subscribeOpen, setSubscribeOpen] = useState(false);

  const { start, end, range } = useCalendarRange(view, month, selected);
  const { events, setEvents, load } = useCalendarEvents(start, end, t, vehicles);
  const { dragging, dndProps } = useEventDrag({ events, setEvents, load, onMoved: setSelected, t });
  const conflicts = useMemo(() => conflictIds(events), [events]);

  const selectDay = (d) => { setSelected(d); setMonth(startOfMonth(d)); };
  const go = (n) => (view === "week" ? selectDay(addWeeks(selected, n)) : setMonth((m) => addMonths(m, n)));
  const addForSelected = () => setDialog({ date: ymd(selected) });

  const remove = async (e) => {
    if (!window.confirm(t("calendar.delete_confirm"))) return;
    try { await api.delete(`/calendar/events/${e.id}`); toast.success(t("common.deleted")); load(); }
    catch { toast.error(t("common.failed")); }
  };

  const gridProps = { range, selected, onSelect: selectDay, events, locale, conflicts };

  return (
    <div data-testid="calendar-page" className="space-y-6">
      <CalendarHeader t={t} view={view} setView={setView} label={rangeLabel(view, month, selected, range, locale, t)}
        onPrev={() => go(-1)} onNext={() => go(1)} onToday={() => selectDay(new Date())}
        onSubscribe={() => setSubscribeOpen(true)} onAdd={addForSelected} />
      <CalendarLegend t={t} view={view} />

      <DndContext collisionDetection={pointerWithin} {...dndProps}>
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
            {view === "week" ? <WeekGrid {...gridProps} /> : <MonthGrid month={month} {...gridProps} />}
            <DayEvents day={selected} events={events.filter((e) => e.date === ymd(selected))} locale={locale} conflicts={conflicts}
              onAdd={addForSelected} onEdit={(e) => setDialog({ event: e })} onDelete={remove} onStartProtocol={onStartProtocol} />
          </div>
          <DragOverlay dropAnimation={null}>
            {dragging ? <ChipView e={dragging} className="shadow-lg shadow-blue-500/30 bg-[#141414] w-40" /> : null}
          </DragOverlay>
        </div>
      </DndContext>

      <EventDialog state={dialog} onClose={() => setDialog(null)} vehicles={vehicles} drivers={drivers} onSaved={() => { setDialog(null); load(); }} />
      <SubscribeDialog open={subscribeOpen} onOpenChange={setSubscribeOpen} />
    </div>
  );
};
