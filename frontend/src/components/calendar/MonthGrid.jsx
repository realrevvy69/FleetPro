import React from "react";
import { eachDayOfInterval, format, isSameDay, isSameMonth, isToday } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { TYPE_META } from "./eventTypes";
import { EventChip } from "./EventChip";

export const MonthGrid = ({ month, range, selected, onSelect, events, locale, conflicts }) => {
  const days = eachDayOfInterval(range);
  const byDate = events.reduce((acc, e) => ((acc[e.date] = acc[e.date] || []).push(e), acc), {});

  return (
    <div data-testid="calendar-month-grid" className="bg-[#141414] border border-white/10 rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 border-b border-white/10">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="px-2 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500 text-center">
            {format(d, "EEEEEE", { locale })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const list = byDate[key] || [];
          const active = isSameDay(d, selected);
          const clash = list.some((e) => conflicts.has(e.id));
          return (
            <button
              key={key}
              type="button"
              data-testid={`cal-day-${key}`}
              onClick={() => onSelect(d)}
              className={`min-h-[64px] md:min-h-[96px] p-1.5 md:p-2 text-left border-b border-r border-white/5 flex flex-col gap-1 transition-colors ${
                active ? "bg-blue-600/15 ring-1 ring-inset ring-blue-500" : "hover:bg-white/5"
              } ${isSameMonth(d, month) ? "" : "opacity-35"}`}
            >
              <span className="flex items-center justify-between w-full">
                <span className={`text-xs font-mono w-6 h-6 flex items-center justify-center rounded-full ${isToday(d) ? "bg-blue-600 text-white" : "text-zinc-300"}`}>
                  {format(d, "d")}
                </span>
                {clash && <AlertTriangle data-testid={`cal-conflict-${key}`} className="w-3.5 h-3.5 text-amber-400" />}
              </span>
              <div className="hidden md:flex flex-col gap-0.5 w-full">
                {list.slice(0, 2).map((e) => <EventChip key={e.id} e={e} />)}
                {list.length > 2 && <span className="text-[10px] text-zinc-500">+{list.length - 2}</span>}
              </div>
              <div className="flex md:hidden gap-0.5 flex-wrap">
                {list.slice(0, 4).map((e) => <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${TYPE_META[e.type].dot}`} />)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
