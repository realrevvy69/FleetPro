import React from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Printer, QrCode } from "lucide-react";
import { toast } from "sonner";

const PRINT_CSS = `
  body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .plate { font-family: monospace; font-size: 16px; color: #555; margin-bottom: 16px; }
  .qr { display: inline-block; padding: 16px; border: 2px solid #000; border-radius: 8px; }
  .footer { margin-top: 16px; font-size: 11px; color: #555; }
`;

// Builds the print page with DOM APIs only (textContent), so vehicle data can never inject markup.
const printQr = (vehicle, svg, hint) => {
  const w = window.open("", "_blank");
  if (!w || !svg) return false;
  const doc = w.document;
  doc.title = `${vehicle.brand} ${vehicle.model} – ${vehicle.license_plate}`;
  const style = doc.createElement("style");
  style.textContent = PRINT_CSS;
  doc.head.appendChild(style);
  const add = (tag, cls, text) => {
    const el = doc.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    doc.body.appendChild(el);
    return el;
  };
  add("h1", "", `${vehicle.brand} ${vehicle.model}`);
  add("div", "plate", vehicle.license_plate);
  add("div", "qr").appendChild(doc.importNode(svg, true));
  add("div", "footer", hint);
  w.focus();
  setTimeout(() => w.print(), 100);
  return true;
};

export const VehicleQRModal = ({ vehicle, open, onOpenChange }) => {
  const { t } = useTranslation();
  if (!vehicle) return null;
  const url = `${window.location.origin}/handover/${vehicle.id}`;
  const print = () => {
    if (!printQr(vehicle, document.getElementById(`qr-svg-${vehicle.id}`), t("qr.scan_hint"))) toast.error(t("qr.popup_blocked"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141414] border-white/10 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-400" /> {t("qr.title")}
          </DialogTitle>
          <DialogDescription className="text-zinc-500">{t("qr.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="bg-white p-4 rounded-md" data-testid={`qr-${vehicle.id}`}>
            <QRCodeSVG id={`qr-svg-${vehicle.id}`} value={url} size={220} level="M" fgColor="#000000" bgColor="#FFFFFF" />
          </div>
          <div className="text-center">
            <div className="font-medium">{vehicle.brand} {vehicle.model}</div>
            <div className="font-mono text-blue-400 text-sm">{vehicle.license_plate}</div>
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 break-all text-center">{url}</div>
          <Button onClick={print} data-testid="qr-print-btn" className="bg-blue-600 hover:bg-blue-700 text-white w-full">
            <Printer className="w-4 h-4 mr-2" /> {t("qr.print")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
