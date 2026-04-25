import React, { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Slider } from "../components/ui/slider";
import { Checkbox } from "../components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { api } from "../lib/api";
import { toast } from "sonner";
import { ClipboardSignature, History as HistoryIcon, Plus, X, Fuel, Check, RotateCcw } from "lucide-react";
import { SignaturePad } from "../components/SignaturePad";
import { formatDate, formatNumber } from "../lib/format";

const DEFAULT_EXTRAS = ["Medkit", "Warning Triangle", "Hi-Vis Vest", "Spare Tire", "Jack"];

export const ProtocolsTab = ({ vehicles, onChange }) => {
  const [protocols, setProtocols] = useState([]);

  const load = async () => {
    try {
      const r = await api.get("/protocols");
      setProtocols(r.data);
    } catch {
      toast.error("Failed to load protocols");
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <Tabs defaultValue="handover" className="w-full">
      <TabsList className="bg-[#141414] border border-white/10 p-1 h-auto">
        <TabsTrigger value="handover" data-testid="proto-tab-handover" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-zinc-400 px-4 py-1.5 rounded-sm">
          <ClipboardSignature className="w-4 h-4 mr-2" /> Handover Protocol
        </TabsTrigger>
        <TabsTrigger value="history" data-testid="proto-tab-history" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-zinc-400 px-4 py-1.5 rounded-sm">
          <HistoryIcon className="w-4 h-4 mr-2" /> History
        </TabsTrigger>
      </TabsList>

      <TabsContent value="handover" className="mt-6">
        <HandoverForm vehicles={vehicles} onSubmitted={() => { load(); onChange(); }} />
      </TabsContent>
      <TabsContent value="history" className="mt-6">
        <HistoryList protocols={protocols} vehicles={vehicles} onChanged={() => { load(); onChange(); }} />
      </TabsContent>
    </Tabs>
  );
};

const initialForm = () => ({
  vehicle_id: "",
  driver_name: "",
  fuel_level: 50,
  mileage: "",
  extras: DEFAULT_EXTRAS.map((n) => ({ name: n, present: true })),
  newExtra: "",
  signature_base64: "",
});

const HandoverForm = ({ vehicles, onSubmitted }) => {
  const [form, setForm] = useState(initialForm());

  const available = vehicles.filter((v) => v.status !== "on_road");

  useEffect(() => {
    // auto-fill mileage when vehicle selected
    if (form.vehicle_id) {
      const v = vehicles.find((x) => x.id === form.vehicle_id);
      if (v && !form.mileage) setForm((f) => ({ ...f, mileage: v.mileage }));
    }
    // eslint-disable-next-line
  }, [form.vehicle_id]);

  const toggleExtra = (idx) => {
    setForm((f) => {
      const arr = [...f.extras];
      arr[idx] = { ...arr[idx], present: !arr[idx].present };
      return { ...f, extras: arr };
    });
  };
  const removeExtra = (idx) => {
    setForm((f) => ({ ...f, extras: f.extras.filter((_, i) => i !== idx) }));
  };
  const addExtra = () => {
    if (!form.newExtra.trim()) return;
    setForm((f) => ({ ...f, extras: [...f.extras, { name: f.newExtra.trim(), present: true }], newExtra: "" }));
  };

  const submit = async () => {
    if (!form.vehicle_id) return toast.error("Select a vehicle");
    if (!form.driver_name.trim()) return toast.error("Enter driver name");
    if (form.mileage === "" || form.mileage === null) return toast.error("Enter mileage");
    if (!form.signature_base64) return toast.error("Signature required");
    try {
      await api.post("/protocols/handover", {
        vehicle_id: form.vehicle_id,
        driver_name: form.driver_name,
        fuel_level: form.fuel_level,
        mileage: Number(form.mileage),
        extras: form.extras.map(({ name, present }) => ({ name, present })),
        signature_base64: form.signature_base64,
      });
      toast.success("Handover completed — vehicle is now on the road");
      setForm(initialForm());
      onSubmitted();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to submit handover");
    }
  };

  return (
    <div data-testid="handover-form" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="bg-[#141414] border-white/10 rounded-lg p-6 lg:col-span-2 space-y-5">
        <div>
          <h2 className="font-heading text-2xl font-semibold">New Handover</h2>
          <p className="text-sm text-zinc-500 mt-1">Hand over the vehicle to a driver.</p>
        </div>

        <Field label="Vehicle">
          <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v, mileage: "" })}>
            <SelectTrigger data-testid="handover-vehicle-select" className="bg-[#0A0A0A] border-white/10">
              <SelectValue placeholder="Select an available vehicle" />
            </SelectTrigger>
            <SelectContent className="bg-[#141414] border-white/10 text-white">
              {available.length === 0 ? (
                <div className="px-3 py-2 text-sm text-zinc-500">No available vehicles</div>
              ) : available.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.brand} {v.model} · {v.license_plate}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Driver Name">
            <Input data-testid="handover-driver-input" value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} className="bg-[#0A0A0A] border-white/10" placeholder="John Doe" />
          </Field>
          <Field label="Mileage (km)">
            <Input data-testid="handover-mileage-input" type="number" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} className="bg-[#0A0A0A] border-white/10 font-mono" />
          </Field>
        </div>

        <Field label={`Fuel Level — ${form.fuel_level}%`}>
          <div className="flex items-center gap-3 px-1">
            <Fuel className="w-4 h-4 text-zinc-500" />
            <Slider
              data-testid="handover-fuel-slider"
              value={[form.fuel_level]}
              onValueChange={([v]) => setForm({ ...form, fuel_level: v })}
              min={0} max={100} step={5}
              className="flex-1"
            />
            <span className="font-mono text-sm w-10 text-right">{form.fuel_level}%</span>
          </div>
        </Field>

        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Extras Checklist</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-md bg-[#0A0A0A] border border-white/10">
            {form.extras.map((e, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 group">
                <label className="flex items-center gap-2 cursor-pointer flex-1" data-testid={`extra-${idx}`}>
                  <Checkbox
                    checked={e.present}
                    onCheckedChange={() => toggleExtra(idx)}
                    className="border-white/30 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <span className={`text-sm ${e.present ? "text-white" : "text-zinc-500 line-through"}`}>
                    {e.name}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => removeExtra(idx)}
                  data-testid={`remove-extra-${idx}`}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              data-testid="new-extra-input"
              value={form.newExtra}
              onChange={(e) => setForm({ ...form, newExtra: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExtra())}
              placeholder="Add custom item"
              className="bg-[#0A0A0A] border-white/10 flex-1"
            />
            <Button type="button" onClick={addExtra} variant="secondary" data-testid="add-extra-btn" className="bg-[#1A1A1A] hover:bg-[#252525] border border-white/10">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Card className="bg-[#141414] border-white/10 rounded-lg p-6 space-y-4">
        <div>
          <h3 className="font-heading text-lg font-semibold">Driver Signature</h3>
          <p className="text-xs text-zinc-500 mt-1">Sign with your finger or mouse below.</p>
        </div>
        <SignaturePad onChange={(data) => setForm((f) => ({ ...f, signature_base64: data }))} />
        <Button
          onClick={submit}
          data-testid="handover-submit-btn"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white blue-glow border border-blue-500/50 h-11"
        >
          <Check className="w-4 h-4 mr-2" /> Complete Handover
        </Button>
        <p className="text-xs text-zinc-600 text-center">
          Vehicle status will switch to <span className="text-blue-400">On the Road</span>
        </p>
      </Card>
    </div>
  );
};

const HistoryList = ({ protocols, vehicles, onChanged }) => {
  const [returning, setReturning] = useState(null);
  const [retForm, setRetForm] = useState({ driver_name: "", fuel_level: 50, mileage: "", extras: [], signature_base64: "" });
  const [viewing, setViewing] = useState(null);

  const vMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));

  const openReturn = (p) => {
    setReturning(p);
    setRetForm({
      driver_name: p.driver_name,
      fuel_level: p.fuel_level,
      mileage: vMap[p.vehicle_id]?.mileage ?? p.mileage,
      extras: p.extras.map((e) => ({ ...e })),
      signature_base64: "",
    });
  };

  const submitReturn = async () => {
    if (!retForm.signature_base64) return toast.error("Signature required");
    if (retForm.mileage === "" || retForm.mileage === null) return toast.error("Mileage required");
    try {
      await api.post("/protocols/return", {
        handover_id: returning.id,
        driver_name: retForm.driver_name,
        fuel_level: retForm.fuel_level,
        mileage: Number(retForm.mileage),
        extras: retForm.extras,
        signature_base64: retForm.signature_base64,
      });
      toast.success("Vehicle returned — status set to Parked");
      setReturning(null);
      onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to process return");
    }
  };

  const toggleRetExtra = (idx) => {
    setRetForm((f) => {
      const arr = [...f.extras];
      arr[idx] = { ...arr[idx], present: !arr[idx].present };
      return { ...f, extras: arr };
    });
  };

  if (protocols.length === 0) {
    return (
      <div className="border border-dashed border-white/10 rounded-lg p-12 text-center text-zinc-500 text-sm">
        No handover protocols yet.
      </div>
    );
  }

  return (
    <div data-testid="protocol-history" className="space-y-3">
      {protocols.map((p) => {
        const v = vMap[p.vehicle_id];
        const isReturned = p.returned;
        return (
          <Card
            key={p.id}
            data-testid={`protocol-card-${p.id}`}
            className={`rounded-lg border transition-all ${
              isReturned
                ? "bg-emerald-950/30 border-emerald-500/30"
                : "bg-[#141414] border-white/10 hover:border-white/30"
            }`}
          >
            <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center border ${
                  isReturned ? "bg-emerald-500/15 border-emerald-500/30" : "bg-blue-500/10 border-blue-500/30"
                }`}>
                  {isReturned
                    ? <Check className="w-5 h-5 text-emerald-400" />
                    : <ClipboardSignature className="w-5 h-5 text-blue-400" />}
                </div>
                <div>
                  <div className="font-medium">
                    {v ? `${v.brand} ${v.model}` : "Unknown vehicle"}
                    <span className="text-xs font-mono text-zinc-500 ml-2">{v?.license_plate}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    Driver: <span className="text-zinc-300">{p.driver_name}</span> · {formatDate(p.created_at)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-xs">
                  <div className="font-mono text-zinc-300">{formatNumber(p.mileage)} km · {p.fuel_level}% fuel</div>
                  {isReturned && <div className="text-emerald-400 mt-0.5 font-mono uppercase tracking-wider">RETURNED</div>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setViewing(p)} data-testid={`view-protocol-${p.id}`} className="text-zinc-400 hover:text-white">
                  View
                </Button>
                {!isReturned && (
                  <Button size="sm" onClick={() => openReturn(p)} data-testid={`return-vehicle-${p.id}`} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Process Return
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      {/* Return Dialog */}
      <Dialog open={!!returning} onOpenChange={(o) => !o && setReturning(null)}>
        <DialogContent className="bg-[#141414] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Return Vehicle</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Verify the same categories on return.
            </DialogDescription>
          </DialogHeader>
          {returning && (
            <div className="grid gap-4">
              <Field label="Driver Name">
                <Input data-testid="return-driver-input" value={retForm.driver_name} onChange={(e) => setRetForm({ ...retForm, driver_name: e.target.value })} className="bg-[#0A0A0A] border-white/10" />
              </Field>
              <Field label="Mileage on return (km)">
                <Input data-testid="return-mileage-input" type="number" value={retForm.mileage} onChange={(e) => setRetForm({ ...retForm, mileage: e.target.value })} className="bg-[#0A0A0A] border-white/10 font-mono" />
              </Field>
              <Field label={`Fuel Level — ${retForm.fuel_level}%`}>
                <Slider
                  data-testid="return-fuel-slider"
                  value={[retForm.fuel_level]}
                  onValueChange={([v]) => setRetForm({ ...retForm, fuel_level: v })}
                  min={0} max={100} step={5}
                />
              </Field>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Extras Verification</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-md bg-[#0A0A0A] border border-white/10">
                  {retForm.extras.map((e, idx) => (
                    <label key={idx} className="flex items-center gap-2 cursor-pointer" data-testid={`return-extra-${idx}`}>
                      <Checkbox
                        checked={e.present}
                        onCheckedChange={() => toggleRetExtra(idx)}
                        className="border-white/30 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      <span className={`text-sm ${e.present ? "text-white" : "text-zinc-500 line-through"}`}>{e.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Field label="Driver Signature">
                <SignaturePad onChange={(data) => setRetForm((f) => ({ ...f, signature_base64: data }))} testId="return-signature-pad" />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button onClick={submitReturn} data-testid="return-submit-btn" className="bg-blue-600 hover:bg-blue-700 text-white">
              Complete Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="bg-[#141414] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Handover Protocol</DialogTitle>
            <DialogDescription className="text-zinc-500">
              {viewing && formatDate(viewing.created_at)}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <Row label="Driver" value={viewing.driver_name} />
              <Row label="Vehicle" value={vMap[viewing.vehicle_id] ? `${vMap[viewing.vehicle_id].brand} ${vMap[viewing.vehicle_id].model} · ${vMap[viewing.vehicle_id].license_plate}` : "—"} />
              <Row label="Mileage" value={`${formatNumber(viewing.mileage)} km`} />
              <Row label="Fuel" value={`${viewing.fuel_level}%`} />
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">Extras</div>
                <div className="flex flex-wrap gap-1.5">
                  {viewing.extras.map((e, i) => (
                    <span key={i} className={`px-2 py-0.5 text-xs rounded-sm border font-mono ${
                      e.present ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-zinc-800/50 text-zinc-500 border-white/10 line-through"
                    }`}>{e.name}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">Signature</div>
                <img src={viewing.signature_base64} alt="signature" className="w-full bg-[#0A0A0A] rounded-md border border-white/10" />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Row = ({ label, value }) => (
  <div className="flex justify-between border-b border-white/5 pb-2">
    <span className="text-zinc-500 text-[10px] uppercase tracking-[0.2em]">{label}</span>
    <span className="font-mono">{value}</span>
  </div>
);

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</Label>
    {children}
  </div>
);
