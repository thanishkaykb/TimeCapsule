
-- Allow host to delete photos belonging to their event
CREATE POLICY "host can delete event photos"
ON public.photos FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = photos.event_id AND e.host_id = auth.uid()));

-- Storage: allow host to delete any object under their event's folder
CREATE POLICY "host can delete event storage objects"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'event-photos'
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.host_id = auth.uid()
      AND (storage.foldername(name))[1] = e.id::text
  )
);

-- Ensure event delete cascades members (in case FK wasn't set)
ALTER TABLE public.event_members
  DROP CONSTRAINT IF EXISTS event_members_event_id_fkey,
  ADD CONSTRAINT event_members_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE public.photos
  DROP CONSTRAINT IF EXISTS photos_event_id_fkey,
  ADD CONSTRAINT photos_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
