import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { TYPE_META } from "./eventTypes";

export const ChipView = ({ e, showTime = true, className = "" }) => (
  <span className={`block truncate text-[10px] px-1.5 py-0.5 rounded-sm border ${TYPE_META[e.type].chip} ${TYPE_META[e.type].text} ${e.done ? "opacity-50 line-through" : ""} ${className}`}>
    {showTime && e.time ? `${e.time} ` : ""}{e.vehicle_label}
  </span>
);

export const EventChip = ({ e, showTime = true }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: e.id, data: { event: e }, disabled: e.auto || e.done });
  return (
    <span ref={setNodeRef} {...listeners} {...attributes} data-testid={`cal-chip-${e.id}`} className="block w-full">
      <ChipView e={e} showTime={showTime} className={`${e.auto || e.done ? "" : "cursor-grab active:cursor-grabbing"} ${isDragging ? "opacity-30" : ""}`} />
    </span>
  );
};
