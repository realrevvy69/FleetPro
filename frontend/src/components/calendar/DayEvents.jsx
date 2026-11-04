import React from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Button } from "../ui/button";
import { Clock, User, Trash2, Pencil, Plus, Sparkles, Bell, CheckCircle2, AlertTriangle, ClipboardSignature, CalendarPlus } from "lucide-react";
import { API } from "../../lib/api";
import { TYPE_META } from "./eventTypes";

export const DayEvents = ({ day, events, locale, conflicts, onAdd, onEdit, onDelete, onStartProtocol }) => {
  const { t } = useTranslation();
  return (
    <div data-testid="calendar-day-panel" className="bg-[#141414] border border-white/10 rounded-lg p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{format(day, "EEEE", { locale })}</div>
          <div data-testid="calendar-day-title" className="font-heading text-xl font-semibold">{format(day, "PPP", { locale })}</div>
        </div>
        <Button size="sm" onClick={onAdd} data-testid="calendar-day-add-btn" className="bg-blue-600 hover:bg-blue-700 text-white h-8">
          <Plus className="w-3.5 h-3.5 mr-1" /> {t("common.add")}
        </Button>
      </div>
      {events.length === 0 ? (
        <div data-testid="calendar-day-empty" className="border border-dashed border-white/10 rounded-md p-6 text-center text-sm text-zinc-500">{t("calendar.no_events")}</div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <EventRow key={e.id} e={e} t={t} clash={conflicts.has(e.id)} onEdit={onEdit} onDelete={onDelete} onStartProtocol={onStartProtocol} />
          ))}
        </div>
      )}
    </div>
  );
};

const Tag = ({ icon: Icon, className, children, testId }) => (
  <span data-testid={testId} className={`text-[10px] flex items-center gap-1 ${className}`}><Icon className="w-3 h-3" />{children}</span>
);

const EventRow = ({ e, t, clash, onEdit, onDelete, onStartProtocol }) => {
  const meta = TYPE_META[e.type];
  const canStart = !e.auto && !e.done && (e.type === "handover" || e.type === "return");
  return (
    <div data-testid={`calendar-event-${e.id}`} className={`flex gap-3 p-3 rounded-md bg-[#0A0A0A] border ${clash ? "border-amber-500/50" : "border-white/10"} ${e.done ? "opacity-60" : ""}`}>
      <span className={`w-1 rounded-full ${meta.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold uppercase tracking-wider ${meta.text} ${e.done ? "line-through" : ""}`}>{t(`calendar.types.${e.type}`)}</span>
          {e.time && <Tag icon={Clock} className="font-mono text-zinc-400 text-xs">{e.time}</Tag>}
          {e.auto && <Tag icon={Sparkles} className="text-zinc-500">{t("calendar.auto")}</Tag>}
          {e.done && <Tag icon={CheckCircle2} className="text-emerald-400" testId={`calendar-event-done-${e.id}`}>{t("calendar.done")}</Tag>}
          {!e.auto && !e.done && e.remind_day_before && <Tag icon={Bell} className="text-zinc-500" testId={`calendar-event-eve-${e.id}`}>15:00</Tag>}
          {clash && <Tag icon={AlertTriangle} className="text-amber-400" testId={`calendar-event-conflict-${e.id}`}>{t("calendar.conflict_badge")}</Tag>}
        </div>
        <div className="text-sm mt-1 truncate">{e.vehicle_label}</div>
        {e.driver_name && <div className="text-xs text-zinc-400 mt-1 flex items-center gap-1"><User className="w-3 h-3" />{e.driver_name}</div>}
        {e.notes && <div className="text-xs text-zinc-500 mt-1 break-words">{e.notes}</div>}
        {canStart && (
          <Button size="sm" onClick={() => onStartProtocol(e)} data-testid={`calendar-event-start-protocol-${e.id}`} className="mt-2 h-7 bg-blue-600 hover:bg-blue-700 text-white text-xs">
            <ClipboardSignature className="w-3.5 h-3.5 mr-1" /> {t("calendar.start_protocol")}
          </Button>
        )}
      </div>
      {!e.auto && (
        <div className="flex flex-col gap-1">
          <IcsLink e={e} t={t} />
          <Button size="sm" variant="ghost" onClick={() => onEdit(e)} data-testid={`calendar-event-edit-${e.id}`} className="h-7 w-7 p-0 text-zinc-400 hover:text-white" title={t("common.edit")}><Pencil className="w-3.5 h-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(e)} data-testid={`calendar-event-delete-${e.id}`} className="h-7 w-7 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-500/10" title={t("common.delete")}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      )}
      {e.auto && <IcsLink e={e} t={t} />}
    </div>
  );
};

const IcsLink = ({ e, t }) => (
  <a href={`${API}/calendar/events/${e.id}/ics`} download data-testid={`calendar-event-ics-${e.id}`} title={t("calendar.download_ics")}
    className="h-7 w-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
    <CalendarPlus className="w-3.5 h-3.5" />
  </a>
);
