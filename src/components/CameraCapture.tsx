import { useEffect, useRef, useState } from "react";
import { Camera as CamIcon, X, Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function CameraCapture({ eventId, onUploaded, onClose }: { eventId: string; onUploaded: () => void; onClose: () => void }) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [busy, setBusy] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        setError(e?.message ?? "Camera unavailable");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing]);

  async function snap() {
    if (!videoRef.current || !user) return;
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

    setBusy(true);
    const path = `${eventId}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error: upErr } = await supabase.storage.from("event-photos").upload(path, blob, { contentType: "image/jpeg" });
    if (upErr) { setBusy(false); return toast.error(upErr.message); }
    const { error: dbErr } = await supabase.from("photos").insert({ event_id: eventId, user_id: user.id, storage_path: path });
    setBusy(false);
    if (dbErr) return toast.error(dbErr.message);
    toast.success("Snapped! Hidden until reveal.");
    onUploaded();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 text-white">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
          <X className="h-5 w-5" />
        </Button>
        <span className="font-display text-lg">Take a shot</span>
        <Button variant="ghost" size="icon" onClick={() => setFacing(f => f === "user" ? "environment" : "user")} className="text-white hover:bg-white/10">
          <RotateCw className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex-1 relative overflow-hidden grid place-items-center">
        {error ? (
          <div className="text-center text-white p-8">
            <p>{error}</p>
            <p className="text-sm text-white/60 mt-2">Allow camera access in your browser settings.</p>
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
        {flashing && <div className="absolute inset-0 bg-white animate-[fade_0.3s_ease-out]" style={{ animation: "fadeFlash 0.3s ease-out" }} />}
      </div>
      <div className="p-8 flex items-center justify-center">
        <button
          onClick={snap}
          disabled={busy || !!error}
          className="relative h-20 w-20 rounded-full bg-white shadow-2xl ring-4 ring-white/30 transition active:scale-95 disabled:opacity-50"
        >
          {busy ? <Loader2 className="absolute inset-0 m-auto h-7 w-7 animate-spin text-black" /> : <CamIcon className="absolute inset-0 m-auto h-7 w-7 text-black" />}
        </button>
      </div>
      <style>{`@keyframes fadeFlash { from { opacity: 1 } to { opacity: 0 } }`}</style>
    </div>
  );
}
