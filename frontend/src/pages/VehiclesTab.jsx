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
import { Checkbox } from "../components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { StatusBadge } from "../components/StatusBadge";
import { PhotoCapture } from "../components/PhotoCapture";
import { VehicleQRModal } from "../components/VehicleQRModal";
import { ExtrasEditor } from "../components/ExtrasEditor";
import { api, API } from "../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle, Car as CarIcon, ImageIcon, QrCode, Download } from "lucide-react";
import { formatNumber, formatDate } from "../lib/format";
import { downloadCSV } from "../lib/exports";

const STATUS_OPTIONS = ["parked", "on_road", "damaged", "maintenance"];
const emptyVehicle = { brand: "", model: "", license_plate: "", status: "parked", mileage: 0, extras: [] };

export const VehiclesTab = ({ vehicles, onChange }) => {
  const { t } = useTranslation();
  return (
    <Tabs defaultValue="list" className="w-full">
      <TabsList className="bg-[#141414] border border-white/10 rounded-md p-1 h-auto">
        <TabsTrigger value="list" data-testid="vehicles-subtab-list" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-zinc-400 rounded-sm px-4 py-1.5">
          <CarIcon className="w-4 h-4 mr-2" /> {t("vehicles.subtab_list")}
        </TabsTrigger>
        <TabsTrigger value="damages" data-testid="vehicles-subtab-damages" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-zinc-400 rounded-sm px-4 py-1.5">
          <AlertTriangle className="w-4 h-4 mr-2" /> {t("vehicles.subtab_damages")}
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
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyVehicle);
  const [qrVehicle, setQrVehicle] = useState(null);

  const openCreate = () => { setEditing(null); setForm(emptyVehicle); setOpen(true); };
  const openEdit = (v) => { setEditing(v); setForm({ ...v }); setOpen(true); };

  const submit = async () => {
    if (!form.brand || !form.model || !form.license_plate) {
      toast.error(t("vehicles.validation_required"));
      return;
    }
    try {
      const payload = { ...form, mileage: Number(form.mileage) || 0 };
      if (editing) await api.put(`/vehicles/${editing.id}`, payload);
      else await api.post("/vehicles", payload);
      toast.success(editing ? t("vehicles.updated") : t("vehicles.added"));
      setOpen(false);
      onChange();
    } catch {
      toast.error(t("common.failed"));
    }
  };

  const remove = async (id) => {
    if (!window.confirm(t("vehicles.deleteConfirm"))) return;
    try {
      await api.delete(`/vehicles/${id}`);
      toast.success(t("vehicles.deleted"));
      onChange();
    } catch { toast.error(t("common.failed")); }
  };

  return (
    <div data-testid="vehicles-list-section" className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-2xl font-semibold">{t("vehicles.title")}</h2>
          <p className="text-sm text-zinc-500 mt-1">{t("vehicles.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => downloadCSV(API, "/exports/vehicles.csv", "vehicles.csv")}
            data-testid="vehicles-export-csv-btn"
            className="bg-[#1A1A1A] hover:bg-[#252525] border border-white/10 text-white"
          >
            <Download className="w-4 h-4 mr-2" /> {t("vehicles.export_csv")}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} data-testid="add-vehicle-btn" className="bg-blue-600 hover:bg-blue-700 text-white border border-blue-500/50 blue-glow">
                <Plus className="w-4 h-4 mr-2" /> {t("vehicles.add")}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#141414] border-white/10 text-white">
              <DialogHeader>
                <DialogTitle className="font-heading">{editing ? t("vehicles.edit") : t("vehicles.add")}</DialogTitle>
                <DialogDescription className="text-zinc-500">{t("vehicles.dialogDescription")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <Field label={t("vehicles.brand")}><Input data-testid="vehicle-brand-input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="bg-[#0A0A0A] border-white/10" placeholder="Tesla" /></Field>
                <Field label={t("vehicles.model")}><Input data-testid="vehicle-model-input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="bg-[#0A0A0A] border-white/10" placeholder="Model 3" /></Field>
                <Field label={t("vehicles.license_plate")}><Input data-testid="vehicle-plate-input" value={form.license_plate} onChange={(e) => setForm({ ...form, license_plate: e.target.value.toUpperCase() })} className="bg-[#0A0A0A] border-white/10 font-mono" placeholder="ABC-1234" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("vehicles.status")}>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger data-testid="vehicle-status-select" className="bg-[#0A0A0A] border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#141414] border-white/10 text-white">
                        {STATUS_OPTIONS.map((k) => (<SelectItem key={k} value={k}>{t(`status.${k}`)}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t("vehicles.mileage")}><Input data-testid="vehicle-mileage-input" type="number" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} className="bg-[#0A0A0A] border-white/10 font-mono" /></Field>
                </div>
                <Field label={t("vehicles.extras_template")}>
                  <ExtrasEditor
                    value={form.extras || []}
                    onChange={(extras) => setForm({ ...form, extras })}
                    testId="vehicle-extras-editor"
                  />
                </Field>
              </div>
              <DialogFooter>
                <Button onClick={submit} data-testid="vehicle-submit-btn" className="bg-blue-600 hover:bg-blue-700 text-white">
                  {editing ? t("vehicles.saveChanges") : t("vehicles.addBtn")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState text={t("vehicles.empty")} />
      ) : (
        <Card className="bg-[#141414] border-white/10 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/[0.03] border-b border-white/10">
                <tr>
                  <Th>{t("vehicles.brand")}</Th>
                  <Th>{t("vehicles.model")}</Th>
                  <Th>{t("vehicles.license_plate")}</Th>
                  <Th>{t("vehicles.status")}</Th>
                  <Th className="text-right">{t("vehicles.mileage")}</Th>
                  <Th className="text-right">{t("common.actions")}</Th>
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
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setQrVehicle(v)} data-testid={`vehicle-qr-${v.id}`} className="text-zinc-400 hover:text-blue-400" title={t("vehicles.qr_sticker")}>
                          <QrCode className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(v)} data-testid={`vehicle-edit-${v.id}`} className="text-zinc-400 hover:text-white">{t("common.edit")}</Button>
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

      <VehicleQRModal vehicle={qrVehicle} open={!!qrVehicle} onOpenChange={(o) => !o && setQrVehicle(null)} />
    </div>
  );
};

const DamagesSection = ({ vehicles, onChange }) => {
  const { t } = useTranslation();
  const [damages, setDamages] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: "", description: "", photo_base64: "",
    tolerated_confirm: false, tolerated: false,
  });

  const load = async () => {
    try { setDamages((await api.get("/damages")).data); }
    catch { toast.error(t("common.failed")); }
  };
  useEffect(() => { load(); }, []);

  const openDialog = () => {
    setForm({ vehicle_id: "", description: "", photo_base64: "", tolerated_confirm: false, tolerated: false });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.vehicle_id || !form.description) return toast.error(t("damages.validation_select"));
    if (form.tolerated && !form.tolerated_confirm) return toast.error(t("damages.validation_confirm"));
    try {
      await api.post("/damages", {
        vehicle_id: form.vehicle_id,
        description: form.description,
        photo_base64: form.photo_base64 || null,
        tolerated: form.tolerated,
      });
      toast.success(t("damages.logged"));
      setOpen(false);
      load();
      onChange();
    } catch { toast.error(t("common.failed")); }
  };

  const remove = async (id) => {
    if (!window.confirm(t("damages.deleteConfirm"))) return;
    await api.delete(`/damages/${id}`);
    load();
    onChange();
  };

  const vehicleLabel = (id) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.brand} ${v.model} · ${v.license_plate}` : t("common.unknown");
  };

  return (
    <div data-testid="damages-section" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold">{t("damages.title")}</h2>
          <p className="text-sm text-zinc-500 mt-1">{t("damages.subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openDialog} data-testid="add-damage-btn" className="bg-blue-600 hover:bg-blue-700 text-white border border-blue-500/50 blue-glow">
              <Plus className="w-4 h-4 mr-2" /> {t("damages.log")}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#141414] border-white/10 text-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">{t("damages.log")}</DialogTitle>
              <DialogDescription className="text-zinc-500">{t("damages.dialogDescription")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <Field label={t("damages.vehicle")}>
                <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                  <SelectTrigger data-testid="damage-vehicle-select" className="bg-[#0A0A0A] border-white/10">
                    <SelectValue placeholder={t("damages.selectVehicle")} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-white/10 text-white">
                    {vehicles.map((v) => (<SelectItem key={v.id} value={v.id}>{v.brand} {v.model} · {v.license_plate}</SelectItem>))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("damages.description")}>
                <Textarea data-testid="damage-description-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-[#0A0A0A] border-white/10 min-h-[80px]" placeholder={t("damages.descriptionPlaceholder")} />
              </Field>
              <Field label={t("damages.photo")}>
                <PhotoCapture value={form.photo_base64} onChange={(v) => setForm({ ...form, photo_base64: v })} />
              </Field>
              <div className="space-y-3 p-3 rounded-md bg-[#0A0A0A] border border-white/10">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("damages.category")}</div>
                <label className="flex items-center gap-3 cursor-pointer" data-testid="damage-not-tolerated-radio">
                  <input type="radio" checked={!form.tolerated} onChange={() => setForm({ ...form, tolerated: false, tolerated_confirm: false })} className="accent-red-500" />
                  <span className="text-sm">
                    <span className="text-red-400 font-medium">{t("damages.not_tolerated")}</span>
                    <span className="text-zinc-500 text-xs ml-2">{t("damages.not_tolerated_hint")}</span>
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer" data-testid="damage-tolerated-radio">
                  <input type="radio" checked={form.tolerated} onChange={() => setForm({ ...form, tolerated: true })} className="accent-emerald-500" />
                  <span className="text-sm">
                    <span className="text-emerald-400 font-medium">{t("damages.tolerated")}</span>
                    <span className="text-zinc-500 text-xs ml-2">{t("damages.tolerated_hint")}</span>
                  </span>
                </label>
                {form.tolerated && (
                  <label className="flex items-start gap-3 mt-3 pt-3 border-t border-white/10">
                    <Checkbox checked={form.tolerated_confirm} onCheckedChange={(v) => setForm({ ...form, tolerated_confirm: !!v })} data-testid="damage-tolerated-confirm-checkbox" className="border-white/30 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 mt-0.5" />
                    <span className="text-xs text-zinc-400">{t("damages.tolerated_confirm")}</span>
                  </label>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} data-testid="damage-submit-btn" className="bg-blue-600 hover:bg-blue-700 text-white">{t("damages.logBtn")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {damages.length === 0 ? (
        <EmptyState text={t("damages.empty")} />
      ) : (
        (() => {
          // Group by vehicle, sort vehicles alphabetically (brand then model)
          const groups = new Map();
          for (const d of damages) {
            const arr = groups.get(d.vehicle_id) || [];
            arr.push(d);
            groups.set(d.vehicle_id, arr);
          }
          const sortedVehicleIds = [...groups.keys()].sort((a, b) => {
            const va = vehicles.find((x) => x.id === a);
            const vb = vehicles.find((x) => x.id === b);
            const la = va ? `${va.brand} ${va.model}`.toLowerCase() : "zzz_unknown";
            const lb = vb ? `${vb.brand} ${vb.model}`.toLowerCase() : "zzz_unknown";
            return la.localeCompare(lb);
          });
          return (
            <div className="space-y-6">
              {sortedVehicleIds.map((vid) => {
                const v = vehicles.find((x) => x.id === vid);
                const items = groups.get(vid).slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
                return (
                  <div key={vid} data-testid={`damage-group-${vid}`} className="space-y-3">
                    <div className="flex items-center gap-3 pb-2 border-b border-white/10">
                      <div className="w-8 h-8 rounded-md bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                        <CarIcon className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-heading font-semibold">
                          {v ? `${v.brand} ${v.model}` : t("common.unknown")}
                        </div>
                        <div className="text-xs font-mono text-zinc-500">{v?.license_plate || "—"}</div>
                      </div>
                      <span className="ml-auto text-xs font-mono text-zinc-500">{items.length}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map((d) => (
                        <Card key={d.id} data-testid={`damage-card-${d.id}`} className="bg-[#141414] border-white/10 rounded-lg overflow-hidden hover:border-white/30 transition-all">
                          <div className="aspect-video bg-[#0A0A0A] flex items-center justify-center border-b border-white/10">
                            {d.photo_base64 ? <img src={d.photo_base64} alt="damage" className="w-full h-full object-cover" /> : <ImageIcon className="w-10 h-10 text-zinc-700" />}
                          </div>
                          <div className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-sm line-clamp-3 flex-1">{d.description}</div>
                              <span className={`px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider border shrink-0 ${d.tolerated ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}>
                                {d.tolerated ? t("damages.tolerated") : t("damages.not_tolerated")}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-zinc-600">
                              <span>{formatDate(d.created_at)}</span>
                              <Button size="sm" variant="ghost" onClick={() => remove(d.id)} data-testid={`damage-delete-${d.id}`} className="text-zinc-500 hover:text-red-400 h-7 px-2"><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
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
const Th = ({ children, className = "" }) => (<th className={`text-left px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium ${className}`}>{children}</th>);
const Td = ({ children, className = "" }) => (<td className={`px-4 py-3 text-sm ${className}`}>{children}</td>);
const EmptyState = ({ text }) => (<div className="border border-dashed border-white/10 rounded-lg p-12 text-center text-zinc-500 text-sm">{text}</div>);
