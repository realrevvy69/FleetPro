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
import { Checkbox } from "../components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { StatusBadge } from "../components/StatusBadge";
import { PhotoCapture } from "../components/PhotoCapture";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle, Car as CarIcon, ImageIcon } from "lucide-react";
import { formatNumber, formatDate, STATUS_META } from "../lib/format";

const emptyVehicle = { brand: "", model: "", license_plate: "", status: "parked", mileage: 0 };

export const VehiclesTab = ({ vehicles, onChange }) => {
  return (
    <Tabs defaultValue="list" className="w-full">
      <TabsList className="bg-[#141414] border border-white/10 rounded-md p-1 h-auto">
        <TabsTrigger
          value="list"
          data-testid="vehicles-subtab-list"
          className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-zinc-400 rounded-sm px-4 py-1.5"
        >
          <CarIcon className="w-4 h-4 mr-2" /> All Vehicles
        </TabsTrigger>
        <TabsTrigger
          value="damages"
          data-testid="vehicles-subtab-damages"
          className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-zinc-400 rounded-sm px-4 py-1.5"
        >
          <AlertTriangle className="w-4 h-4 mr-2" /> Damages
        </TabsTrigger>
      </TabsList>

      <TabsContent value="list" className="mt-6">
        <VehicleList vehicles={vehicles} onChange={onChange} />
      </TabsContent>
      <TabsContent value="damages" className="mt-6">
        <DamagesSection vehicles={vehicles} onChange={onChange} />
      </TabsContent>
    </Tabs>
  );
};

const VehicleList = ({ vehicles, onChange }) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyVehicle);

  const openCreate = () => { setEditing(null); setForm(emptyVehicle); setOpen(true); };
  const openEdit = (v) => { setEditing(v); setForm({ ...v }); setOpen(true); };

  const submit = async () => {
    if (!form.brand || !form.model || !form.license_plate) {
      toast.error("Brand, model and license plate are required");
      return;
    }
    try {
      const payload = { ...form, mileage: Number(form.mileage) || 0 };
      if (editing) await api.put(`/vehicles/${editing.id}`, payload);
      else await api.post("/vehicles", payload);
      toast.success(editing ? "Vehicle updated" : "Vehicle added");
      setOpen(false);
      onChange();
    } catch (e) {
      toast.error("Failed to save vehicle");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this vehicle? Related damages and schedules will be removed.")) return;
    try {
      await api.delete(`/vehicles/${id}`);
      toast.success("Vehicle deleted");
      onChange();
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div data-testid="vehicles-list-section" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Fleet Inventory</h2>
          <p className="text-sm text-zinc-500 mt-1">Manage every vehicle in your fleet.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openCreate}
              data-testid="add-vehicle-btn"
              className="bg-blue-600 hover:bg-blue-700 text-white border border-blue-500/50 blue-glow"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#141414] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="font-heading">{editing ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
              <DialogDescription className="text-zinc-500">
                Fill in the details below.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <Field label="Brand">
                <Input data-testid="vehicle-brand-input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="bg-[#0A0A0A] border-white/10" placeholder="Tesla" />
              </Field>
              <Field label="Model">
                <Input data-testid="vehicle-model-input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="bg-[#0A0A0A] border-white/10" placeholder="Model 3" />
              </Field>
              <Field label="License Plate">
                <Input data-testid="vehicle-plate-input" value={form.license_plate} onChange={(e) => setForm({ ...form, license_plate: e.target.value.toUpperCase() })} className="bg-[#0A0A0A] border-white/10 font-mono" placeholder="ABC-1234" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger data-testid="vehicle-status-select" className="bg-[#0A0A0A] border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#141414] border-white/10 text-white">
                      {Object.entries(STATUS_META).map(([k, m]) => (
                        <SelectItem key={k} value={k}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Mileage (km)">
                  <Input data-testid="vehicle-mileage-input" type="number" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} className="bg-[#0A0A0A] border-white/10 font-mono" />
                </Field>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} data-testid="vehicle-submit-btn" className="bg-blue-600 hover:bg-blue-700 text-white">
                {editing ? "Save Changes" : "Add Vehicle"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState text="No vehicles yet. Add your first one to get started." />
      ) : (
        <Card className="bg-[#141414] border-white/10 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/[0.03] border-b border-white/10">
                <tr>
                  <Th>Brand</Th>
                  <Th>Model</Th>
                  <Th>License Plate</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Mileage</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id} data-testid={`vehicle-row-${v.id}`} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <Td>{v.brand}</Td>
                    <Td>{v.model}</Td>
                    <Td className="font-mono text-blue-400">{v.license_plate}</Td>
                    <Td><StatusBadge status={v.status} /></Td>
                    <Td className="text-right font-mono">{formatNumber(v.mileage)} km</Td>
                    <Td className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(v)} data-testid={`vehicle-edit-${v.id}`} className="text-zinc-400 hover:text-white">
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(v.id)} data-testid={`vehicle-delete-${v.id}`} className="text-zinc-400 hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

const DamagesSection = ({ vehicles, onChange }) => {
  const [damages, setDamages] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: "",
    description: "",
    photo_base64: "",
    not_tolerated: true,
    tolerated_confirm: false,
    tolerated: false,
  });

  const load = async () => {
    try {
      const r = await api.get("/damages");
      setDamages(r.data);
    } catch {
      toast.error("Failed to load damages");
    }
  };
  useEffect(() => { load(); }, []);

  const openDialog = () => {
    setForm({ vehicle_id: "", description: "", photo_base64: "", not_tolerated: true, tolerated_confirm: false, tolerated: false });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.vehicle_id || !form.description) {
      toast.error("Select a vehicle and add description");
      return;
    }
    if (form.tolerated && !form.tolerated_confirm) {
      toast.error("Please confirm the tolerated damage checkbox");
      return;
    }
    try {
      await api.post("/damages", {
        vehicle_id: form.vehicle_id,
        description: form.description,
        photo_base64: form.photo_base64 || null,
        tolerated: form.tolerated,
      });
      toast.success("Damage logged");
      setOpen(false);
      load();
      onChange();
    } catch {
      toast.error("Failed to save damage");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this damage entry?")) return;
    await api.delete(`/damages/${id}`);
    load();
    onChange();
  };

  const vehicleLabel = (id) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.brand} ${v.model} · ${v.license_plate}` : "Unknown";
  };

  return (
    <div data-testid="damages-section" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Damage Log</h2>
          <p className="text-sm text-zinc-500 mt-1">Record damages with photos and tolerance status.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openDialog}
              data-testid="add-damage-btn"
              className="bg-blue-600 hover:bg-blue-700 text-white border border-blue-500/50 blue-glow"
            >
              <Plus className="w-4 h-4 mr-2" /> Log Damage
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#141414] border-white/10 text-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">Log Damage</DialogTitle>
              <DialogDescription className="text-zinc-500">
                Document the damage and link it to the vehicle.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <Field label="Vehicle">
                <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                  <SelectTrigger data-testid="damage-vehicle-select" className="bg-[#0A0A0A] border-white/10">
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-white/10 text-white">
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} · {v.license_plate}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Description">
                <Textarea
                  data-testid="damage-description-input"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="bg-[#0A0A0A] border-white/10 min-h-[80px]"
                  placeholder="Scratch on left rear bumper..."
                />
              </Field>
              <Field label="Photo">
                <PhotoCapture value={form.photo_base64} onChange={(v) => setForm({ ...form, photo_base64: v })} />
              </Field>
              <div className="space-y-3 p-3 rounded-md bg-[#0A0A0A] border border-white/10">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Damage Category</div>
                <label className="flex items-center gap-3 cursor-pointer" data-testid="damage-not-tolerated-radio">
                  <input
                    type="radio"
                    checked={!form.tolerated}
                    onChange={() => setForm({ ...form, tolerated: false, tolerated_confirm: false })}
                    className="accent-red-500"
                  />
                  <span className="text-sm">
                    <span className="text-red-400 font-medium">Not Tolerated</span>
                    <span className="text-zinc-500 text-xs ml-2">Will mark vehicle as Damaged</span>
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer" data-testid="damage-tolerated-radio">
                  <input
                    type="radio"
                    checked={form.tolerated}
                    onChange={() => setForm({ ...form, tolerated: true })}
                    className="accent-emerald-500"
                  />
                  <span className="text-sm">
                    <span className="text-emerald-400 font-medium">Tolerated</span>
                    <span className="text-zinc-500 text-xs ml-2">Cosmetic only — vehicle stays usable</span>
                  </span>
                </label>
                {form.tolerated && (
                  <label className="flex items-start gap-3 mt-3 pt-3 border-t border-white/10">
                    <Checkbox
                      checked={form.tolerated_confirm}
                      onCheckedChange={(v) => setForm({ ...form, tolerated_confirm: !!v })}
                      data-testid="damage-tolerated-confirm-checkbox"
                      className="border-white/30 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 mt-0.5"
                    />
                    <span className="text-xs text-zinc-400">
                      I confirm this damage is acceptable and does not require immediate repair.
                    </span>
                  </label>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} data-testid="damage-submit-btn" className="bg-blue-600 hover:bg-blue-700 text-white">
                Log Damage
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {damages.length === 0 ? (
        <EmptyState text="No damages recorded." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {damages.map((d) => (
            <Card
              key={d.id}
              data-testid={`damage-card-${d.id}`}
              className="bg-[#141414] border-white/10 rounded-lg overflow-hidden hover:border-white/30 transition-all"
            >
              <div className="aspect-video bg-[#0A0A0A] flex items-center justify-center border-b border-white/10">
                {d.photo_base64 ? (
                  <img src={d.photo_base64} alt="damage" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-10 h-10 text-zinc-700" />
                )}
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono text-zinc-500">{vehicleLabel(d.vehicle_id)}</div>
                    <div className="text-sm mt-1 line-clamp-2">{d.description}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider border ${
                    d.tolerated
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-red-500/10 text-red-400 border-red-500/30"
                  }`}>
                    {d.tolerated ? "Tolerated" : "Not Tolerated"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-600">
                  <span>{formatDate(d.created_at)}</span>
                  <Button size="sm" variant="ghost" onClick={() => remove(d.id)} data-testid={`damage-delete-${d.id}`} className="text-zinc-500 hover:text-red-400 h-7 px-2">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</Label>
    {children}
  </div>
);

const Th = ({ children, className = "" }) => (
  <th className={`text-left px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium ${className}`}>
    {children}
  </th>
);
const Td = ({ children, className = "" }) => (
  <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>
);

const EmptyState = ({ text }) => (
  <div className="border border-dashed border-white/10 rounded-lg p-12 text-center text-zinc-500 text-sm">
    {text}
  </div>
);
