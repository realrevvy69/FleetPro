import React from "react";
import { useTranslation } from "react-i18next";
import { STATUS_META } from "../lib/format";

export const StatusBadge = ({ status, testId }) => {
  const { t } = useTranslation();
  const m = STATUS_META[status] || STATUS_META.parked;
  return (
    <span
      data-testid={testId || `status-badge-${status}`}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-mono uppercase tracking-wider border ${m.bg} ${m.color} ${m.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${m.color.replace("text-", "bg-")}`} />
      {t(`status.${status}`)}
    </span>
  );
};
