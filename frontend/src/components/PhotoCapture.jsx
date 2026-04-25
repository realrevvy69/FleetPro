import React, { useRef, useState } from "react";
import { Button } from "./ui/button";
import { Camera, Upload, X, Check } from "lucide-react";

export const PhotoCapture = ({ value, onChange, testId = "photo-capture" }) => {
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err) {
      alert("Camera access denied or unavailable. Use Upload instead.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
  };

  const snap = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    onChange(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera();
  };

  return (
    <div data-testid={testId} className="space-y-3">
      {value ? (
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
      ) : cameraOn ? (
        <div className="space-y-2">
          <video
            ref={videoRef}
            className="w-full h-48 object-cover rounded-md bg-black border border-white/10"
            playsInline
            muted
          />
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={snap}
              data-testid="snap-photo-btn"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Check className="w-4 h-4 mr-2" /> Capture
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={stopCamera}
              data-testid="cancel-camera-btn"
              className="bg-[#1A1A1A] hover:bg-[#252525] border border-white/10"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
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
            onClick={startCamera}
            data-testid="open-camera-btn"
            className="flex-1 bg-[#1A1A1A] hover:bg-[#252525] border border-white/10 text-white"
          >
            <Camera className="w-4 h-4 mr-2" /> Camera
          </Button>
        </div>
      )}
    </div>
  );
};
