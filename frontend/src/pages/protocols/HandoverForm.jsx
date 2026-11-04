import React, { useEffect, useRef, useState } from "react";
import { useLatest } from "../../lib/hooks";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Slider } from "../../components/ui/slider";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Plus, X, Fuel, Check } from "lucide-react";
import { SignaturePad } from "../../components/SignaturePad";
import { Field } from "./shared";

const initialForm = () => ({
  vehicle_id: "",
  driver_id: "",
  driver_name: "",
  fuel_level: 50,
  mileage: "",
  extras: [],
  newExtra: "",
  signature_base64: "",
  handover_signature_base64: "",
  notes: "",
  calendar_event_id: null,
});

const prefillForm = (intent, drivers) => {
  const f = initialForm();
  if (!intent) return f;
  const name = intent.driver_name || "";
  const d = drivers.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return {
    ...f,
    vehicle_id: intent.vehicle_id,
    driver_id: d ? d.id : (name ? "__custom__" : ""),
    driver_name: d ? d.name : name,
    notes: intent.notes || "",
    calendar_event_id: intent.id,
    calendar_date: intent.date,
  };
};

export const HandoverForm = ({ vehicles, drivers, intent, onSubmitted }) => {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState(() => prefillForm(intent, drivers));
  const [linkedDamages, setLinkedDamages] = useState([]);
  const [padKey, setPadKey] = useState(0);
  const available = vehicles.filter((v) => v.status !== "on_road");
  const vehiclesRef = useLatest(vehicles);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!intent || warnedRef.current) return;
    warnedRef.current = true;
    if (vehiclesRef.current.find((v) => v.id === intent.vehicle_id)?.status === "on_road") toast.error(t("calendar.vehicle_on_road"), { id: "proto-intent" });
  }, [intent, vehiclesRef, t]);

  useEffect(() => {
    if (form.vehicle_id) {
      const v = vehiclesRef.current.find((x) => x.id === form.vehicle_id);
      if (v) {
        setForm((f) => ({
          ...f,
          mileage: f.mileage === "" ? v.mileage : f.mileage,
          extras: (v.extras || []).map((name) => ({ name, present: true })),
        }));
      }
      api.get(`/damages?vehicle_id=${form.vehicle_id}`)
        .then((r) => setLinkedDamages(r.data))
        .catch(() => setLinkedDamages([]));
    } else {
      setForm((f) => ({ ...f, extras: [] }));
      setLinkedDamages([]);
    }
  }, [form.vehicle_id, vehiclesRef]);

  const onDriverChange = (id) => {
    if (id === "__custom__") {
      setForm((f) => ({ ...f, driver_id: "__custom__", driver_name: "" }));
    } else {
      const d = drivers.find((x) => x.id === id);
      setForm((f) => ({ ...f, driver_id: id, driver_name: d ? d.name : "" }));
    }
  };

  const toggleExtra = (idx) => setForm((f) => {
    const arr = [...f.extras]; arr[idx] = { ...arr[idx], present: !arr[idx].present };
    return { ...f, extras: arr };
  });
  const removeExtra = (idx) => setForm((f) => ({ ...f, extras: f.extras.filter((_, i) => i !== idx) }));
  const addExtra = () => {
    const name = form.newExtra.trim();
    if (!name) return;
    setForm((f) => ({ ...f, extras: f.extras.some((e) => e.name === name) ? f.extras : [...f.extras, { name, present: true }], newExtra: "" }));
  };

  const submit = async () => {
    if (!form.vehicle_id) return toast.error(t("protocols.validation_select_vehicle"));
    if (!form.driver_name.trim()) return toast.error(t("protocols.validation_driver"));
    if (form.mileage === "" || form.mileage === null) return toast.error(t("protocols.validation_mileage"));
    if (!form.signature_base64) return toast.error(t("protocols.validation_signature"));
    try {
      await api.post("/protocols/handover", {
        vehicle_id: form.vehicle_id,
        driver_name: form.driver_name,
        fuel_level: form.fuel_level,
        mileage: Number(form.mileage),
        extras: form.extras.map(({ name, present }) => ({ name, present })),
        signature_base64: form.signature_base64,
        handover_signature_base64: form.handover_signature_base64 || null,
        notes: form.notes || null,
        calendar_event_id: form.calendar_event_id || null,
      });
      toast.success(t("protocols.handover_completed"));
      setForm(initialForm());
      setPadKey((k) => k + 1);
      onSubmitted();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("common.failed"));
    }
  };

  return (
    <div data-testid="handover-form" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="bg-[#141414] border-white/10 rounded-lg p-6 lg:col-span-2 space-y-5">
        <div>
          <h2 className="font-heading text-2xl font-semibold">{t("protocols.new_handover")}</h2>
          <p className="text-sm text-zinc-500 mt-1">{t("protocols.subtitle")}</p>
        </div>
        {form.calendar_event_id && (
          <div data-testid="handover-from-calendar" className="rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-400">
            {t("calendar.from_calendar", { date: new Date(`${form.calendar_date}T00:00`).toLocaleDateString(i18n.language) })}
          </div>
        )}

        <Field label={t("protocols.vehicle")}>
          <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v, mileage: "" })}>
            <SelectTrigger data-testid="handover-vehicle-select" className="bg-[#0A0A0A] border-white/10">
              <SelectValue placeholder={t("protocols.selectVehicle")} />
            </SelectTrigger>
            <SelectContent className="bg-[#141414] border-white/10 text-white">
              {available.length === 0 ? (
                <div className="px-3 py-2 text-sm text-zinc-500">{t("protocols.no_available")}</div>
              ) : available.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} · {v.license_plate}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t("protocols.driver")}>
            <Select value={form.driver_id} onValueChange={onDriverChange}>
              <SelectTrigger data-testid="handover-driver-select" className="bg-[#0A0A0A] border-white/10">
                <SelectValue placeholder={t("protocols.driver_placeholder")} />
              </SelectTrigger>
              <SelectContent className="bg-[#141414] border-white/10 text-white">
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}{d.company ? ` · ${d.company}` : ""}</SelectItem>
                ))}
                <SelectItem value="__custom__">{t("protocols.type_name")}</SelectItem>
              </SelectContent>
            </Select>
            {(form.driver_id === "__custom__" || (!form.driver_id && form.driver_name)) && (
              <Input
                data-testid="handover-driver-input"
                value={form.driver_name}
                onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
                className="bg-[#0A0A0A] border-white/10 mt-2"
                placeholder={t("protocols.driver_name")}
              />
            )}
          </Field>
          <Field label={t("protocols.mileage")}>
            <Input data-testid="handover-mileage-input" type="number" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} className="bg-[#0A0A0A] border-white/10 font-mono" />
          </Field>
        </div>

        <Field label={t("protocols.fuel_level", { percent: form.fuel_level })}>
          <div className="flex items-center gap-3 px-1">
            <Fuel className="w-4 h-4 text-zinc-500" />
            <Slider data-testid="handover-fuel-slider" value={[form.fuel_level]} onValueChange={([v]) => setForm({ ...form, fuel_level: v })} min={0} max={100} step={5} className="flex-1" />
            <span className="font-mono text-sm w-10 text-right">{form.fuel_level}%</span>
          </div>
        </Field>

        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("protocols.extras_checklist")}</Label>
          {form.extras.length > 0 && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-md bg-[#0A0A0A] border border-white/10">
            {form.extras.map((e, idx) => (
              <div key={e.name} className="flex items-center justify-between gap-2 group">
                <label className="flex items-center gap-2 cursor-pointer flex-1" data-testid={`extra-${idx}`}>
                  <Checkbox checked={e.present} onCheckedChange={() => toggleExtra(idx)} className="border-white/30 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" />
                  <span className={`text-sm ${e.present ? "text-white" : "text-zinc-500 line-through"}`}>{e.name}</span>
                </label>
                <button type="button" onClick={() => removeExtra(idx)} data-testid={`remove-extra-${idx}`} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>}
          <div className="flex gap-2">
            <Input data-testid="new-extra-input" value={form.newExtra} onChange={(e) => setForm({ ...form, newExtra: e.target.value })} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExtra())} placeholder={t("protocols.add_custom")} className="bg-[#0A0A0A] border-white/10 flex-1" />
            <Button type="button" onClick={addExtra} variant="secondary" data-testid="add-extra-btn" className="bg-[#1A1A1A] hover:bg-[#252525] border border-white/10">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {form.vehicle_id && (
          <div className="space-y-2" data-testid="handover-linked-damages">
            <Label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("protocols.linked_damages")}</Label>
            <div className="p-3 rounded-md bg-[#0A0A0A] border border-white/10 max-h-44 overflow-y-auto">
              {linkedDamages.length === 0 ? (
                <div className="text-xs text-zinc-500 italic">{t("protocols.no_linked_damages")}</div>
              ) : (
                <ul className="space-y-2">
                  {linkedDamages.map((d) => (
                    <li key={d.id} data-testid={`linked-damage-${d.id}`} className="flex items-start gap-3">
                      {d.photo_base64 ? (
                        <img src={d.photo_base64} alt="damage" className="w-12 h-12 object-cover rounded-sm border border-white/10 shrink-0" />
                      ) : (
                        <div className="w-12 h-12 bg-white/5 rounded-sm border border-white/10 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm line-clamp-2">{d.description}</div>
                        <span className={`mt-1 inline-block px-1.5 py-0.5 rounded-sm text-[9px] font-mono uppercase tracking-wider border ${
                          d.tolerated
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-red-500/10 text-red-400 border-red-500/30"
                        }`}>
                          {d.tolerated ? t("damages.tolerated") : t("damages.not_tolerated")}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <Field label={t("protocols.notes")}>
          <Textarea
            data-testid="handover-notes-input"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder={t("protocols.notes_placeholder")}
            className="bg-[#0A0A0A] border-white/10 min-h-[70px]"
          />
        </Field>
      </Card>

      <Card className="bg-[#141414] border-white/10 rounded-lg p-6 space-y-5">
        <div>
          <h3 className="font-heading text-lg font-semibold">{t("protocols.signature_driver")}</h3>
          <p className="text-xs text-zinc-500 mt-1">{t("protocols.signature_hint")}</p>
        </div>
        <SignaturePad key={`driver-${padKey}`} onChange={(data) => setForm((f) => ({ ...f, signature_base64: data }))} testId="driver-signature-pad" />

        <div className="pt-3 border-t border-white/10">
          <h3 className="font-heading text-lg font-semibold">{t("protocols.signature_operator")}</h3>
          <p className="text-xs text-zinc-500 mt-1">{t("protocols.signature_hint")}</p>
        </div>
        <SignaturePad key={`operator-${padKey}`} onChange={(data) => setForm((f) => ({ ...f, handover_signature_base64: data }))} testId="operator-signature-pad" />

        <Button onClick={submit} data-testid="handover-submit-btn" className="w-full bg-blue-600 hover:bg-blue-700 text-white blue-glow border border-blue-500/50 h-11">
          <Check className="w-4 h-4 mr-2" /> {t("protocols.complete_handover")}
        </Button>
        <p className="text-xs text-zinc-600 text-center">{t("protocols.handover_status_hint")}</p>
      </Card>
    </div>
  );
};
