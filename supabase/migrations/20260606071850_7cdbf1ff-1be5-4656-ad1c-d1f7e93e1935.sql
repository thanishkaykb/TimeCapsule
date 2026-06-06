
-- Photos: nobody (not even uploader) sees media until reveal_at
DROP POLICY IF EXISTS "members see photos (own anytime, others after reveal)" ON public.photos;
DROP POLICY IF EXISTS "owners delete own photos" ON public.photos;

CREATE POLICY "members see photos only after reveal"
ON public.photos FOR SELECT TO authenticated
USING (
  is_event_member(event_id, auth.uid())
  AND EXISTS (SELECT 1 FROM events e WHERE e.id = photos.event_id AND e.reveal_at <= now())
);

-- Storage: same rule for files
DROP POLICY IF EXISTS "members read event-photos (own anytime, others after reveal)" ON storage.objects;
DROP POLICY IF EXISTS "owners delete own files in event-photos" ON storage.objects;

CREATE POLICY "members read event-photos only after reveal"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-photos'
  AND public.is_event_member(((storage.foldername(name))[1])::uuid, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = ((storage.foldername(name))[1])::uuid AND e.reveal_at <= now()
  )
);
