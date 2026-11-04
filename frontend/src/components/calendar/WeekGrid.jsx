import React from "react";
import { useTranslation } from "react-i18next";
import { eachDayOfInterval, format, isSameDay, isToday } from "date-fns";
import { EventChip } from "./EventChip";

const hourOf = (e) => Number(e.time.slice(0, 2));

export const WeekGrid = ({ range, selected, onSelect, events, locale }) => {
  const { t } = useTranslation();
  const days = eachDayOfInterval(range);
  const timed = events.filter((e) => e.time).map(hourOf);
  const from = Math.min(7, ...timed);
  const to = Math.max(19, ...timed);
  const hours = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const cellEvents = (d, h) => events.filter((e) => e.date === format(d, "yyyy-MM-dd") && (h === null ? !e.time : e.time && hourOf(e) === h));

  const Cell = ({ d, h }) => (
    <button
      type="button"
      onClick={() => onSelect(d)}
      data-testid={`week-cell-${format(d, "yyyy-MM-dd")}-${h === null ? "none" : h}`}
      className={`min-h-[36px] p-1 border-b border-r border-white/5 flex flex-col gap-0.5 text-left transition-colors ${isSameDay(d, selected) ? "bg-blue-600/10" : "hover:bg-white/5"}`}
    >
      {cellEvents(d, h).map((e) => <EventChip key={e.id} e={e} showTime={h !== null} />)}
    </button>
  );

  return (
    <div data-testid="calendar-week-grid" className="bg-[#141414] border border-white/10 rounded-lg overflow-x-auto">
      <div className="min-w-[680px] grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
        <div className="border-b border-r border-white/10" />
        {days.map((d) => (
          <button key={d.toISOString()} type="button" onClick={() => onSelect(d)} data-testid={`week-day-${format(d, "yyyy-MM-dd")}`}
            className={`py-2 border-b border-r border-white/10 text-center transition-colors ${isSameDay(d, selected) ? "bg-blue-600/15" : "hover:bg-white/5"}`}>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{format(d, "EEEEEE", { locale })}</div>
            <div className={`mx-auto mt-1 text-sm font-mono w-7 h-7 flex items-center justify-center rounded-full ${isToday(d) ? "bg-blue-600 text-white" : "text-zinc-300"}`}>{format(d, "d")}</div>
          </button>
        ))}
        <div className="text-[9px] uppercase tracking-wider text-zinc-500 p-1 border-b border-r border-white/10 flex items-center">{t("calendar.all_day")}</div>
        {days.map((d) => <Cell key={`n-${d.toISOString()}`} d={d} h={null} />)}
        {hours.map((h) => (
          <React.Fragment key={h}>
            <div className="text-[10px] font-mono text-zinc-500 p-1 border-b border-r border-white/10">{String(h).padStart(2, "0")}:00</div>
            {days.map((d) => <Cell key={`${h}-${d.toISOString()}`} d={d} h={h} />)}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
