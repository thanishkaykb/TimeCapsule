
-- 1) Restrict event SELECT to host + members only (codes no longer enumerable)
DROP POLICY IF EXISTS "authenticated can view events" ON public.events;

CREATE POLICY "host or members can view event"
ON public.events FOR SELECT
TO authenticated
USING (
  auth.uid() = host_id
  OR public.is_event_member(id, auth.uid())
);

-- 2) Secure join-by-code RPC (bypasses RLS to look up code, but only joins the caller)
CREATE OR REPLACE FUNCTION public.join_event_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO _event_id FROM public.events WHERE code = upper(trim(_code));
  IF _event_id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  INSERT INTO public.event_members (event_id, user_id)
  VALUES (_event_id, auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN _event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_event_by_code(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_event_by_code(text) TO authenticated;

-- 3) Fix buggy storage policies that referenced events.name instead of the storage object name
DROP POLICY IF EXISTS "host can delete event storage objects" ON storage.objects;
DROP POLICY IF EXISTS "members read event-photos only after reveal" ON storage.objects;
DROP POLICY IF EXISTS "event members can view photos in bucket" ON storage.objects;
DROP POLICY IF EXISTS "users delete own files" ON storage.objects;

-- Reveal-aware SELECT (the only SELECT policy, so no permissive OR-bypass)
CREATE POLICY "members read event-photos only after reveal"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'event-photos'
  AND public.is_event_member(((storage.foldername(name))[1])::uuid, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = ((storage.foldername(name))[1])::uuid
      AND e.reveal_at <= now()
  )
);

-- Host can delete any object inside their event's folder
CREATE POLICY "host can delete event storage objects"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'event-photos'
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.host_id = auth.uid()
      AND e.id::text = (storage.foldername(name))[1]
  )
);
