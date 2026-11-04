import React, { useCallback, useEffect, useState } from "react";
import { useLatest } from "../lib/hooks";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { api } from "../lib/api";
import { toast } from "sonner";
import { ClipboardSignature, History as HistoryIcon } from "lucide-react";
import { HandoverForm } from "./protocols/HandoverForm";
import { HistoryList } from "./protocols/HistoryList";

export const ProtocolsTab = ({ vehicles, drivers, onChange, intent: initialIntent, onIntentDone }) => {
  const { t } = useTranslation();
  const [protocols, setProtocols] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [intent] = useState(initialIntent);
  const [sub, setSub] = useState(intent?.type === "return" ? "history" : "handover");
  const intentDoneRef = useLatest(onIntentDone);

  const load = useCallback(async () => {
    try { setProtocols((await api.get("/protocols")).data); setLoaded(true); }
    catch { toast.error(t("common.failed")); }
  }, [t]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (intent) intentDoneRef.current?.(); }, [intent, intentDoneRef]);

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
