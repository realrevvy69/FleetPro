import React from "react";
import { Label } from "../../components/ui/label";

export const Row = ({ label, value }) => (
  <div className="flex justify-between border-b border-white/5 pb-2">
    <span className="text-zinc-500 text-[10px] uppercase tracking-[0.2em]">{label}</span>
    <span className="font-mono">{value}</span>
  </div>
);

export const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</Label>
    {children}
  </div>
);
