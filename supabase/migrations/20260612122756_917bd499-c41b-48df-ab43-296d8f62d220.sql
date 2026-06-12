
CREATE POLICY "diary_photos_own" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'diary-photos' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'diary-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
