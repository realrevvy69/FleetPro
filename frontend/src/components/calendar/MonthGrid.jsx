import React from "react";
import { eachDayOfInterval, format, isSameDay, isSameMonth, isToday } from "date-fns";
import { TYPE_META } from "./eventTypes";

export const MonthGrid = ({ month, range, selected, onSelect, events, locale }) => {
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
              <span className={`text-xs font-mono w-6 h-6 flex items-center justify-center rounded-full ${isToday(d) ? "bg-blue-600 text-white" : "text-zinc-300"}`}>
                {format(d, "d")}
              </span>
              <div className="hidden md:flex flex-col gap-0.5 w-full">
                {list.slice(0, 2).map((e) => (
                  <span key={e.id} className={`truncate text-[10px] px-1.5 py-0.5 rounded-sm border ${TYPE_META[e.type].chip} ${TYPE_META[e.type].text}`}>
                    {e.time ? `${e.time} ` : ""}{e.vehicle_label}
                  </span>
                ))}
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
