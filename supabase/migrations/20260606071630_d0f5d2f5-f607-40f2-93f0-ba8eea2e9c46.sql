
-- Grant execute on is_event_member so RLS policies work for authenticated users
GRANT EXECUTE ON FUNCTION public.is_event_member(uuid, uuid) TO authenticated, anon, service_role;

-- Add FK from event_members.user_id -> profiles.id so PostgREST embed works
ALTER TABLE public.event_members
  ADD CONSTRAINT event_members_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add media_type column on photos (image | video)
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image';

-- Storage RLS policies for event-photos bucket
-- Path structure: {event_id}/{user_id}/{filename}
CREATE POLICY "members upload to own folder in event"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-photos'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.is_event_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "members read event-photos (own anytime, others after reveal)"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-photos'
  AND public.is_event_member(((storage.foldername(name))[1])::uuid, auth.uid())
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = ((storage.foldername(name))[1])::uuid AND e.reveal_at <= now()
    )
  )
);

CREATE POLICY "owners delete own files in event-photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'event-photos'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
