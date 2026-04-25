import React, { useEffect, useState } from "react";
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

export const MaintenanceTab = ({ vehicles, alerts, onChange }) => {
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
    } catch {
      toast.error("Failed to load maintenance");
    }
  };
  useEffect(() => { load(); }, []);

  const submitSchedule = async () => {
    if (!form.vehicle_id || !form.name || !form.interval_value) {
      toast.error("All fields required");
      return;
    }
    try {
      await api.post("/maintenance/schedules", {
        vehicle_id: form.vehicle_id,
        name: form.name,
        type: form.type,
        interval_value: Number(form.interval_value),
      });
      toast.success("Schedule created");
      setOpen(false);
      setForm({ vehicle_id: "", name: "", type: "mileage", interval_value: "" });
      load();
      onChange();
    } catch {
      toast.error("Failed to create schedule");
    }
  };

  const removeSchedule = async (id) => {
    if (!window.confirm("Delete this schedule?")) return;
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
      toast.success("Maintenance recorded");
      setCompleting(null);
      load();
      onChange();
    } catch {
      toast.error("Failed to record");
    }
  };

  const vLabel = (id) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.brand} ${v.model} · ${v.license_plate}` : "Unknown";
  };

  return (
    <div data-testid="maintenance-page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Maintenance</h2>
          <p className="text-sm text-zinc-500 mt-1">Schedule recurring services and clear notifications.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-schedule-btn" className="bg-blue-600 hover:bg-blue-700 text-white blue-glow border border-blue-500/50">
              <Plus className="w-4 h-4 mr-2" /> New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#141414] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="font-heading">New Maintenance Schedule</DialogTitle>
              <DialogDescription className="text-zinc-500">
                Recurring by mileage or by month.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <FieldLbl label="Vehicle">
                <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                  <SelectTrigger data-testid="schedule-vehicle-select" className="bg-[#0A0A0A] border-white/10">
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-white/10 text-white">
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} · {v.license_plate}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldLbl>
              <FieldLbl label="Service Name">
                <Input data-testid="schedule-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-[#0A0A0A] border-white/10" placeholder="Oil change" />
              </FieldLbl>
              <div className="grid grid-cols-2 gap-3">
                <FieldLbl label="Type">
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger data-testid="schedule-type-select" className="bg-[#0A0A0A] border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#141414] border-white/10 text-white">
                      <SelectItem value="mileage">By Mileage</SelectItem>
                      <SelectItem value="monthly">By Month</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldLbl>
                <FieldLbl label={form.type === "mileage" ? "Every (km)" : "Every (months)"}>
                  <Input data-testid="schedule-interval-input" type="number" value={form.interval_value} onChange={(e) => setForm({ ...form, interval_value: e.target.value })} className="bg-[#0A0A0A] border-white/10 font-mono" />
                </FieldLbl>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submitSchedule} data-testid="schedule-submit-btn" className="bg-blue-600 hover:bg-blue-700 text-white">
                Create Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="alerts" className="w-full">
        <TabsList className="bg-[#141414] border border-white/10 p-1 h-auto">
          <TabsTrigger value="alerts" data-testid="maint-tab-alerts" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-zinc-400 px-4 py-1.5 rounded-sm">
            <Wrench className="w-4 h-4 mr-2" /> Notifications & Schedules
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="maint-tab-history" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-zinc-400 px-4 py-1.5 rounded-sm">
            <HistoryIcon className="w-4 h-4 mr-2" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="mt-6 space-y-4">
          {schedules.length === 0 ? (
            <EmptyMsg text="No maintenance schedules yet." />
          ) : (
            <Card className="bg-[#141414] border-white/10 rounded-lg overflow-hidden">
              <ul className="divide-y divide-white/5">
                {alerts.map((a) => (
                  <li key={a.schedule_id} data-testid={`maint-alert-${a.schedule_id}`} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-9 h-9 rounded-md flex items-center justify-center border ${
                        a.due ? "bg-amber-500/10 border-amber-500/30" : "bg-white/5 border-white/10"
                      }`}>
                        <Wrench className={`w-4 h-4 ${a.due ? "text-amber-400" : "text-zinc-500"}`} />
                      </div>
                      <div>
                        <div className="font-medium">{a.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{a.vehicle_label}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono px-2 py-1 rounded-sm border ${
                        a.due
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-white/5 text-zinc-400 border-white/10"
                      }`}>
                        {a.detail}
                      </span>
                      <Button size="sm" onClick={() => openComplete(a)} data-testid={`clear-alert-${a.schedule_id}`} className="bg-blue-600 hover:bg-blue-700 text-white h-8">
                        <Check className="w-3.5 h-3.5 mr-1.5" /> Mark Done
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
            <EmptyMsg text="No completed maintenance yet." />
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
            <DialogTitle className="font-heading">Mark Maintenance Done</DialogTitle>
            <DialogDescription className="text-zinc-500">
              {completing?.name} — {completing?.vehicle_label}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FieldLbl label="Mileage at completion">
              <Input data-testid="complete-mileage-input" type="number" value={completionMileage} onChange={(e) => setCompletionMileage(e.target.value)} className="bg-[#0A0A0A] border-white/10 font-mono" />
            </FieldLbl>
            <FieldLbl label="Notes (optional)">
              <Input data-testid="complete-notes-input" value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} className="bg-[#0A0A0A] border-white/10" />
            </FieldLbl>
          </div>
          <DialogFooter>
            <Button onClick={submitComplete} data-testid="complete-submit-btn" className="bg-blue-600 hover:bg-blue-700 text-white">
              Save to History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const FieldLbl = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</Label>
    {children}
  </div>
);

const EmptyMsg = ({ text }) => (
  <div className="border border-dashed border-white/10 rounded-lg p-12 text-center text-zinc-500 text-sm">
    {text}
  </div>
);
