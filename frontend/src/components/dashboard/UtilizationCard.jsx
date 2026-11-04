import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { addMonths, format, isSameMonth, startOfMonth } from "date-fns";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { BarChart3, ChevronLeft, ChevronRight, MoonStar } from "lucide-react";
import { api } from "../../lib/api";
import { dateLocale } from "../calendar/eventTypes";

const useUtilization = (month) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    api.get("/dashboard/utilization", { params: { month: format(month, "yyyy-MM") } })
      .then((r) => live && setData(r.data))
      .catch(() => live && setData(null));
    return () => { live = false; };
  }, [month]);
  return data;
};

const DayStrip = ({ data, row }) => {
  const booked = new Set(row.days);
  const cells = Array.from({ length: data.days_in_month }, (_, i) => i + 1);
  return (
    <div className="grid gap-[2px] flex-1 min-w-0" style={{ gridTemplateColumns: `repeat(${data.days_in_month}, minmax(0, 1fr))` }}>
      {cells.map((d) => {
        const key = `${data.month}-${String(d).padStart(2, "0")}`;
        const future = d > data.period_days;
        const on = booked.has(key);
        return <span key={key} title={key} className={`h-4 rounded-[2px] ${on ? "bg-blue-500" : future ? "bg-white/[0.02]" : "bg-white/10"}`} />;
      })}
    </div>
  );
};

const UtilRow = ({ data, row, t }) => (
  <li data-testid={`util-row-${row.vehicle_id}`} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
    <div className="md:w-56 shrink-0 min-w-0">
      <div className="text-sm font-medium truncate">{row.vehicle_label}</div>
      {row.idle && (
        <span data-testid={`util-idle-${row.vehicle_id}`} className="inline-flex items-center gap-1 mt-1 text-[10px] uppercase tracking-wider text-amber-400">
          <MoonStar className="w-3 h-3" /> {t("dashboard.util_idle")}
        </span>
      )}
    </div>
    <DayStrip data={data} row={row} />
    <div className="md:w-28 shrink-0 flex md:flex-col md:items-end justify-between text-xs font-mono">
      <span data-testid={`util-percent-${row.vehicle_id}`} className={row.idle ? "text-amber-400" : "text-blue-400"}>{row.percent} %</span>
      <span className="text-zinc-500">{t("dashboard.util_days", { booked: row.booked_days, period: data.period_days })}</span>
    </div>
  </li>
);

export const UtilizationCard = () => {
  const { t, i18n } = useTranslation();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const data = useUtilization(month);
  const atCurrent = isSameMonth(month, new Date());

  return (
    <Card data-testid="utilization-card" className="bg-[#141414] border-white/10 rounded-lg">
      <div className="p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{t("dashboard.util_section")}</div>
          <h3 className="font-heading text-xl font-semibold mt-1 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-400" />{t("dashboard.util_title")}</h3>
          {data && (
            <div className="text-xs text-zinc-400 mt-1" data-testid="util-summary">
              {t("dashboard.util_summary", { avg: data.average, idle: data.idle_count, threshold: data.idle_threshold })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, -1))} data-testid="util-prev-month" className="bg-transparent border-white/10 h-9 w-9"><ChevronLeft className="w-4 h-4" /></Button>
          <div data-testid="util-month-label" className="font-heading font-semibold min-w-[130px] text-center capitalize text-sm">{format(month, "LLLL yyyy", { locale: dateLocale(i18n.language) })}</div>
          <Button variant="outline" size="icon" disabled={atCurrent} onClick={() => setMonth((m) => addMonths(m, 1))} data-testid="util-next-month" className="bg-transparent border-white/10 h-9 w-9"><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>
      <div className="p-2">
        {!data || data.vehicles.length === 0 ? (
          <div data-testid="util-empty" className="p-6 text-center text-sm text-zinc-500">{t("dashboard.util_empty")}</div>
        ) : (
          <ul className="divide-y divide-white/5">{data.vehicles.map((r) => <UtilRow key={r.vehicle_id} data={data} row={r} t={t} />)}</ul>
        )}
        <p className="px-4 pb-3 pt-1 text-[11px] text-zinc-500">{t("dashboard.util_hint")}</p>
      </div>
    </Card>
  );
};
