
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  host_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  reveal_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- event members
CREATE TABLE public.event_members (
  event_id UUID NOT NULL REFERENCES public.events ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.event_members TO authenticated;
GRANT ALL ON public.event_members TO service_role;
ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;

-- helper: is_member
CREATE OR REPLACE FUNCTION public.is_event_member(_event_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.event_members WHERE event_id = _event_id AND user_id = _user_id);
$$;

-- events policies
CREATE POLICY "authenticated can view events" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can create events" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "host can update event" ON public.events FOR UPDATE TO authenticated USING (auth.uid() = host_id);
CREATE POLICY "host can delete event" ON public.events FOR DELETE TO authenticated USING (auth.uid() = host_id);

-- members policies
CREATE POLICY "view members of joined events" ON public.event_members FOR SELECT TO authenticated USING (public.is_event_member(event_id, auth.uid()));
CREATE POLICY "user can join an event" ON public.event_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user can leave own membership" ON public.event_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- auto-add host as member
CREATE OR REPLACE FUNCTION public.add_host_as_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_members (event_id, user_id) VALUES (NEW.id, NEW.host_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_add_host_as_member AFTER INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.add_host_as_member();

-- photos
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.photos TO authenticated;
GRANT ALL ON public.photos TO service_role;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members see photos (own anytime, others after reveal)" ON public.photos
FOR SELECT TO authenticated
USING (
  public.is_event_member(event_id, auth.uid())
  AND (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.reveal_at <= now())
  )
);
CREATE POLICY "members upload own photos" ON public.photos FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_event_member(event_id, auth.uid()));
CREATE POLICY "owners delete own photos" ON public.photos FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- storage policies for event-photos bucket (bucket created separately via tool)
-- Path convention: {event_id}/{user_id}/{filename}
