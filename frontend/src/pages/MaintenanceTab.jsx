import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Plus, Wrench, Check, History as HistoryIcon, Trash2 } from "lucide-react";
import { formatDate, formatNumber } from "../lib/format";

// Localize alert detail strings produced by the backend
const localizeDetail = (t, detail) => {
  if (!detail) return detail;
  let m = detail.match(/^(-?\d+) km remaining$/);
  if (m) return t("maintenance.km_remaining", { count: Number(m[1]) });
  m = detail.match(/^Overdue by (\d+) km$/);
  if (m) return t("maintenance.km_overdue", { count: Number(m[1]) });
  m = detail.match(/^(-?\d+) months remaining$/);
  if (m) return t("maintenance.months_remaining", { count: Number(m[1]) });
  m = detail.match(/^Overdue by (\d+) months$/);
  if (m) return t("maintenance.months_overdue", { count: Number(m[1]) });
  return detail;
};

export const MaintenanceTab = ({ vehicles, alerts, onChange }) => {
  const { t } = useTranslation();
  const [schedules, setSchedules] = useState([]);
  const [history, setHistory] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ vehicle_id: "", name: "", type: "mileage", interval_value: "" });
  const [completing, setCompleting] = useState(null);
  const [completionMileage, setCompletionMileage] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");

  const load = async () => {
    try {
      const [s, h] = await Promise.all([api.get("/maintenance/schedules"), api.get("/maintenance/history")]);
      setSchedules(s.data);
      setHistory(h.data);
    } catch { toast.error(t("common.failed")); }
  };
  useEffect(() => { load(); }, []);

  const submitSchedule = async () => {
    if (!form.vehicle_id || !form.name || !form.interval_value) return toast.error(t("maintenance.all_required"));
    try {
      await api.post("/maintenance/schedules", {
        vehicle_id: form.vehicle_id,
        name: form.name,
        type: form.type,
        interval_value: Number(form.interval_value),
      });
      toast.success(t("maintenance.schedule_created"));
      setOpen(false);
      setForm({ vehicle_id: "", name: "", type: "mileage", interval_value: "" });
      load();
      onChange();
    } catch { toast.error(t("common.failed")); }
  };

  const removeSchedule = async (id) => {
    if (!window.confirm(t("maintenance.delete_schedule_confirm"))) return;
    await api.delete(`/maintenance/schedules/${id}`);
    load();
    onChange();
  };

  const openComplete = (alert) => {
    const v = vehicles.find((x) => x.id === alert.vehicle_id);
    setCompleting(alert);
    setCompletionMileage(v?.mileage?.toString() || "");
    setCompletionNotes("");
  };

  const submitComplete = async () => {
    try {
      await api.post("/maintenance/complete", {
        schedule_id: completing.schedule_id,
        mileage_at_completion: Number(completionMileage) || null,
        notes: completionNotes || null,
      });
      toast.success(t("maintenance.recorded"));
      setCompleting(null);
      load();
      onChange();
    } catch { toast.error(t("common.failed")); }
  };

  const vLabel = (id) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.brand} ${v.model} · ${v.license_plate}` : t("common.unknown");
  };

  return (
    <div data-testid="maintenance-page" className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-2xl font-semibold">{t("maintenance.title")}</h2>
          <p className="text-sm text-zinc-500 mt-1">{t("maintenance.subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-schedule-btn" className="bg-blue-600 hover:bg-blue-700 text-white blue-glow border border-blue-500/50">
              <Plus className="w-4 h-4 mr-2" /> {t("maintenance.new")}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#141414] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="font-heading">{t("maintenance.dialogTitle")}</DialogTitle>
              <DialogDescription className="text-zinc-500">{t("maintenance.dialogDescription")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <Field label={t("maintenance.vehicle")}>
                <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                  <SelectTrigger data-testid="schedule-vehicle-select" className="bg-[#0A0A0A] border-white/10"><SelectValue placeholder={t("maintenance.selectVehicle")} /></SelectTrigger>
                  <SelectContent className="bg-[#141414] border-white/10 text-white">
                    {vehicles.map((v) => (<SelectItem key={v.id} value={v.id}>{v.brand} {v.model} · {v.license_plate}</SelectItem>))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("maintenance.service_name")}>
                <Input data-testid="schedule-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-[#0A0A0A] border-white/10" placeholder={t("maintenance.service_placeholder")} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("maintenance.type")}>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger data-testid="schedule-type-select" className="bg-[#0A0A0A] border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#141414] border-white/10 text-white">
                      <SelectItem value="mileage">{t("maintenance.by_mileage")}</SelectItem>
                      <SelectItem value="monthly">{t("maintenance.by_month")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={form.type === "mileage" ? t("maintenance.every_km") : t("maintenance.every_months")}>
                  <Input data-testid="schedule-interval-input" type="number" value={form.interval_value} onChange={(e) => setForm({ ...form, interval_value: e.target.value })} className="bg-[#0A0A0A] border-white/10 font-mono" />
                </Field>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submitSchedule} data-testid="schedule-submit-btn" className="bg-blue-600 hover:bg-blue-700 text-white">{t("maintenance.create")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="alerts" className="w-full">
        <TabsList className="bg-[#141414] border border-white/10 p-1 h-auto">
          <TabsTrigger value="alerts" data-testid="maint-tab-alerts" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-zinc-400 px-4 py-1.5 rounded-sm">
            <Wrench className="w-4 h-4 mr-2" /> {t("maintenance.tab_alerts")}
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="maint-tab-history" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-zinc-400 px-4 py-1.5 rounded-sm">
            <HistoryIcon className="w-4 h-4 mr-2" /> {t("maintenance.tab_history")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="mt-6 space-y-4">
          {schedules.length === 0 ? (
            <EmptyMsg text={t("maintenance.no_schedules")} />
          ) : (
            <Card className="bg-[#141414] border-white/10 rounded-lg overflow-hidden">
              <ul className="divide-y divide-white/5">
                {alerts.map((a) => (
                  <li key={a.schedule_id} data-testid={`maint-alert-${a.schedule_id}`} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-9 h-9 rounded-md flex items-center justify-center border ${a.due ? "bg-amber-500/10 border-amber-500/30" : "bg-white/5 border-white/10"}`}>
                        <Wrench className={`w-4 h-4 ${a.due ? "text-amber-400" : "text-zinc-500"}`} />
                      </div>
                      <div>
                        <div className="font-medium">{a.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{a.vehicle_label}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono px-2 py-1 rounded-sm border ${a.due ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-white/5 text-zinc-400 border-white/10"}`}>
                        {localizeDetail(t, a.detail)}
                      </span>
                      <Button size="sm" onClick={() => openComplete(a)} data-testid={`clear-alert-${a.schedule_id}`} className="bg-blue-600 hover:bg-blue-700 text-white h-8">
                        <Check className="w-3.5 h-3.5 mr-1.5" /> {t("maintenance.mark_done")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeSchedule(a.schedule_id)} data-testid={`schedule-delete-${a.schedule_id}`} className="text-zinc-500 hover:text-red-400 h-8 px-2">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {history.length === 0 ? (
            <EmptyMsg text={t("maintenance.no_history")} />
          ) : (
            <Card className="bg-[#141414] border-white/10 rounded-lg overflow-hidden">
              <ul className="divide-y divide-white/5">
                {history.map((h) => (
                  <li key={h.id} data-testid={`history-item-${h.id}`} className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                        <Check className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <div className="font-medium">{h.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{vLabel(h.vehicle_id)}</div>
                        {h.notes && <div className="text-xs text-zinc-400 mt-1">{h.notes}</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono">{formatNumber(h.mileage_at_completion)} km</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{formatDate(h.completed_at)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!completing} onOpenChange={(o) => !o && setCompleting(null)}>
        <DialogContent className="bg-[#141414] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="font-heading">{t("maintenance.complete_title")}</DialogTitle>
            <DialogDescription className="text-zinc-500">
              {completing?.name} — {completing?.vehicle_label}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label={t("maintenance.mileage_at_completion")}><Input data-testid="complete-mileage-input" type="number" value={completionMileage} onChange={(e) => setCompletionMileage(e.target.value)} className="bg-[#0A0A0A] border-white/10 font-mono" /></Field>
            <Field label={t("maintenance.notes")}><Input data-testid="complete-notes-input" value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} className="bg-[#0A0A0A] border-white/10" /></Field>
          </div>
          <DialogFooter>
            <Button onClick={submitComplete} data-testid="complete-submit-btn" className="bg-blue-600 hover:bg-blue-700 text-white">{t("maintenance.save_to_history")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</Label>
    {children}
  </div>
);
const EmptyMsg = ({ text }) => (<div className="border border-dashed border-white/10 rounded-lg p-12 text-center text-zinc-500 text-sm">{text}</div>);
