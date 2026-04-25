import React from "react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Settings, Check, Languages } from "lucide-react";

const LANGS = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
];

export const SettingsMenu = () => {
  const { t, i18n } = useTranslation();
  const change = (lng) => {
    i18n.changeLanguage(lng);
  };
  const current = (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="settings-menu-trigger"
        className="text-zinc-400 hover:text-white transition-colors p-2 rounded-md hover:bg-white/5 outline-none focus:ring-1 focus:ring-blue-500"
        title={t("common.settings")}
      >
        <Settings className="w-4 h-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-[#141414] border-white/10 text-white min-w-[200px]">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
          <Languages className="w-3 h-3" /> {t("common.language")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        {LANGS.map((l) => (
          <DropdownMenuItem
            key={l.code}
            data-testid={`lang-${l.code}`}
            onClick={() => change(l.code)}
            className="cursor-pointer focus:bg-white/5 focus:text-white"
          >
            <span className="mr-2">{l.flag}</span>
            <span className="flex-1">{l.label}</span>
            {current === l.code && <Check className="w-3.5 h-3.5 text-blue-400" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
