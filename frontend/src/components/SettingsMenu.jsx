import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Settings, Check, Languages, Sun, Moon, RotateCw } from "lucide-react";
import { applyTheme, getStoredTheme } from "../lib/theme";
import { toast } from "sonner";

const LANGS = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
];

const THEMES = [
  { code: "dark", labelKey: "common.theme_dark", icon: Moon },
  { code: "light", labelKey: "common.theme_light", icon: Sun },
];

const resetAllCaches = async () => {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch (e) {
    console.warn("cache reset failed", e);
  }
};

export const SettingsMenu = () => {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState(getStoredTheme());

  const changeLang = (lng) => i18n.changeLanguage(lng);
  const changeTheme = (th) => { applyTheme(th); setTheme(th); };

  const doReset = async () => {
    toast.message(t("common.reset_cache_done"));
    await resetAllCaches();
    setTimeout(() => window.location.reload(true), 400);
  };

  const currentLang = (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="settings-menu-trigger"
        className="text-zinc-400 hover:text-white transition-colors p-2 rounded-md hover:bg-white/5 outline-none focus:ring-1 focus:ring-blue-500"
        title={t("common.settings")}
      >
        <Settings className="w-4 h-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-[#141414] border-white/10 text-white min-w-[220px]">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
          <Languages className="w-3 h-3" /> {t("common.language")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        {LANGS.map((l) => (
          <DropdownMenuItem
            key={l.code}
            data-testid={`lang-${l.code}`}
            onClick={() => changeLang(l.code)}
            className="cursor-pointer focus:bg-white/5 focus:text-white"
          >
            <span className="mr-2">{l.flag}</span>
            <span className="flex-1">{l.label}</span>
            {currentLang === l.code && <Check className="w-3.5 h-3.5 text-blue-400" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator className="bg-white/10 mt-1" />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
          <Sun className="w-3 h-3" /> {t("common.theme")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        {THEMES.map((th) => {
          const Icon = th.icon;
          return (
            <DropdownMenuItem
              key={th.code}
              data-testid={`theme-${th.code}`}
              onClick={() => changeTheme(th.code)}
              className="cursor-pointer focus:bg-white/5 focus:text-white"
            >
              <Icon className="w-3.5 h-3.5 mr-2" />
              <span className="flex-1">{t(th.labelKey)}</span>
              {theme === th.code && <Check className="w-3.5 h-3.5 text-blue-400" />}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator className="bg-white/10 mt-1" />
        <DropdownMenuItem
          onClick={doReset}
          data-testid="reset-cache-btn"
          className="cursor-pointer focus:bg-white/5 focus:text-white"
        >
          <RotateCw className="w-3.5 h-3.5 mr-2 text-amber-400" />
          <span className="flex-1">{t("common.reset_cache")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
