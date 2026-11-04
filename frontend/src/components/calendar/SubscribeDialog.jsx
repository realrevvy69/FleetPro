import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api, API } from "../../lib/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Copy, RefreshCw, ExternalLink, Info } from "lucide-react";

const LinkBtn = ({ href, testId, children }) => (
  <a href={href} target="_blank" rel="noreferrer" data-testid={testId}
    className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-white/10 bg-[#0A0A0A] text-sm hover:border-blue-500/60 transition-colors">
    {children} <ExternalLink className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
  </a>
);

export const SubscribeDialog = ({ open, onOpenChange }) => {
  const { t } = useTranslation();
  const [token, setToken] = useState("");

  useEffect(() => {
    if (open) api.get("/calendar/feed-token").then((r) => setToken(r.data.token)).catch(() => toast.error(t("common.failed")));
  }, [open, t]);

  const url = token ? `${API}/calendar/feed/${token}.ics` : "";
  const webcal = url.replace(/^https?:/, "webcal:");

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success(t("calendar.copied")); }
    catch { toast.error(t("common.failed")); }
  };
  const reset = async () => {
    if (!window.confirm(t("calendar.reset_confirm"))) return;
    try { setToken((await api.post("/calendar/feed-token/reset")).data.token); toast.success(t("calendar.reset_done")); }
    catch { toast.error(t("common.failed")); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="calendar-subscribe-dialog" className="bg-[#141414] border-white/10 text-white w-[calc(100vw-2rem)] max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-heading">{t("calendar.subscribe_title")}</DialogTitle>
          <DialogDescription className="text-zinc-500">{t("calendar.subscribe_desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2 min-w-0">
            <Input readOnly value={url} data-testid="calendar-feed-url" className="bg-[#0A0A0A] border-white/10 font-mono text-xs min-w-0 flex-1" onFocus={(e) => e.target.select()} />
            <Button onClick={copy} disabled={!url} data-testid="calendar-feed-copy-btn" className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
              <Copy className="w-4 h-4 mr-1.5" /> {t("calendar.copy_link")}
            </Button>
          </div>
          {url && (
            <div className="grid gap-2">
              <LinkBtn href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} testId="calendar-feed-google">{t("calendar.add_google")}</LinkBtn>
              <LinkBtn href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=FleetPro`} testId="calendar-feed-outlook">{t("calendar.add_outlook")}</LinkBtn>
              <LinkBtn href={webcal} testId="calendar-feed-webcal">{t("calendar.add_apple")}</LinkBtn>
            </div>
          )}
          <p className="text-xs text-zinc-500 flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />{t("calendar.subscribe_hint")}</p>
          <Button variant="ghost" onClick={reset} data-testid="calendar-feed-reset-btn" className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 h-auto min-h-8 py-1.5 px-2 text-xs whitespace-normal text-left justify-start">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> {t("calendar.reset_link")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
