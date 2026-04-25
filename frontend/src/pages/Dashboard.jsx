import React from "react";
import { useTranslation } from "react-i18next";
import { Card } from "../components/ui/card";
import { Car, Activity, AlertTriangle, Wrench, ArrowRight, MapPin } from "lucide-react";
import { StatusBadge } from "../components/StatusBadge";
import { formatNumber } from "../lib/format";

const StatCard = ({ icon: Icon, label, value, accent, testId, onClick }) => (
  <button
    onClick={onClick}
    data-testid={testId}
    className="text-left bg-[#141414] border border-white/10 rounded-lg p-6 hover:border-white/30 hover:-translate-y-0.5 transition-all duration-200 group"
  >
    <div className="flex items-start justify-between">
      <div className={`w-10 h-10 rounded-md flex items-center justify-center ${accent.bg} ${accent.border} border`}>
        <Icon className={`w-5 h-5 ${accent.text}`} />
      </div>
      <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
    </div>
    <div className="mt-6">
      <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{label}</div>
      <div className="font-heading text-4xl font-bold mt-2 text-white">{value}</div>
    </div>
  </button>
);

export const Dashboard = ({ stats, vehicles, alerts, onJump }) => {
  const { t } = useTranslation();
  const dueAlerts = alerts.filter((a) => a.due);
  const onRoadVehicles = vehicles.filter((v) => v.status === "on_road");

  return (
    <div data-testid="dashboard-page" className="space-y-8">
      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-[#0e1830] via-[#0A0A0A] to-[#0A0A0A]">
        <div className="absolute inset-0 opacity-30 pointer-events-none"
          style={{ background: "radial-gradient(600px 200px at 80% 50%, rgba(37,99,235,0.25), transparent)" }} />
        <div className="relative p-8 md:p-10">
          <div className="text-xs uppercase tracking-[0.3em] text-blue-400 font-mono">{t("dashboard.section")}</div>
          <h1 className="font-heading text-4xl md:text-5xl font-bold mt-3 tracking-tight">
            {t("dashboard.welcome")} <span className="text-blue-500">{t("common.operator")}</span>
          </h1>
          <p className="text-zinc-400 mt-3 max-w-xl">{t("dashboard.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard icon={Car} label={t("dashboard.total")} value={stats.total} accent={{ bg: "bg-white/5", border: "border-white/10", text: "text-white" }} testId="stat-total" onClick={() => onJump("vehicles")} />
        <StatCard icon={Activity} label={t("dashboard.on_road")} value={stats.on_road} accent={{ bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400" }} testId="stat-on-road" onClick={() => onJump("vehicles")} />
        <StatCard icon={AlertTriangle} label={t("dashboard.damaged")} value={stats.damaged} accent={{ bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400" }} testId="stat-damaged" onClick={() => onJump("vehicles")} />
        <StatCard icon={Wrench} label={t("dashboard.maintenance_due")} value={dueAlerts.length} accent={{ bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400" }} testId="stat-maintenance" onClick={() => onJump("maintenance")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#141414] border-white/10 rounded-lg">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{t("dashboard.live")}</div>
              <h3 className="font-heading text-xl font-semibold mt-1">{t("dashboard.vehicles_on_road")}</h3>
            </div>
            <MapPin className="w-5 h-5 text-blue-400" />
          </div>
          <div className="p-2">
            {onRoadVehicles.length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-500">{t("dashboard.no_dispatched")}</div>
            ) : (
              <ul className="divide-y divide-white/5">
                {onRoadVehicles.map((v) => (
                  <li key={v.id} data-testid={`onroad-item-${v.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] rounded-md">
                    <div>
                      <div className="font-medium">{v.brand} {v.model}</div>
                      <div className="text-xs font-mono text-zinc-500 mt-0.5">{v.license_plate}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-zinc-400">{formatNumber(v.mileage)} km</span>
                      <StatusBadge status={v.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="bg-[#141414] border-white/10 rounded-lg">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{t("dashboard.alerts")}</div>
              <h3 className="font-heading text-xl font-semibold mt-1">{t("dashboard.maintenance_notifications")}</h3>
            </div>
            <Wrench className="w-5 h-5 text-amber-400" />
          </div>
          <div className="p-2">
            {alerts.length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-500">{t("dashboard.no_schedules")}</div>
            ) : (
              <ul className="divide-y divide-white/5">
                {alerts.slice(0, 6).map((a) => (
                  <li key={a.schedule_id} className="flex items-center justify-between px-4 py-3" data-testid={`alert-${a.schedule_id}`}>
                    <div>
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{a.vehicle_label}</div>
                    </div>
                    <div className={`text-xs font-mono ${a.due ? "text-amber-400" : "text-zinc-500"}`}>{a.detail}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
