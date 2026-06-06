import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera as CamIcon, Clock, Lock, Download, ArrowLeft, Copy, Check, Users } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { CameraCapture } from "@/components/CameraCapture";
import { Button } from "@/components/ui/button";

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

  const photosQ = useQuery({
    queryKey: ["photos", eventId, now > new Date(eventQ.data?.reveal_at ?? 0).getTime()],
    enabled: !!eventQ.data,
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

  const event = eventQ.data;
  const revealAt = event ? new Date(event.reveal_at).getTime() : 0;
  const revealed = now >= revealAt;
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
                <CamIcon className="mr-2 h-5 w-5" /> Take photo
              </Button>
              {revealed && photosQ.data && photosQ.data.length > 0 && (
                <DownloadButton photos={photosQ.data} eventName={event.name} />
              )}
            </div>

            <Gallery
              photos={photosQ.data ?? []}
              revealed={revealed}
              userId={user?.id ?? ""}
              members={membersQ.data ?? []}
            />
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card/70 p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <Clock className="h-4 w-4" /> {revealed ? "Revealed" : "Reveals in"}
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
                {(membersQ.data ?? []).slice(0, 8).map((m: any) => (
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

function Gallery({ photos, revealed, userId, members }: { photos: any[]; revealed: boolean; userId: string; members: any[] }) {
  const myPhotos = photos.filter((p) => p.user_id === userId);
  const otherCount = photos.length - myPhotos.length;
  const visible = revealed ? photos : myPhotos;

  if (visible.length === 0 && !revealed) {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center">
        <Lock className="mx-auto h-8 w-8 text-primary" />
        <p className="mt-3 font-display text-2xl">The film is developing</p>
        <p className="mt-1 text-muted-foreground">Snap photos now — they'll appear for everyone at reveal time.</p>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-display">
          {revealed ? "Album" : "Your shots"}
        </h2>
        {!revealed && otherCount > 0 && (
          <span className="text-sm text-muted-foreground">
            <Lock className="inline h-3.5 w-3.5" /> {otherCount} hidden from other guests
          </span>
        )}
      </div>
      <div className="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((p) => <PhotoTile key={p.id} photo={p} members={members} />)}
      </div>
    </div>
  );
}

function PhotoTile({ photo, members }: { photo: any; members: any[] }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.storage.from("event-photos").createSignedUrl(photo.storage_path, 3600).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [photo.storage_path]);
  const taker = members.find((m) => m.user_id === photo.user_id)?.profiles?.display_name ?? "Guest";
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="group relative aspect-square overflow-hidden rounded-xl bg-secondary"
    >
      {url ? (
        <img src={url} alt={`Photo by ${taker}`} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
      ) : (
        <div className="h-full w-full animate-pulse bg-muted" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-xs text-white opacity-0 transition group-hover:opacity-100">
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
