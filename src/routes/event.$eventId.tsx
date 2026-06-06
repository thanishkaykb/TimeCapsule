import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera as CamIcon, Clock, Lock, Download, ArrowLeft, Copy, Check, Users, Pencil, Play, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import fileSaver from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { CameraCapture } from "@/components/CameraCapture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const { saveAs } = fileSaver;

export const Route = createFileRoute("/event/$eventId")({
  component: EventPage,
});

function EventPage() {
  const { eventId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [showCamera, setShowCamera] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-join if not yet a member (so a host or invited user landing on the link gets membership)
  useEffect(() => {
    if (!user) return;
    (async () => {
      await supabase.from("event_members").insert({ event_id: eventId, user_id: user.id }).then(() => {});
    })();
  }, [user, eventId]);

  const eventQ = useQuery({
    queryKey: ["event", eventId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId).single();
      if (error) throw error;
      return data;
    },
  });

  const membersQ = useQuery({
    queryKey: ["members", eventId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_members")
        .select("user_id, profiles(display_name)")
        .eq("event_id", eventId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const event = eventQ.data;
  const revealAt = event ? new Date(event.reveal_at).getTime() : 0;
  const revealed = now >= revealAt;

  const photosQ = useQuery({
    queryKey: ["photos", eventId, revealed],
    enabled: !!event,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("event_id", eventId)
        .order("taken_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const remaining = useMemo(() => {
    const diff = Math.max(0, revealAt - now);
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { d, h, m, s };
  }, [revealAt, now]);

  if (authLoading || eventQ.isLoading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!event) return <div className="min-h-screen grid place-items-center text-muted-foreground">Event not found</div>;

  const isHost = user?.id === event.host_id;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All events
        </Link>

        <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="rounded-full bg-primary/15 px-3 py-1 font-mono text-sm tracking-widest text-primary cursor-pointer"
                onClick={() => { navigator.clipboard.writeText(event.code); setCopied(true); setTimeout(() => setCopied(false), 1500); toast.success("Code copied"); }}
              >
                {event.code} {copied ? <Check className="ml-1 inline h-3 w-3" /> : <Copy className="ml-1 inline h-3 w-3" />}
              </span>
            </div>
            <h1 className="mt-3 text-4xl sm:text-5xl font-display">{event.name}</h1>
            {event.description && <p className="mt-3 text-muted-foreground max-w-2xl">{event.description}</p>}

            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => setShowCamera(true)} className="h-12 px-6">
                <CamIcon className="mr-2 h-5 w-5" /> Take photo / video
              </Button>
              <UploadButton eventId={eventId} userId={user?.id ?? ""} onUploaded={() => photosQ.refetch()} />
              {revealed && photosQ.data && photosQ.data.length > 0 && (
                <DownloadButton photos={photosQ.data} eventName={event.name} />
              )}
            </div>

            <Gallery
              photos={photosQ.data ?? []}
              revealed={revealed}
              userId={user?.id ?? ""}
              members={membersQ.data ?? []}
              onChanged={() => photosQ.refetch()}
            />
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card/70 p-5">
              <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4" /> {revealed ? "Revealed" : "Reveals in"}</span>
                {isHost && <EditRevealDialog eventId={event.id} currentReveal={event.reveal_at} onSaved={() => eventQ.refetch()} />}
              </div>
              {revealed ? (
                <p className="mt-2 text-2xl font-display">The album is open</p>
              ) : (
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {[["d", remaining.d], ["h", remaining.h], ["m", remaining.m], ["s", remaining.s]].map(([u, v]) => (
                    <div key={String(u)} className="rounded-xl bg-background/60 py-3">
                      <div className="font-display text-2xl">{String(v).padStart(2, "0")}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">{u}</div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                {new Date(event.reveal_at).toLocaleString()}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card/70 p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <Users className="h-4 w-4" /> {membersQ.data?.length ?? 0} guests
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {(membersQ.data ?? []).slice(0, 12).map((m: any) => (
                  <li key={m.user_id} className="text-foreground/80">
                    {m.profiles?.display_name ?? "Guest"}{m.user_id === event.host_id && <span className="ml-2 text-xs text-primary">host</span>}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-dashed border-border bg-card/40 p-5 text-sm text-muted-foreground">
              Share code <span className="font-mono text-primary">{event.code}</span> so guests can join.
            </div>
          </aside>
        </div>
      </main>

      {showCamera && (
        <CameraCapture eventId={eventId} onClose={() => setShowCamera(false)} onUploaded={() => photosQ.refetch()} />
      )}
    </div>
  );
}

function EditRevealDialog({ eventId, currentReveal, onSaved }: { eventId: string; currentReveal: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const initial = () => {
    const d = new Date(currentReveal);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const [val, setVal] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setVal(initial()); /* eslint-disable-next-line */ }, [open, currentReveal]);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("events").update({ reveal_at: new Date(val).toISOString() }).eq("id", eventId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Reveal time updated");
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10">
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl">Edit reveal time</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Input type="datetime-local" value={val} onChange={(e) => setVal(e.target.value)} />
          <Button onClick={save} disabled={busy} className="w-full h-11">{busy ? "Saving…" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Gallery({ photos, revealed, members }: { photos: any[]; revealed: boolean; userId: string; members: any[]; onChanged: () => void }) {
  if (!revealed) {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center">
        <Lock className="mx-auto h-8 w-8 text-primary" />
        <p className="mt-3 font-display text-2xl">The film is developing</p>
        <p className="mt-1 text-muted-foreground">
          Every shot — including yours — stays sealed until reveal time. Keep snapping; nobody peeks until then.
        </p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center">
        <p className="font-display text-2xl">No shots yet</p>
        <p className="mt-1 text-muted-foreground">Be the first to capture the moment.</p>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <h2 className="text-2xl font-display">Album</h2>
      <div className="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p) => <MediaTile key={p.id} photo={p} members={members} />)}
      </div>
    </div>
  );
}

function MediaTile({ photo, members }: { photo: any; members: any[] }) {
  const [url, setUrl] = useState<string | null>(null);
  const isVideo = photo.media_type === "video";

  useEffect(() => {
    let cancelled = false;
    supabase.storage.from("event-photos").createSignedUrl(photo.storage_path, 3600).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [photo.storage_path]);

  const taker = members.find((m) => m.user_id === photo.user_id)?.profiles?.display_name ?? "Guest";

  return (
    <a href={url ?? "#"} target="_blank" rel="noreferrer" className="group relative aspect-square overflow-hidden rounded-xl bg-secondary block">
      {url ? (
        isVideo ? (
          <>
            <video src={url} className="h-full w-full object-cover" playsInline muted preload="metadata" />
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white">
                <Play className="h-4 w-4 fill-white" />
              </span>
            </div>
          </>
        ) : (
          <img src={url} alt={`Photo by ${taker}`} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
        )
      ) : (
        <div className="h-full w-full animate-pulse bg-muted" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-xs text-white opacity-0 transition group-hover:opacity-100 pointer-events-none">
        {taker} · {new Date(photo.taken_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </a>
  );
}

function DownloadButton({ photos, eventName }: { photos: any[]; eventName: string }) {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(eventName.replace(/[^\w\s-]/g, "").trim() || "album")!;
      for (const p of photos) {
        const { data } = await supabase.storage.from("event-photos").download(p.storage_path);
        if (data) {
          const name = p.storage_path.split("/").pop()!;
          folder.file(name, data);
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `${eventName}.zip`);
    } catch (e: any) {
      toast.error("Download failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="outline" size="lg" onClick={download} disabled={busy} className="h-12 px-6">
      <Download className="mr-2 h-5 w-5" /> {busy ? "Zipping…" : "Download album"}
    </Button>
  );
}

function UploadButton({ eventId, userId, onUploaded }: { eventId: string; userId: string; onUploaded: () => void }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !userId) return;
    setBusy(true);
    let ok = 0, fail = 0;
    for (const file of files) {
      const isVideo = file.type.startsWith("video/");
      const media_type: "image" | "video" = isVideo ? "video" : "image";
      const ext = (file.name.split(".").pop() || (isVideo ? "mp4" : "jpg")).toLowerCase();
      const path = `${eventId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("event-photos").upload(path, file, { contentType: file.type || undefined });
      if (upErr) { fail++; continue; }
      const { error: dbErr } = await supabase.from("photos").insert({ event_id: eventId, user_id: userId, storage_path: path, media_type });
      if (dbErr) { fail++; continue; }
      ok++;
    }
    setBusy(false);
    if (ok) toast.success(`Uploaded ${ok} ${ok === 1 ? "file" : "files"} to the secret album`);
    if (fail) toast.error(`${fail} upload${fail === 1 ? "" : "s"} failed`);
    if (ok) onUploaded();
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
      <Button variant="outline" size="lg" onClick={() => inputRef.current?.click()} disabled={busy} className="h-12 px-6">
        {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Upload className="mr-2 h-5 w-5" />}
        {busy ? "Uploading…" : "Upload from gallery"}
      </Button>
    </>
  );
}
