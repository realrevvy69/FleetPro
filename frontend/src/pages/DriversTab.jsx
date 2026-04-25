import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, User, Phone, Building2 } from "lucide-react";

const empty = { name: "", phone: "", company: "" };

export const DriversTab = ({ onChange }) => {
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    try { setDrivers((await api.get("/drivers")).data); }
    catch { toast.error(t("common.failed")); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (d) => { setEditing(d); setForm({ name: d.name, phone: d.phone || "", company: d.company || "" }); setOpen(true); };

  const submit = async () => {
    if (!form.name.trim()) return toast.error(t("drivers.validation_name"));
    try {
      if (editing) await api.put(`/drivers/${editing.id}`, form);
      else await api.post("/drivers", form);
      toast.success(editing ? t("drivers.updated") : t("drivers.added"));
      setOpen(false);
      load();
      onChange?.();
    } catch { toast.error(t("common.failed")); }
  };

  const remove = async (id) => {
    if (!window.confirm(t("drivers.deleteConfirm"))) return;
    await api.delete(`/drivers/${id}`);
    load();
    onChange?.();
  };

  return (
    <div data-testid="drivers-page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold">{t("drivers.title")}</h2>
          <p className="text-sm text-zinc-500 mt-1">{t("drivers.subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="add-driver-btn" className="bg-blue-600 hover:bg-blue-700 text-white blue-glow border border-blue-500/50">
              <Plus className="w-4 h-4 mr-2" /> {t("drivers.add")}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#141414] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="font-heading">{editing ? t("drivers.edit") : t("drivers.add")}</DialogTitle>
              <DialogDescription className="text-zinc-500">{t("drivers.subtitle")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <Field label={t("drivers.name")}><Input data-testid="driver-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-[#0A0A0A] border-white/10" placeholder={t("drivers.namePlaceholder")} /></Field>
              <Field label={t("drivers.phone")}><Input data-testid="driver-phone-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-[#0A0A0A] border-white/10" placeholder={t("drivers.phonePlaceholder")} /></Field>
              <Field label={t("drivers.company")}><Input data-testid="driver-company-input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="bg-[#0A0A0A] border-white/10" placeholder={t("drivers.companyPlaceholder")} /></Field>
            </div>
            <DialogFooter>
              <Button onClick={submit} data-testid="driver-submit-btn" className="bg-blue-600 hover:bg-blue-700 text-white">
                {editing ? t("common.save") : t("drivers.saveBtn")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {drivers.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-lg p-12 text-center text-zinc-500 text-sm">{t("drivers.empty")}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.map((d) => (
            <Card key={d.id} data-testid={`driver-card-${d.id}`} className="bg-[#141414] border-white/10 rounded-lg p-5 hover:border-white/30 transition-all group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600/15 border border-blue-500/30 flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="font-medium">{d.name}</div>
                    {d.company && <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1"><Building2 className="w-3 h-3" /> {d.company}</div>}
                  </div>
                </div>
              </div>
              {d.phone && (<div className="mt-4 text-xs text-zinc-400 flex items-center gap-1.5 font-mono"><Phone className="w-3 h-3" /> {d.phone}</div>)}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" onClick={() => openEdit(d)} data-testid={`driver-edit-${d.id}`} className="text-zinc-400 hover:text-white h-7">{t("common.edit")}</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(d.id)} data-testid={`driver-delete-${d.id}`} className="text-zinc-500 hover:text-red-400 h-7 px-2"><Trash2 className="w-3.5 h-3.5" /></Button>
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
