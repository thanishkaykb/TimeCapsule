import { useEffect, useRef, useState } from "react";
import { Camera as CamIcon, X, Loader2, RotateCw, Video, Square } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

type Mode = "photo" | "video";

export function CameraCapture({ eventId, onUploaded, onClose }: { eventId: string; onUploaded: () => void; onClose: () => void }) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [mode, setMode] = useState<Mode>("photo");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [flashing, setFlashing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start camera stream
  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera not supported on this browser");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: mode === "video",
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        setError(e?.message ?? "Camera unavailable. Allow camera access in your browser settings.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing, mode]);

  // Recording timer
  useEffect(() => {
    if (!recording) { setRecSeconds(0); return; }
    const t = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  async function uploadBlob(blob: Blob, ext: string, contentType: string, media_type: "image" | "video") {
    if (!user) return;
    setBusy(true);
    const path = `${eventId}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("event-photos").upload(path, blob, { contentType });
    if (upErr) { setBusy(false); return toast.error(upErr.message); }
    const { error: dbErr } = await supabase.from("photos").insert({ event_id: eventId, user_id: user.id, storage_path: path, media_type });
    setBusy(false);
    if (dbErr) return toast.error(dbErr.message);
    toast.success(media_type === "video" ? "Video saved!" : "Snapped!");
    onUploaded();
  }

  async function snap() {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const w = v.videoWidth, h = v.videoHeight;
    if (!w || !h) return;
    setFlashing(true);
    setTimeout(() => setFlashing(false), 250);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    if (facing === "user") { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0, w, h);
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.92));
    await uploadBlob(blob, "jpg", "image/jpeg", "image");
  }

  function pickVideoMime(): { mime: string; ext: string } {
    const candidates = [
      { mime: "video/mp4", ext: "mp4" },
      { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
      { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
      { mime: "video/webm", ext: "webm" },
    ];
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mime)) return c;
    }
    return { mime: "", ext: "webm" };
  }

  function startRec() {
    if (!streamRef.current) return;
    try {
      const { mime, ext } = pickVideoMime();
      const rec = mime ? new MediaRecorder(streamRef.current, { mimeType: mime }) : new MediaRecorder(streamRef.current);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime || "video/webm" });
        chunksRef.current = [];
        await uploadBlob(blob, ext, mime || "video/webm", "video");
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Video recording not supported");
    }
  }

  function stopRec() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 text-white">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10" disabled={recording}>
          <X className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-1 rounded-full bg-white/10 p-1 text-xs">
          <button
            onClick={() => !recording && setMode("photo")}
            className={`px-3 py-1 rounded-full ${mode === "photo" ? "bg-white text-black" : "text-white"}`}
          >Photo</button>
          <button
            onClick={() => !recording && setMode("video")}
            className={`px-3 py-1 rounded-full ${mode === "video" ? "bg-white text-black" : "text-white"}`}
          >Video</button>
        </div>
        <Button variant="ghost" size="icon" onClick={() => !recording && setFacing(f => f === "user" ? "environment" : "user")} className="text-white hover:bg-white/10" disabled={recording}>
          <RotateCw className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex-1 relative overflow-hidden grid place-items-center">
        {error ? (
          <div className="text-center text-white p-8">
            <p>{error}</p>
            <p className="text-sm text-white/60 mt-2">Allow camera access in your browser settings, then reopen.</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="max-h-full max-w-full"
            style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
          />
        )}
        {flashing && <div className="absolute inset-0 bg-white" style={{ animation: "fadeFlash 0.3s ease-out" }} />}
        {recording && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs text-white">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            REC {String(Math.floor(recSeconds / 60)).padStart(2, "0")}:{String(recSeconds % 60).padStart(2, "0")}
          </div>
        )}
      </div>
      <div className="p-8 flex items-center justify-center">
        {mode === "photo" ? (
          <button
            onClick={snap}
            disabled={busy || !!error}
            aria-label="Take photo"
            className="relative h-20 w-20 rounded-full bg-white shadow-2xl ring-4 ring-white/30 transition active:scale-95 disabled:opacity-50"
          >
            {busy ? <Loader2 className="absolute inset-0 m-auto h-7 w-7 animate-spin text-black" /> : <CamIcon className="absolute inset-0 m-auto h-7 w-7 text-black" />}
          </button>
        ) : (
          <button
            onClick={recording ? stopRec : startRec}
            disabled={busy || !!error}
            aria-label={recording ? "Stop recording" : "Start recording"}
            className={`relative h-20 w-20 rounded-full shadow-2xl ring-4 ring-white/30 transition active:scale-95 disabled:opacity-50 ${recording ? "bg-red-600" : "bg-white"}`}
          >
            {busy
              ? <Loader2 className="absolute inset-0 m-auto h-7 w-7 animate-spin text-black" />
              : recording
                ? <Square className="absolute inset-0 m-auto h-7 w-7 text-white fill-white" />
                : <Video className="absolute inset-0 m-auto h-7 w-7 text-red-600" />}
          </button>
        )}
      </div>
      <style>{`@keyframes fadeFlash { from { opacity: 1 } to { opacity: 0 } }`}</style>
    </div>
  );
}
