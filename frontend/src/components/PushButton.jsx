import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { Bell, BellOff } from "lucide-react";
import { isPushSupported, getPushPermission, enablePush, disablePush } from "../lib/push";
import { toast } from "sonner";

export const PushButton = () => {
  const { t } = useTranslation();
  const [supported] = useState(isPushSupported());
  const [permission, setPermission] = useState(getPushPermission());
  const [busy, setBusy] = useState(false);

  useEffect(() => { setPermission(getPushPermission()); }, []);

  if (!supported) return null;

  const enabled = permission === "granted";

  const toggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        toast.success(t("push.disabled"));
        setPermission("default");
      } else {
        await enablePush();
        toast.success(t("push.enabled"));
        setPermission("granted");
      }
    } catch (e) {
      toast.error(e.message || t("push.denied"));
    } finally { setBusy(false); }
  };

  return (
    <Button
      type="button"
      onClick={toggle}
      disabled={busy}
      data-testid="push-toggle-btn"
      variant="ghost"
      size="sm"
      className={`${enabled ? "text-blue-400" : "text-zinc-500"} hover:text-white text-xs font-mono uppercase tracking-wider`}
    >
      {enabled ? <Bell className="w-3.5 h-3.5 mr-1.5" /> : <BellOff className="w-3.5 h-3.5 mr-1.5" />}
      {enabled ? t("push.on") : t("push.off")}
    </Button>
  );
};
