import React, { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Camera, Upload, X, Check, AlertTriangle } from "lucide-react";

const openStream = async () => {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
  } catch {
    return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
};

const stopStream = (stream) => stream?.getTracks().forEach((t) => t.stop());

const attachStream = async (video, stream) => {
  video.srcObject = stream;
  video.setAttribute("autoplay", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("muted", "");
  try { await video.play(); } catch { /* autoplay can be blocked; onCanPlay still fires */ }
};

const cameraErrorText = (err) => (err?.name === "NotAllowedError" ? "Camera permission denied." : "Camera unavailable on this device.");

const grabFrame = (video) => {
  if (!video?.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.85);
};

const useCameraStream = (active, videoRef) => {
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    let stream = null;
    const video = videoRef.current;
    setReady(false);
    setError("");
    openStream()
      .then((s) => {
        if (cancelled) return stopStream(s);
        stream = s;
        return video && attachStream(video, s);
      })
      .catch((err) => !cancelled && setError(cameraErrorText(err)));
    return () => {
      cancelled = true;
      stopStream(stream);
      if (video) video.srcObject = null;
    };
  }, [active, videoRef]);

  return { error, ready, setReady };
};

export const PhotoCapture = ({ value, onChange, testId = "photo-capture" }) => {
  const videoRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const camera = useCameraStream(cameraOn, videoRef);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  };

  const snap = () => {
    const data = grabFrame(videoRef.current);
    if (!data) return;
    onChange(data);
    setCameraOn(false);
  };

  if (value) return <PhotoPreview value={value} onRemove={() => onChange("")} testId={testId} />;
  if (cameraOn) return <CameraView videoRef={videoRef} camera={camera} onSnap={snap} onCancel={() => setCameraOn(false)} testId={testId} />;
  return <PhotoPicker onFile={handleFile} onCamera={() => setCameraOn(true)} testId={testId} />;
};

const PhotoPreview = ({ value, onRemove, testId }) => (
  <div data-testid={testId} className="space-y-3">
    <div className="relative group">
      <img src={value} alt="damage" className="w-full h-48 object-cover rounded-md border border-white/10" data-testid="damage-photo-preview" />
      <button type="button" onClick={onRemove} data-testid="remove-photo-btn"
        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 border border-white/20 text-white hover:bg-red-600/80 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

const CameraView = ({ videoRef, camera, onSnap, onCancel, testId }) => (
  <div data-testid={testId} className="space-y-2">
    <div className="relative w-full h-48 rounded-md overflow-hidden bg-black border border-white/10">
      <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={() => camera.setReady(true)} onCanPlay={() => camera.setReady(true)}
        className="w-full h-full object-cover bg-black" />
      {!camera.ready && !camera.error && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-xs animate-pulse">Starting camera…</div>
      )}
      {camera.error && (
        <div data-testid="camera-error" className="absolute inset-0 flex flex-col items-center justify-center text-amber-400 text-xs gap-1 px-3 text-center">
          <AlertTriangle className="w-5 h-5" />
          {camera.error}
        </div>
      )}
    </div>
    <div className="flex gap-2">
      <Button type="button" onClick={onSnap} disabled={!camera.ready} data-testid="snap-photo-btn" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
        <Check className="w-4 h-4 mr-2" /> Capture
      </Button>
      <Button type="button" variant="secondary" onClick={onCancel} data-testid="cancel-camera-btn" className="bg-[#1A1A1A] hover:bg-[#252525] border border-white/10">
        Cancel
      </Button>
    </div>
  </div>
);

const PhotoPicker = ({ onFile, onCamera, testId }) => {
  const fileRef = useRef(null);
  return (
    <div data-testid={testId} className="space-y-3">
      <div className="flex gap-2">
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" data-testid="photo-file-input" />
        <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} data-testid="upload-photo-btn"
          className="flex-1 bg-[#1A1A1A] hover:bg-[#252525] border border-white/10 text-white">
          <Upload className="w-4 h-4 mr-2" /> Upload
        </Button>
        <Button type="button" variant="secondary" onClick={onCamera} data-testid="open-camera-btn"
          className="flex-1 bg-[#1A1A1A] hover:bg-[#252525] border border-white/10 text-white">
          <Camera className="w-4 h-4 mr-2" /> Camera
        </Button>
      </div>
    </div>
  );
};
