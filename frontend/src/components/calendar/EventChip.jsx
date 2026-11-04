import React from "react";
import { TYPE_META } from "./eventTypes";

export const EventChip = ({ e, showTime = true }) => (
  <span
    data-testid={`cal-chip-${e.id}`}
    className={`truncate text-[10px] px-1.5 py-0.5 rounded-sm border ${TYPE_META[e.type].chip} ${TYPE_META[e.type].text} ${e.done ? "opacity-50 line-through" : ""}`}
  >
    {showTime && e.time ? `${e.time} ` : ""}{e.vehicle_label}
  </span>
);
