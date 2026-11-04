import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Plus, X } from "lucide-react";

/**
 * Editable list of extra-item names (e.g. "Medkit", "Spare Tire").
 * Stores plain strings — used as a template per vehicle that seeds the handover checklist.
 */
export const ExtrasEditor = ({ value = [], onChange, testId = "extras-editor" }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (value.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...value, v]);
    setDraft("");
  };

  const remove = (idx) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div data-testid={testId} className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {value.length === 0 && (
          <span className="text-xs text-zinc-600 italic">—</span>
        )}
        {value.map((name, idx) => (
          <span
            key={name}
            data-testid={`extra-tag-${idx}`}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-mono border bg-blue-500/10 text-blue-300 border-blue-500/30"
          >
            {name}
            <button
              type="button"
              onClick={() => remove(idx)}
              data-testid={`extra-remove-${idx}`}
              className="text-blue-300/70 hover:text-red-400"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          data-testid={`${testId}-input`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={t("vehicles.extras_template_placeholder")}
          className="bg-[#0A0A0A] border-white/10 flex-1"
        />
        <Button
          type="button"
          onClick={add}
          variant="secondary"
          data-testid={`${testId}-add-btn`}
          className="bg-[#1A1A1A] hover:bg-[#252525] border border-white/10"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-[10px] text-zinc-600">{t("vehicles.extras_template_hint")}</p>
    </div>
  );
};
