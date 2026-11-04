import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { api, API } from "../lib/api";
import { toast } from "sonner";
import { ClipboardSignature, History as HistoryIcon, Plus, X, Fuel, Check, RotateCcw, Download, FileText, Search, Trash2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { SignaturePad } from "../components/SignaturePad";
import { formatDate, formatNumber } from "../lib/format";
import { downloadCSV, generateProtocolPDF } from "../lib/exports";

export const ProtocolsTab = ({ vehicles, drivers, onChange, intent: initialIntent, onIntentDone }) => {
  const { t } = useTranslation();
  const [protocols, setProtocols] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [intent] = useState(initialIntent);
  const [sub, setSub] = useState(intent?.type === "return" ? "history" : "handover");

  const load = async () => {
    try { setProtocols((await api.get("/protocols")).data); setLoaded(true); }
    catch { toast.error(t("common.failed")); }
  };
  // eslint-disable-next-line
  useEffect(() => { load(); if (initialIntent) onIntentDone?.(); }, []);

  return (
    <Tabs value={sub} onValueChange={setSub} className="w-full">
      <TabsList className="bg-[#141414] border border-white/10 p-1 h-auto">
        <TabsTrigger value="handover" data-testid="proto-tab-handover" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-zinc-400 px-4 py-1.5 rounded-sm">
          <ClipboardSignature className="w-4 h-4 mr-2" /> {t("protocols.tab_handover")}
        </TabsTrigger>
        <TabsTrigger value="history" data-testid="proto-tab-history" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-zinc-400 px-4 py-1.5 rounded-sm">
          <HistoryIcon className="w-4 h-4 mr-2" /> {t("protocols.tab_history")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="handover" className="mt-6">
        <HandoverForm vehicles={vehicles} drivers={drivers} intent={intent?.type === "handover" ? intent : null} onSubmitted={() => { load(); onChange(); }} />
      </TabsContent>
      <TabsContent value="history" className="mt-6">
        <HistoryList protocols={protocols} vehicles={vehicles} loaded={loaded} intent={intent?.type === "return" ? intent : null} onChanged={() => { load(); onChange(); }} />
      </TabsContent>
    </Tabs>
  );
};

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

const HandoverForm = ({ vehicles, drivers, intent, onSubmitted }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => prefillForm(intent, drivers));
  const [linkedDamages, setLinkedDamages] = useState([]);
  const available = vehicles.filter((v) => v.status !== "on_road");

  useEffect(() => {
    if (intent && vehicles.find((v) => v.id === intent.vehicle_id)?.status === "on_road") toast.error(t("calendar.vehicle_on_road"));
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (form.vehicle_id) {
      const v = vehicles.find((x) => x.id === form.vehicle_id);
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
    // eslint-disable-next-line
  }, [form.vehicle_id]);

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
    if (!form.newExtra.trim()) return;
    setForm((f) => ({ ...f, extras: [...f.extras, { name: f.newExtra.trim(), present: true }], newExtra: "" }));
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
            {t("calendar.from_calendar", { date: new Date(`${form.calendar_date}T00:00`).toLocaleDateString() })}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-md bg-[#0A0A0A] border border-white/10">
            {form.extras.map((e, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 group">
                <label className="flex items-center gap-2 cursor-pointer flex-1" data-testid={`extra-${idx}`}>
                  <Checkbox checked={e.present} onCheckedChange={() => toggleExtra(idx)} className="border-white/30 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" />
                  <span className={`text-sm ${e.present ? "text-white" : "text-zinc-500 line-through"}`}>{e.name}</span>
                </label>
                <button type="button" onClick={() => removeExtra(idx)} data-testid={`remove-extra-${idx}`} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
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
        <SignaturePad onChange={(data) => setForm((f) => ({ ...f, signature_base64: data }))} testId="driver-signature-pad" />

        <div className="pt-3 border-t border-white/10">
          <h3 className="font-heading text-lg font-semibold">{t("protocols.signature_operator")}</h3>
          <p className="text-xs text-zinc-500 mt-1">{t("protocols.signature_hint")}</p>
        </div>
        <SignaturePad onChange={(data) => setForm((f) => ({ ...f, handover_signature_base64: data }))} testId="operator-signature-pad" />

        <Button onClick={submit} data-testid="handover-submit-btn" className="w-full bg-blue-600 hover:bg-blue-700 text-white blue-glow border border-blue-500/50 h-11">
          <Check className="w-4 h-4 mr-2" /> {t("protocols.complete_handover")}
        </Button>
        <p className="text-xs text-zinc-600 text-center">{t("protocols.handover_status_hint")}</p>
      </Card>
    </div>
  );
};

const HistoryList = ({ protocols, vehicles, loaded, intent, onChanged }) => {
  const { t } = useTranslation();
  const [returning, setReturning] = useState(null);
  const [retEventId, setRetEventId] = useState(null);
  const [retForm, setRetForm] = useState({ driver_name: "", fuel_level: 50, mileage: "", extras: [], signature_base64: "", handover_signature_base64: "", notes: "" });
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState("");
  const [pdfChoice, setPdfChoice] = useState(null); // protocol pending PDF lang choice
  const vMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));

  const filtered = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return protocols;
    return protocols.filter((p) => {
      const v = vMap[p.vehicle_id];
      if (!v) return false;
      return (
        v.license_plate.toLowerCase().includes(q) ||
        v.brand.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        (p.driver_name || "").toLowerCase().includes(q)
      );
    });
  })();

  const openReturn = (p, eventId = null) => {
    setReturning(p);
    setRetEventId(eventId);
    setRetForm({
      driver_name: p.driver_name,
      fuel_level: p.fuel_level,
      mileage: vMap[p.vehicle_id]?.mileage ?? p.mileage,
      extras: p.extras.map((e) => ({ ...e })),
      signature_base64: "",
      handover_signature_base64: "",
      notes: "",
    });
  };

  useEffect(() => {
    if (!intent || !loaded) return;
    const open = protocols.find((p) => p.vehicle_id === intent.vehicle_id && !p.returned);
    if (open) openReturn(open, intent.id);
    else toast.error(t("calendar.no_open_handover"));
    // eslint-disable-next-line
  }, [loaded]);

  const submitReturn = async () => {
    if (!retForm.signature_base64) return toast.error(t("protocols.validation_signature"));
    if (retForm.mileage === "" || retForm.mileage === null) return toast.error(t("protocols.validation_mileage"));
    try {
      await api.post("/protocols/return", {
        handover_id: returning.id,
        driver_name: retForm.driver_name,
        fuel_level: retForm.fuel_level,
        mileage: Number(retForm.mileage),
        extras: retForm.extras,
        signature_base64: retForm.signature_base64,
        handover_signature_base64: retForm.handover_signature_base64 || null,
        notes: retForm.notes || null,
        calendar_event_id: retEventId,
      });
      toast.success(t("protocols.returned_status"));
      setReturning(null);
      onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t("common.failed"));
    }
  };

  const toggleRetExtra = (idx) => setRetForm((f) => {
    const arr = [...f.extras]; arr[idx] = { ...arr[idx], present: !arr[idx].present };
    return { ...f, extras: arr };
  });

  const downloadPDF = async (p, lang) => {
    let returnP = null;
    if (p.return_protocol_id) {
      try { returnP = (await api.get(`/protocols/${p.return_protocol_id}`)).data; } catch {}
    }
    generateProtocolPDF(p, returnP, vMap[p.vehicle_id], lang);
  };

  return (
    <div data-testid="protocol-history" className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            data-testid="protocol-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("protocols.search_placeholder")}
            className="bg-[#0A0A0A] border-white/10 pl-9"
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => downloadCSV(API, "/exports/protocols.csv", "protocols.csv")}
          data-testid="protocols-export-csv-btn"
          className="bg-[#1A1A1A] hover:bg-[#252525] border border-white/10 text-white"
        >
          <Download className="w-4 h-4 mr-2" /> {t("protocols.export_csv")}
        </Button>
      </div>
      {protocols.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-lg p-12 text-center text-zinc-500 text-sm">
          {t("protocols.history_empty")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-lg p-12 text-center text-zinc-500 text-sm" data-testid="protocol-no-match">
          {t("protocols.no_match")}
        </div>
      ) : (
        <ProtocolGroups
          filtered={filtered}
          vMap={vMap}
          t={t}
          onPdf={(p) => setPdfChoice(p)}
          onView={(p) => setViewing(p)}
          onReturn={(p) => openReturn(p)}
          onDelete={async (p) => {
            if (!window.confirm(t("protocols.delete_confirm"))) return;
            try {
              await api.delete(`/protocols/${p.id}`);
              toast.success(t("protocols.deleted"));
              onChanged();
            } catch { toast.error(t("common.failed")); }
          }}
        />
      )}

      <Dialog open={!!returning} onOpenChange={(o) => !o && setReturning(null)}>
        <DialogContent className="bg-[#141414] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{t("protocols.return_title")}</DialogTitle>
            <DialogDescription className="text-zinc-500">{t("protocols.return_description")}</DialogDescription>
          </DialogHeader>
          {returning && (
            <div className="grid gap-4">
              <Field label={t("protocols.driver_name")}><Input data-testid="return-driver-input" value={retForm.driver_name} onChange={(e) => setRetForm({ ...retForm, driver_name: e.target.value })} className="bg-[#0A0A0A] border-white/10" /></Field>
              <Field label={t("protocols.return_mileage")}><Input data-testid="return-mileage-input" type="number" value={retForm.mileage} onChange={(e) => setRetForm({ ...retForm, mileage: e.target.value })} className="bg-[#0A0A0A] border-white/10 font-mono" /></Field>
              <Field label={t("protocols.fuel_level", { percent: retForm.fuel_level })}>
                <Slider data-testid="return-fuel-slider" value={[retForm.fuel_level]} onValueChange={([v]) => setRetForm({ ...retForm, fuel_level: v })} min={0} max={100} step={5} />
              </Field>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("protocols.extras_verification")}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-md bg-[#0A0A0A] border border-white/10">
                  {retForm.extras.map((e, idx) => (
                    <label key={idx} className="flex items-center gap-2 cursor-pointer" data-testid={`return-extra-${idx}`}>
                      <Checkbox checked={e.present} onCheckedChange={() => toggleRetExtra(idx)} className="border-white/30 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" />
                      <span className={`text-sm ${e.present ? "text-white" : "text-zinc-500 line-through"}`}>{e.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Field label={t("protocols.notes")}>
                <Textarea
                  data-testid="return-notes-input"
                  value={retForm.notes}
                  onChange={(e) => setRetForm({ ...retForm, notes: e.target.value })}
                  placeholder={t("protocols.notes_placeholder")}
                  className="bg-[#0A0A0A] border-white/10 min-h-[60px]"
                />
              </Field>
              <Field label={t("protocols.signature_driver")}>
                <SignaturePad onChange={(data) => setRetForm((f) => ({ ...f, signature_base64: data }))} testId="return-signature-pad" />
              </Field>
              <Field label={t("protocols.signature_operator")}>
                <SignaturePad onChange={(data) => setRetForm((f) => ({ ...f, handover_signature_base64: data }))} testId="return-operator-signature-pad" />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button onClick={submitReturn} data-testid="return-submit-btn" className="bg-blue-600 hover:bg-blue-700 text-white">{t("protocols.complete_return")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pdfChoice} onOpenChange={(o) => !o && setPdfChoice(null)}>
        <DialogContent className="bg-[#141414] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">{t("protocols.pdf_lang_title")}</DialogTitle>
            <DialogDescription className="text-zinc-500">{t("protocols.pdf_lang_description")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <Button
              data-testid="pdf-lang-en-btn"
              onClick={() => { downloadPDF(pdfChoice, "en"); setPdfChoice(null); }}
              className="bg-[#1A1A1A] hover:bg-blue-600 hover:text-white border border-white/10 text-white h-20 flex flex-col items-center justify-center gap-1"
            >
              <span className="text-2xl">🇬🇧</span>
              <span className="text-sm">{t("protocols.pdf_lang_en")}</span>
            </Button>
            <Button
              data-testid="pdf-lang-de-btn"
              onClick={() => { downloadPDF(pdfChoice, "de"); setPdfChoice(null); }}
              className="bg-[#1A1A1A] hover:bg-blue-600 hover:text-white border border-white/10 text-white h-20 flex flex-col items-center justify-center gap-1"
            >
              <span className="text-2xl">🇩🇪</span>
              <span className="text-sm">{t("protocols.pdf_lang_de")}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="bg-[#141414] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{t("protocols.view_protocol")}</DialogTitle>
            <DialogDescription className="text-zinc-500">{viewing && formatDate(viewing.created_at)}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <Row label={t("protocols.driver")} value={viewing.driver_name} />
              <Row label={t("protocols.vehicle")} value={vMap[viewing.vehicle_id] ? `${vMap[viewing.vehicle_id].brand} ${vMap[viewing.vehicle_id].model} · ${vMap[viewing.vehicle_id].license_plate}` : "—"} />
              <Row label={t("protocols.mileage")} value={`${formatNumber(viewing.mileage)} km`} />
              <Row label={t("protocols.fuel")} value={`${viewing.fuel_level}%`} />
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">{t("protocols.extras")}</div>
                <div className="flex flex-wrap gap-1.5">
                  {viewing.extras.map((e, i) => (
                    <span key={i} className={`px-2 py-0.5 text-xs rounded-sm border font-mono ${e.present ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-zinc-800/50 text-zinc-500 border-white/10 line-through"}`}>{e.name}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">{t("protocols.signature_driver")}</div>
                <img src={viewing.signature_base64} alt="driver-signature" className="w-full bg-[#0A0A0A] rounded-md border border-white/10" />
              </div>
              {viewing.handover_signature_base64 && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">{t("protocols.signature_operator")}</div>
                  <img src={viewing.handover_signature_base64} alt="operator-signature" className="w-full bg-[#0A0A0A] rounded-md border border-white/10" />
                </div>
              )}
              {viewing.notes && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">{t("protocols.notes")}</div>
                  <div className="bg-[#0A0A0A] border border-white/10 rounded-md p-3 text-sm text-zinc-200 whitespace-pre-wrap">{viewing.notes}</div>
                </div>
              )}
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

// ===== Year > Month accordion grouping =====

const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const groupByYearMonth = (protocols) => {
  const out = {};
  for (const p of protocols) {
    const d = new Date(p.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-11
    out[y] = out[y] || {};
    out[y][m] = out[y][m] || [];
    out[y][m].push(p);
  }
  return out;
};

const ProtocolGroups = ({ filtered, vMap, t, onPdf, onView, onReturn, onDelete }) => {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2);
  const monthName = (m) => {
    try {
      return new Date(2000, m, 1).toLocaleDateString(lang === "de" ? "de-DE" : "en-US", { month: "long" });
    } catch {
      return MONTH_KEYS[m];
    }
  };

  const groups = groupByYearMonth(filtered);
  const years = Object.keys(groups).map(Number).sort((a, b) => b - a);
  if (years.length === 0) return null;

  const defaultYear = String(years[0]);
  const defaultMonth = String(Math.max(...Object.keys(groups[years[0]]).map(Number)));
  const monthCount = (count) =>
    count === 1 ? t("protocols.count_protocols_one", { count }) : t("protocols.count_protocols_other", { count });

  return (
    <Accordion type="multiple" defaultValue={[`y-${defaultYear}`]} className="space-y-3" data-testid="protocols-accordion">
      {years.map((y) => {
        const months = Object.keys(groups[y]).map(Number).sort((a, b) => b - a);
        const yearTotal = months.reduce((sum, m) => sum + groups[y][m].length, 0);
        return (
          <AccordionItem
            key={y}
            value={`y-${y}`}
            className="border border-white/10 rounded-lg bg-[#141414] overflow-hidden"
            data-testid={`year-${y}`}
          >
            <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-white/[0.03] data-[state=open]:bg-white/[0.03] [&[data-state=open]>svg]:text-blue-400">
              <div className="flex items-center justify-between w-full pr-3">
                <div className="flex items-center gap-3">
                  <span className="font-heading text-lg font-semibold">{y}</span>
                  <span className="text-xs font-mono text-zinc-500">{monthCount(yearTotal)}</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <Accordion type="multiple" defaultValue={[`y-${y}-m-${defaultYear === String(y) ? defaultMonth : months[0]}`]} className="space-y-2">
                {months.map((m) => {
                  const items = groups[y][m];
                  return (
                    <AccordionItem
                      key={`${y}-${m}`}
                      value={`y-${y}-m-${m}`}
                      className="border border-white/10 rounded-md bg-[#0F0F0F] overflow-hidden"
                      data-testid={`year-${y}-month-${m}`}
                    >
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/[0.03] data-[state=open]:bg-white/[0.03] [&[data-state=open]>svg]:text-blue-400">
                        <div className="flex items-center justify-between w-full pr-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium capitalize">{monthName(m)}</span>
                            <span className="text-xs font-mono text-zinc-500">{monthCount(items.length)}</span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3 pt-1 space-y-2">
                        {items.map((p) => (
                          <ProtocolCard
                            key={p.id}
                            p={p}
                            v={vMap[p.vehicle_id]}
                            t={t}
                            onPdf={onPdf}
                            onView={onView}
                            onReturn={onReturn}
                            onDelete={onDelete}
                          />
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};

const ProtocolCard = ({ p, v, t, onPdf, onView, onReturn, onDelete }) => {
  const isReturned = p.returned;
  return (
    <Card
      data-testid={`protocol-card-${p.id}`}
      className={`rounded-lg border transition-all ${isReturned ? "bg-emerald-950/30 border-emerald-500/30" : "bg-[#141414] border-white/10 hover:border-white/30"}`}
    >
      <div className="p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <div className={`w-10 h-10 rounded-md flex items-center justify-center border shrink-0 ${isReturned ? "bg-emerald-500/15 border-emerald-500/30" : "bg-blue-500/10 border-blue-500/30"}`}>
            {isReturned ? <Check className="w-5 h-5 text-emerald-400" /> : <ClipboardSignature className="w-5 h-5 text-blue-400" />}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">
              {v ? `${v.brand} ${v.model}` : t("common.unknown")}
              <span className="text-xs font-mono text-zinc-500 ml-2">{v?.license_plate}</span>
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              {t("protocols.driver")}: <span className="text-zinc-300">{p.driver_name}</span> · {formatDate(p.created_at)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="text-right text-xs">
            <div className="font-mono text-zinc-300">{formatNumber(p.mileage)} km · {p.fuel_level}% {t("protocols.fuel")}</div>
            {isReturned && <div className="text-emerald-400 mt-0.5 font-mono uppercase tracking-wider">{t("protocols.returned_badge")}</div>}
          </div>
          <Button size="sm" variant="ghost" onClick={() => onPdf(p)} data-testid={`pdf-protocol-${p.id}`} className="text-zinc-400 hover:text-blue-400">
            <FileText className="w-3.5 h-3.5 mr-1.5" /> {t("protocols.download_pdf")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onView(p)} data-testid={`view-protocol-${p.id}`} className="text-zinc-400 hover:text-white">{t("common.view")}</Button>
          {!isReturned && (
            <Button size="sm" onClick={() => onReturn(p)} data-testid={`return-vehicle-${p.id}`} className="bg-blue-600 hover:bg-blue-700 text-white">
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> {t("protocols.process_return")}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onDelete(p)} data-testid={`delete-protocol-${p.id}`} className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

