import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Slider } from "../components/ui/slider";
import { Checkbox } from "../components/ui/checkbox";
import { toast } from "sonner";
import { SignaturePad } from "../components/SignaturePad";
import { Toaster } from "../components/ui/sonner";
import { Car, Check, Fuel, Plus, X } from "lucide-react";

export default function MobileHandoverPage() {
  const { t } = useTranslation();
  const { vehicleId } = useParams();
  const nav = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    driver_name: "", fuel_level: 50, mileage: "",
    extras: [],
    newExtra: "", signature_base64: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(`/public/vehicles/${vehicleId}`);
        setVehicle(r.data);
        setForm((f) => ({
          ...f,
          mileage: r.data.mileage,
          extras: (r.data.extras || []).map((name) => ({ name, present: true })),
        }));
      } catch { toast.error(t("mobile.not_found")); }
      finally { setLoading(false); }
    })();
  }, [vehicleId, t]);

  const toggleExtra = (i) => setForm((f) => {
    const arr = [...f.extras]; arr[i] = { ...arr[i], present: !arr[i].present };
    return { ...f, extras: arr };
  });
  const addExtra = () => {
    const name = form.newExtra.trim();
    if (!name) return;
    setForm((f) => ({ ...f, extras: f.extras.some((e) => e.name === name) ? f.extras : [...f.extras, { name, present: true }], newExtra: "" }));
  };
  const removeExtra = (i) => setForm((f) => ({ ...f, extras: f.extras.filter((_, idx) => idx !== i) }));

  const submit = async () => {
    if (!form.driver_name.trim()) return toast.error(t("protocols.validation_driver"));
    if (form.mileage === "" || form.mileage === null) return toast.error(t("protocols.validation_mileage"));
    if (!form.signature_base64) return toast.error(t("protocols.validation_signature"));
    try {
      await api.post("/protocols/handover", {
        vehicle_id: vehicleId,
        driver_name: form.driver_name,
        fuel_level: form.fuel_level,
        mileage: Number(form.mileage),
        extras: form.extras.map(({ name, present }) => ({ name, present })),
        signature_base64: form.signature_base64,
      });
      setDone(true);
      toast.success(t("mobile.complete"));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("common.failed"));
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">{t("mobile.loading")}</div>;
  if (!vehicle) return <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">{t("mobile.not_found")}</div>;

  if (done) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-6">
        <Toaster theme="dark" />
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="font-heading text-3xl font-bold">{t("mobile.complete")}</h1>
          <p className="text-zinc-400">{t("mobile.drive_safe", { vehicle: `${vehicle.brand} ${vehicle.model}` })}</p>
          <Button onClick={() => nav("/")} className="bg-blue-600 hover:bg-blue-700 text-white">{t("mobile.back")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">
      <Toaster theme="dark" position="top-center" />
      <div className="max-w-lg mx-auto px-5 py-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-md bg-blue-600 flex items-center justify-center blue-glow">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <div className="font-heading font-bold text-xl leading-none">Fleet<span className="text-blue-500">Pro</span></div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mt-0.5">{t("mobile.subtitle")}</div>
          </div>
        </div>

        <Card className="bg-[#141414] border-white/10 rounded-lg p-5 mb-5">
          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{t("mobile.vehicle_label")}</div>
          <div className="text-2xl font-heading font-bold mt-1">{vehicle.brand} {vehicle.model}</div>
          <div className="font-mono text-blue-400 text-sm mt-1">{vehicle.license_plate}</div>
        </Card>

        <Card className="bg-[#141414] border-white/10 rounded-lg p-5 space-y-5">
          <Field label={t("mobile.your_name")}><Input data-testid="mobile-driver-input" value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} className="bg-[#0A0A0A] border-white/10 h-12 text-base" /></Field>
          <Field label={t("protocols.mileage")}><Input data-testid="mobile-mileage-input" type="number" inputMode="numeric" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} className="bg-[#0A0A0A] border-white/10 h-12 text-base font-mono" /></Field>
          <Field label={t("protocols.fuel_level", { percent: form.fuel_level })}>
            <div className="flex items-center gap-3 px-1">
              <Fuel className="w-4 h-4 text-zinc-500" />
              <Slider data-testid="mobile-fuel-slider" value={[form.fuel_level]} onValueChange={([v]) => setForm({ ...form, fuel_level: v })} min={0} max={100} step={5} className="flex-1" />
              <span className="font-mono text-sm w-10 text-right">{form.fuel_level}%</span>
            </div>
          </Field>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("protocols.extras_checklist")}</Label>
            <div className="grid grid-cols-1 gap-2 p-3 rounded-md bg-[#0A0A0A] border border-white/10">
              {form.extras.map((e, idx) => (
                <div key={e.name} className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <Checkbox checked={e.present} onCheckedChange={() => toggleExtra(idx)} className="border-white/30 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" />
                    <span className={`text-sm ${e.present ? "text-white" : "text-zinc-500 line-through"}`}>{e.name}</span>
                  </label>
                  <button type="button" onClick={() => removeExtra(idx)} className="text-zinc-500 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={form.newExtra} onChange={(e) => setForm({ ...form, newExtra: e.target.value })} placeholder={t("protocols.add_custom")} className="bg-[#0A0A0A] border-white/10 flex-1" />
              <Button type="button" onClick={addExtra} variant="secondary" className="bg-[#1A1A1A] border-white/10"><Plus className="w-4 h-4" /></Button>
            </div>
          </div>
          <Field label={t("protocols.signature")}>
            <SignaturePad onChange={(data) => setForm((f) => ({ ...f, signature_base64: data }))} testId="mobile-signature-pad" />
          </Field>
          <Button onClick={submit} data-testid="mobile-submit-btn" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base blue-glow border border-blue-500/50">
            <Check className="w-5 h-5 mr-2" /> {t("protocols.complete_handover")}
          </Button>
        </Card>
      </div>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</Label>
    {children}
  </div>
);
