import React, { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Eraser } from "lucide-react";

export const SignaturePad = ({ onChange, testId = "signature-pad" }) => {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#0A0A0A";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  };

  const move = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing) return;
    setDrawing(false);
    setHasSignature(true);
    const data = canvasRef.current.toDataURL("image/png");
    onChange?.(data);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#0A0A0A";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
    onChange?.("");
  };

  return (
    <div data-testid={testId} className="space-y-2">
      <div className="relative rounded-md border border-white/10 bg-[#0A0A0A] overflow-hidden">
        <canvas
          ref={canvasRef}
          className="signature-canvas w-full h-44"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
        {!hasSignature && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-zinc-600 text-xs uppercase tracking-[0.3em]">
            Sign here
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clear}
          data-testid="signature-clear-btn"
          className="text-zinc-400 hover:text-white"
        >
          <Eraser className="w-3.5 h-3.5 mr-1.5" /> Clear
        </Button>
      </div>
    </div>
  );
};
