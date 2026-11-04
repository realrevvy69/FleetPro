import React, { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Eraser } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLatest } from "../lib/hooks";

const isLight = () => document.documentElement.classList.contains("light");

const paintBackground = (canvas) => {
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  ctx.fillStyle = isLight() ? "#FFFFFF" : "#0A0A0A";
  ctx.fillRect(0, 0, rect.width, rect.height);
};

const setupCanvas = (canvas) => {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  paintBackground(canvas);
  ctx.strokeStyle = isLight() ? "#18181B" : "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
};

const drawStrokes = (canvas, strokes) => {
  const ctx = canvas.getContext("2d");
  strokes.forEach((pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.stroke();
  });
};

const pointerPos = (canvas, e) => {
  const rect = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return { x: src.clientX - rect.left, y: src.clientY - rect.top };
};

// Repaints the canvas (keeping strokes) whenever the light/dark class on <html> flips.
const useThemeRepaint = (canvasRef, strokesRef, onChangeRef) => {
  useEffect(() => {
    let light = isLight();
    const observer = new MutationObserver(() => {
      const canvas = canvasRef.current;
      if (!canvas || isLight() === light) return;
      light = isLight();
      setupCanvas(canvas);
      drawStrokes(canvas, strokesRef.current);
      if (strokesRef.current.length) onChangeRef.current?.(canvas.toDataURL("image/png"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [canvasRef, strokesRef, onChangeRef]);
};

const useSignatureCanvas = (onChange) => {
  const canvasRef = React.useRef(null);
  const strokesRef = React.useRef([]);
  const onChangeRef = useLatest(onChange);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => { if (canvasRef.current) setupCanvas(canvasRef.current); }, []);
  useThemeRepaint(canvasRef, strokesRef, onChangeRef);

  const start = (e) => {
    e.preventDefault();
    const pos = pointerPos(canvasRef.current, e);
    strokesRef.current.push([pos]);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setDrawing(true);
  };
  const move = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const pos = pointerPos(canvasRef.current, e);
    strokesRef.current[strokesRef.current.length - 1].push(pos);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawing) return;
    setDrawing(false);
    setHasSignature(true);
    onChange?.(canvasRef.current.toDataURL("image/png"));
  };
  const clear = () => {
    strokesRef.current = [];
    paintBackground(canvasRef.current);
    setHasSignature(false);
    onChange?.("");
  };

  return { canvasRef, hasSignature, start, move, end, clear };
};

export const SignaturePad = ({ onChange, testId = "signature-pad" }) => {
  const { t } = useTranslation();
  const { canvasRef, hasSignature, start, move, end, clear } = useSignatureCanvas(onChange);

  return (
    <div data-testid={testId} className="space-y-2">
      <div className="relative rounded-md border border-white/10 bg-[#0A0A0A] overflow-hidden">
        <canvas ref={canvasRef} className="signature-canvas w-full h-44"
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
        {!hasSignature && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-zinc-600 text-xs uppercase tracking-[0.3em]">
            {t("common.sign_here")}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={clear} data-testid="signature-clear-btn" className="text-zinc-400 hover:text-white">
          <Eraser className="w-3.5 h-3.5 mr-1.5" /> {t("common.clear")}
        </Button>
      </div>
    </div>
  );
};
