import React from "react";
import { Button } from "../ui/button";
import { ChevronLeft, ChevronRight, Plus, Bell, CalendarPlus, Move } from "lucide-react";
import { TYPE_META } from "./eventTypes";

const OUTLINE = "bg-transparent border-white/10 h-9";

export const CalendarHeader = ({ t, view, setView, label, onPrev, onNext, onToday, onSubscribe, onAdd }) => (
  <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
    <div>
      <h2 className="font-heading text-2xl font-semibold">{t("calendar.title")}</h2>
      <p className="text-sm text-zinc-500 mt-1 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 text-blue-400" />{t("calendar.subtitle")}</p>
    </div>
    <div className="flex items-center gap-2 flex-wrap">
      <ViewToggle view={view} setView={setView} t={t} />
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={onPrev} data-testid="calendar-prev-month" className={`${OUTLINE} w-9`}><ChevronLeft className="w-4 h-4" /></Button>
        <div data-testid="calendar-month-label" className="font-heading font-semibold min-w-[150px] text-center capitalize text-sm md:text-base">{label}</div>
        <Button variant="outline" size="icon" onClick={onNext} data-testid="calendar-next-month" className={`${OUTLINE} w-9`}><ChevronRight className="w-4 h-4" /></Button>
      </div>
      <Button variant="outline" onClick={onToday} data-testid="calendar-today-btn" className={OUTLINE}>{t("calendar.today")}</Button>
      <Button variant="outline" onClick={onSubscribe} data-testid="calendar-subscribe-btn" className={OUTLINE}>
        <CalendarPlus className="w-4 h-4 mr-2" /> {t("calendar.subscribe")}
      </Button>
      <Button onClick={onAdd} data-testid="add-calendar-event-btn" className="bg-blue-600 hover:bg-blue-700 text-white blue-glow border border-blue-500/50 h-9">
        <Plus className="w-4 h-4 mr-2" /> {t("calendar.add_event")}
      </Button>
    </div>
  </div>
);

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

export const CalendarLegend = ({ t, view }) => (
  <div data-testid="calendar-legend" className="flex flex-wrap gap-4 text-xs text-zinc-400">
    {Object.keys(TYPE_META).map((k) => (
      <span key={k} className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${TYPE_META[k].dot}`} />{t(`calendar.types.${k}`)}</span>
    ))}
    <span data-testid="calendar-drag-hint" className={`items-center gap-1.5 text-zinc-500 md:ml-auto ${view === "month" ? "hidden md:flex" : "flex"}`}>
      <Move className="w-3 h-3" />{t("calendar.drag_hint")}
    </span>
  </div>
);
