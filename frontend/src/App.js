import React, { useEffect, useState, useCallback } from "react";
import "@/App.css";
import { useTranslation } from "react-i18next";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { api } from "./lib/api";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Dashboard } from "./pages/Dashboard";
import { VehiclesTab } from "./pages/VehiclesTab";
import { MaintenanceTab } from "./pages/MaintenanceTab";
import { ProtocolsTab } from "./pages/ProtocolsTab";
import { DriversTab } from "./pages/DriversTab";
import MobileHandoverPage from "./pages/MobileHandoverPage";
import { PushButton } from "./components/PushButton";
import { SettingsMenu } from "./components/SettingsMenu";
import { ensureServiceWorker } from "./lib/push";
import { registerServiceWorker } from "./lib/sw";
import { Car, LayoutDashboard, Wrench, ClipboardSignature, Activity, Users } from "lucide-react";

const Shell = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState("dashboard");
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [stats, setStats] = useState({ total: 0, on_road: 0, damaged: 0, maintenance: 0, parked: 0 });
  const [alerts, setAlerts] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const [v, s, a, d] = await Promise.all([
        api.get("/vehicles"),
        api.get("/dashboard/stats"),
        api.get("/maintenance/alerts"),
        api.get("/drivers"),
      ]);
      setVehicles(v.data);
      setStats(s.data);
      setAlerts(a.data);
      setDrivers(d.data);
    } catch (e) {
      console.error(e);
      toast.error(t("common.failed"));
    }
  }, [t]);

  useEffect(() => { refresh(); registerServiceWorker().catch(() => {}); ensureServiceWorker().catch(() => {}); }, [refresh]);

  const dueAlerts = alerts.filter((a) => a.due);

  return (
    <div className="App min-h-screen bg-[#0A0A0A] text-white">
      <Toaster theme="dark" position="top-right" />

      <header className="border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3" data-testid="app-logo">
            <div className="w-9 h-9 rounded-md bg-blue-600 flex items-center justify-center blue-glow">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-heading font-bold text-xl tracking-tight leading-none">
                Fleet<span className="text-blue-500">Pro</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mt-0.5">
                Command Center
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-end">
            <div className="hidden md:flex items-center gap-2 text-xs font-mono text-zinc-400">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              {t("common.system_online")}
            </div>
            {dueAlerts.length > 0 && (
              <div data-testid="header-alerts-badge" className="flex items-center gap-2 px-3 py-1 rounded-sm bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono">
                <Wrench className="w-3 h-3" /> {dueAlerts.length} {t("common.due")}
              </div>
            )}
            <PushButton />
            <SettingsMenu />
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 md:px-8 py-8">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList data-testid="main-tabs" className="bg-transparent border-b border-white/10 rounded-none p-0 h-auto w-full justify-start gap-1 mb-8 overflow-x-auto">
            <TabTrigger value="dashboard" icon={LayoutDashboard} label={t("tabs.dashboard")} />
            <TabTrigger value="vehicles" icon={Car} label={t("tabs.vehicles")} />
            <TabTrigger value="maintenance" icon={Wrench} label={t("tabs.maintenance")} />
            <TabTrigger value="protocols" icon={ClipboardSignature} label={t("tabs.protocols")} />
            <TabTrigger value="drivers" icon={Users} label={t("tabs.drivers")} />
          </TabsList>

          <TabsContent value="dashboard" className="mt-0">
            <Dashboard stats={stats} vehicles={vehicles} alerts={alerts} onJump={(t) => setTab(t)} />
          </TabsContent>
          <TabsContent value="vehicles" className="mt-0">
            <VehiclesTab vehicles={vehicles} onChange={refresh} />
          </TabsContent>
          <TabsContent value="maintenance" className="mt-0">
            <MaintenanceTab vehicles={vehicles} alerts={alerts} onChange={refresh} />
          </TabsContent>
          <TabsContent value="protocols" className="mt-0">
            <ProtocolsTab vehicles={vehicles} drivers={drivers} onChange={refresh} />
          </TabsContent>
          <TabsContent value="drivers" className="mt-0">
            <DriversTab onChange={refresh} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-white/10 mt-16 py-6">
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 text-xs text-zinc-600 font-mono uppercase tracking-[0.2em] flex justify-between">
          <span>FleetPro v1.1</span>
          <span>{t("footer.tracked", { count: stats.total })}</span>
        </div>
      </footer>
    </div>
  );
};

const TabTrigger = ({ value, icon: Icon, label }) => (
  <TabsTrigger
    value={value}
    data-testid={`tab-${value}`}
    className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-blue-500 data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-4 py-3 text-zinc-500 hover:text-zinc-300 transition-colors font-medium whitespace-nowrap"
  >
    <Icon className="w-4 h-4 mr-2" />
    {label}
  </TabsTrigger>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/handover/:vehicleId" element={<MobileHandoverPage />} />
        <Route path="*" element={<Shell />} />
      </Routes>
    </BrowserRouter>
  );
}
