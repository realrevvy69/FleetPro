import React, { useEffect, useRef, useState } from "react";
import { useLatest } from "../../lib/hooks";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../../components/ui/dialog";
import { Slider } from "../../components/ui/slider";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { api, API } from "../../lib/api";
import { toast } from "sonner";
import { Download, Search } from "lucide-react";
import { SignaturePad } from "../../components/SignaturePad";
import { formatDate, formatNumber } from "../../lib/format";
import { downloadCSV, generateProtocolPDF } from "../../lib/exports";
import { Row, Field } from "./shared";
import { ProtocolGroups } from "./ProtocolGroups";

export const HistoryList = ({ protocols, vehicles, loaded, intent, onChanged }) => {
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

  const openReturnRef = useLatest(openReturn);
  const intentHandledRef = useRef(false);

  useEffect(() => {
    if (!intent || !loaded || intentHandledRef.current) return;
    intentHandledRef.current = true;
    const open = protocols.find((p) => p.vehicle_id === intent.vehicle_id && !p.returned);
    if (open) openReturnRef.current(open, intent.id);
    else toast.error(t("calendar.no_open_handover"), { id: "proto-intent" });
  }, [intent, loaded, protocols, openReturnRef, t]);

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
          {retEventId && (
            <div data-testid="return-from-calendar" className="rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-400">
              {t("calendar.return_from_calendar")}
            </div>
          )}
          {returning && (
            <div className="grid gap-4">
              <Field label={t("protocols.driver_name")}><Input data-testid="return-driver-input" value={retForm.driver_name} onChange={(e) => setRetForm({ ...retForm, driver_name: e.target.value })} className="bg-[#0A0A0A] border-white/10" /></Field>
              <Field label={t("protocols.return_mileage")}><Input data-testid="return-mileage-input" type="number" value={retForm.mileage} onChange={(e) => setRetForm({ ...retForm, mileage: e.target.value })} className="bg-[#0A0A0A] border-white/10 font-mono" /></Field>
              <Field label={t("protocols.fuel_level", { percent: retForm.fuel_level })}>
                <Slider data-testid="return-fuel-slider" value={[retForm.fuel_level]} onValueChange={([v]) => setRetForm({ ...retForm, fuel_level: v })} min={0} max={100} step={5} />
              </Field>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("protocols.extras_verification")}</Label>
                {retForm.extras.length > 0 && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-md bg-[#0A0A0A] border border-white/10">
                  {retForm.extras.map((e, idx) => (
                    <label key={e.name} className="flex items-center gap-2 cursor-pointer" data-testid={`return-extra-${idx}`}>
                      <Checkbox checked={e.present} onCheckedChange={() => toggleRetExtra(idx)} className="border-white/30 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" />
                      <span className={`text-sm ${e.present ? "text-white" : "text-zinc-500 line-through"}`}>{e.name}</span>
                    </label>
                  ))}
                </div>}
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
                  {viewing.extras.map((e) => (
                    <span key={e.name} className={`px-2 py-0.5 text-xs rounded-sm border font-mono ${e.present ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-zinc-800/50 text-zinc-500 border-white/10 line-through"}`}>{e.name}</span>
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
