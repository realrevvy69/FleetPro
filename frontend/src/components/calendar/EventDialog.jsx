import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { EVENT_TYPES } from "./eventTypes";

const blank = (date) => ({ type: "handover", vehicle_id: "", date, time: "", driver_name: "", notes: "" });

export const EventDialog = ({ state, onClose, vehicles, drivers, onSaved }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(blank(""));
  const editing = state?.event;

  useEffect(() => {
    if (!state) return;
    const e = state.event;
    setForm(e ? { type: e.type, vehicle_id: e.vehicle_id, date: e.date, time: e.time || "", driver_name: e.driver_name || "", notes: e.notes || "" } : blank(state.date));
  }, [state]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.vehicle_id) return toast.error(t("calendar.validation_vehicle"));
    if (!form.date) return toast.error(t("calendar.validation_date"));
    const payload = { ...form, time: form.time || null, driver_name: form.driver_name.trim() || null, notes: form.notes.trim() || null };
    try {
      if (editing) await api.put(`/calendar/events/${editing.id}`, payload);
      else await api.post("/calendar/events", payload);
      toast.success(t(editing ? "calendar.updated" : "calendar.added"));
      onSaved();
    } catch { toast.error(t("common.failed")); }
  };

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="calendar-event-dialog" className="bg-[#141414] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="font-heading">{t(editing ? "calendar.edit_event" : "calendar.add_event")}</DialogTitle>
          <DialogDescription className="text-zinc-500">{t("calendar.dialog_description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label={t("calendar.type")}>
            <Select value={form.type} onValueChange={set("type")}>
              <SelectTrigger data-testid="calendar-type-select" className="bg-[#0A0A0A] border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#141414] border-white/10 text-white">
                {EVENT_TYPES.map((k) => <SelectItem key={k} value={k} data-testid={`calendar-type-option-${k}`}>{t(`calendar.types.${k}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("calendar.vehicle")}>
            <Select value={form.vehicle_id} onValueChange={set("vehicle_id")}>
              <SelectTrigger data-testid="calendar-vehicle-select" className="bg-[#0A0A0A] border-white/10"><SelectValue placeholder={t("calendar.select_vehicle")} /></SelectTrigger>
              <SelectContent className="bg-[#141414] border-white/10 text-white">
                {vehicles.map((v) => <SelectItem key={v.id} value={v.id} data-testid={`calendar-vehicle-option-${v.id}`}>{v.brand} {v.model} · {v.license_plate}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("calendar.date")}><Input type="date" data-testid="calendar-date-input" value={form.date} onChange={(e) => set("date")(e.target.value)} className="bg-[#0A0A0A] border-white/10" /></Field>
            <Field label={t("calendar.time")}><Input type="time" data-testid="calendar-time-input" value={form.time} onChange={(e) => set("time")(e.target.value)} className="bg-[#0A0A0A] border-white/10" /></Field>
          </div>
          <Field label={t("calendar.driver")}>
            <Input list="calendar-driver-list" data-testid="calendar-driver-input" value={form.driver_name} onChange={(e) => set("driver_name")(e.target.value)} className="bg-[#0A0A0A] border-white/10" placeholder={t("calendar.driver_placeholder")} />
            <datalist id="calendar-driver-list">{drivers.map((d) => <option key={d.id} value={d.name} />)}</datalist>
          </Field>
          <Field label={t("calendar.notes")}>
            <Textarea data-testid="calendar-notes-input" value={form.notes} onChange={(e) => set("notes")(e.target.value)} className="bg-[#0A0A0A] border-white/10 min-h-[70px]" />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={submit} data-testid="calendar-event-submit-btn" className="bg-blue-600 hover:bg-blue-700 text-white">{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</Label>
    {children}
  </div>
);
