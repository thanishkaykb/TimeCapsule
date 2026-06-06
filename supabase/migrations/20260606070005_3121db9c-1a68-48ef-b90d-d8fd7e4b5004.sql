
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_host_as_member() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_event_member(uuid, uuid) FROM PUBLIC, anon;
-- is_event_member must be callable by authenticated since it's used in RLS via SECURITY DEFINER; RLS evaluation runs as table owner so PUBLIC revoke is fine, but keep authenticated EXECUTE for use in app queries:
GRANT EXECUTE ON FUNCTION public.is_event_member(uuid, uuid) TO authenticated;

-- storage policies on event-photos bucket. Path: {event_id}/{user_id}/{filename}
CREATE POLICY "event members can view photos in bucket"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-photos'
  AND public.is_event_member((storage.foldername(name))[1]::uuid, auth.uid())
);

CREATE POLICY "users upload to own folder in their event"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-photos'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.is_event_member((storage.foldername(name))[1]::uuid, auth.uid())
);

CREATE POLICY "users delete own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'event-photos'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
