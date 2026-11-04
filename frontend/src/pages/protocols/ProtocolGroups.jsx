import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ClipboardSignature, Check, RotateCcw, FileText, Trash2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import { formatDate, formatNumber } from "../../lib/format";

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

export const ProtocolGroups = ({ filtered, vMap, t, onPdf, onView, onReturn, onDelete }) => {
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
