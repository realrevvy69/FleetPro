import React from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Button } from "../ui/button";
import { Clock, User, Trash2, Pencil, Plus, Sparkles } from "lucide-react";
import { TYPE_META } from "./eventTypes";

export const DayEvents = ({ day, events, locale, onAdd, onEdit, onDelete }) => {
  const { t } = useTranslation();
  return (
    <div data-testid="calendar-day-panel" className="bg-[#141414] border border-white/10 rounded-lg p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{format(day, "EEEE", { locale })}</div>
          <div data-testid="calendar-day-title" className="font-heading text-xl font-semibold">{format(day, "d. MMMM yyyy", { locale })}</div>
        </div>
        <Button size="sm" onClick={onAdd} data-testid="calendar-day-add-btn" className="bg-blue-600 hover:bg-blue-700 text-white h-8">
          <Plus className="w-3.5 h-3.5 mr-1" /> {t("common.add")}
        </Button>
      </div>
      {events.length === 0 ? (
        <div data-testid="calendar-day-empty" className="border border-dashed border-white/10 rounded-md p-6 text-center text-sm text-zinc-500">{t("calendar.no_events")}</div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => <EventRow key={e.id} e={e} t={t} onEdit={onEdit} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  );
};

const EventRow = ({ e, t, onEdit, onDelete }) => {
  const meta = TYPE_META[e.type];
  return (
    <div data-testid={`calendar-event-${e.id}`} className="flex gap-3 p-3 rounded-md bg-[#0A0A0A] border border-white/10">
      <span className={`w-1 rounded-full ${meta.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold uppercase tracking-wider ${meta.text}`}>{t(`calendar.types.${e.type}`)}</span>
          {e.time && <span className="text-xs font-mono text-zinc-400 flex items-center gap-1"><Clock className="w-3 h-3" />{e.time}</span>}
          {e.auto && <span className="text-[10px] text-zinc-500 flex items-center gap-1"><Sparkles className="w-3 h-3" />{t("calendar.auto")}</span>}
        </div>
        <div className="text-sm mt-1 truncate">{e.vehicle_label}</div>
        {e.driver_name && <div className="text-xs text-zinc-400 mt-1 flex items-center gap-1"><User className="w-3 h-3" />{e.driver_name}</div>}
        {e.notes && <div className="text-xs text-zinc-500 mt-1 break-words">{e.notes}</div>}
      </div>
      {!e.auto && (
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="ghost" onClick={() => onEdit(e)} data-testid={`calendar-event-edit-${e.id}`} className="h-7 w-7 p-0 text-zinc-400 hover:text-white" title={t("common.edit")}><Pencil className="w-3.5 h-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(e)} data-testid={`calendar-event-delete-${e.id}`} className="h-7 w-7 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-500/10" title={t("common.delete")}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      )}
    </div>
  );
};
