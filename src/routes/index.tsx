import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, Plus, Users, Clock, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  component: Home,
});

function randCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!user) return <Landing />;
  return <Dashboard />;
}

function Landing() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> A virtual disposable camera
        </div>
        <h1 className="mt-6 text-5xl sm:text-7xl font-display leading-[1.05]">
          Every guest's photos.<br />
          <span className="text-primary">One shared album.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Weddings, parties, family gatherings — give everyone a virtual disposable camera.
          Snap photos in-app, wait for the reveal, then unwrap the whole album together.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="h-12 px-6 text-base">
            <Link to="/auth">Start an event <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
            <Link to="/auth">Join with a code</Link>
          </Button>
        </div>
        <div className="mt-24 grid gap-6 sm:grid-cols-3 text-left">
          {[
            { icon: Camera, t: "In-app camera", d: "No camera roll mess. Photos snap straight into the album." },
            { icon: Clock, t: "Film delay", d: "Photos stay hidden until the reveal time you set." },
            { icon: Users, t: "Shared gallery", d: "Everyone sees every shot. Download the whole album as a ZIP." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-border bg-card/60 p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-xl">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const { data: events, refetch } = useQuery({
    queryKey: ["my-events", user!.id],
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from("event_members")
        .select("event_id, events(*)")
        .order("joined_at", { ascending: false });
      if (error) throw error;
      return (memberships ?? []).map((m: any) => m.events).filter(Boolean);
    },
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-display">Your events</h1>
            <p className="text-muted-foreground mt-1">Host a new gathering or join one with a code.</p>
          </div>
          <div className="flex gap-2">
            <JoinDialog onJoined={refetch} />
            <CreateDialog onCreated={refetch} />
          </div>
        </div>

        {!events?.length ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/40 p-16 text-center">
            <Camera className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-4 text-2xl font-display">No events yet</h2>
            <p className="mt-2 text-muted-foreground">Create your first event to hand out virtual cameras.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e: any) => (
              <Link
                key={e.id}
                to="/event/$eventId"
                params={{ eventId: e.id }}
                className="group rounded-2xl border border-border bg-card/70 p-5 transition hover:border-primary/60 hover:shadow-glow"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-mono tracking-widest text-primary">
                    {e.code}
                  </span>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="mt-3 text-xl line-clamp-2">{e.name}</h3>
                <p className="mt-2 text-xs text-muted-foreground">
                  Reveals {new Date(e.reveal_at).toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function CreateDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [revealAt, setRevealAt] = useState(() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return toast.error("Name your event");
    setBusy(true);
    const code = randCode();
    const { data, error } = await supabase
      .from("events")
      .insert({ name, description: desc, code, host_id: user!.id, reveal_at: new Date(revealAt).toISOString() })
      .select()
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Event created");
    setOpen(false);
    onCreated();
    navigate({ to: "/event/$eventId", params: { eventId: data.id } });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-1 h-4 w-4" /> New event</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl">Host a new event</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Event name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aria & Leo's Wedding" /></div>
          <div className="space-y-1.5"><Label>Description (optional)</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Reveal date & time</Label><Input type="datetime-local" value={revealAt} onChange={(e) => setRevealAt(e.target.value)} /></div>
          <Button onClick={create} disabled={busy} className="w-full h-11">{busy ? "Creating…" : "Create event"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JoinDialog({ onJoined }: { onJoined: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function join() {
    if (!code.trim()) return;
    setBusy(true);
    const { data: ev, error } = await supabase.from("events").select("id").eq("code", code.toUpperCase().trim()).maybeSingle();
    if (error || !ev) { setBusy(false); return toast.error("Event not found"); }
    const { error: mErr } = await supabase.from("event_members").insert({ event_id: ev.id, user_id: user!.id });
    setBusy(false);
    if (mErr && !mErr.message.includes("duplicate")) return toast.error(mErr.message);
    toast.success("Joined!");
    setOpen(false);
    onJoined();
    navigate({ to: "/event/$eventId", params: { eventId: ev.id } });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Users className="mr-1 h-4 w-4" /> Join</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl">Join with a code</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            className="text-center font-mono text-2xl tracking-[0.5em] h-14"
            maxLength={6}
          />
          <Button onClick={join} disabled={busy} className="w-full h-11">{busy ? "Joining…" : "Join event"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
