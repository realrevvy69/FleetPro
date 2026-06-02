import React, { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Camera, Upload, X, Check, AlertTriangle } from "lucide-react";

export const PhotoCapture = ({ value, onChange, testId = "photo-capture" }) => {
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [videoReady, setVideoReady] = useState(false);

  // Attach / detach the media stream whenever cameraOn flips
  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        // Prefer rear camera but fall back to any camera if not available
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("autoplay", "");
          video.setAttribute("playsinline", "");
          video.setAttribute("muted", "");
          try { await video.play(); } catch {}
        }
      } catch (err) {
        setCameraError(
          err && err.name === "NotAllowedError"
            ? "Camera permission denied."
            : "Camera unavailable on this device."
        );
        setCameraOn(false);
      }
    };

    if (cameraOn) {
      setVideoReady(false);
      setCameraError("");
      start();
    }

    return () => {
      cancelled = true;
      const s = streamRef.current;
      if (s) {
        s.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        try { videoRef.current.srcObject = null; } catch {}
      }
    };
  }, [cameraOn]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  };

  const snap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    onChange(canvas.toDataURL("image/jpeg", 0.85));
    setCameraOn(false);
  };

  if (value) {
    return (
      <div data-testid={testId} className="space-y-3">
        <div className="relative group">
          <img
            src={value}
            alt="damage"
            className="w-full h-48 object-cover rounded-md border border-white/10"
            data-testid="damage-photo-preview"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            data-testid="remove-photo-btn"
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 border border-white/20 text-white hover:bg-red-600/80 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (cameraOn) {
    return (
      <div data-testid={testId} className="space-y-2">
        <div className="relative w-full h-48 rounded-md overflow-hidden bg-black border border-white/10">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => setVideoReady(true)}
            onCanPlay={() => setVideoReady(true)}
            className="w-full h-full object-cover bg-black"
          />
          {!videoReady && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-xs animate-pulse">
              Starting camera…
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-amber-400 text-xs gap-1 px-3 text-center">
              <AlertTriangle className="w-5 h-5" />
              {cameraError}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={snap}
            disabled={!videoReady}
            data-testid="snap-photo-btn"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            <Check className="w-4 h-4 mr-2" /> Capture
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setCameraOn(false)}
            data-testid="cancel-camera-btn"
            className="bg-[#1A1A1A] hover:bg-[#252525] border border-white/10"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid={testId} className="space-y-3">
      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
          data-testid="photo-file-input"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          data-testid="upload-photo-btn"
          className="flex-1 bg-[#1A1A1A] hover:bg-[#252525] border border-white/10 text-white"
        >
          <Upload className="w-4 h-4 mr-2" /> Upload
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setCameraOn(true)}
          data-testid="open-camera-btn"
          className="flex-1 bg-[#1A1A1A] hover:bg-[#252525] border border-white/10 text-white"
        >
          <Camera className="w-4 h-4 mr-2" /> Camera
        </Button>
      </div>
    </div>
  );
};
